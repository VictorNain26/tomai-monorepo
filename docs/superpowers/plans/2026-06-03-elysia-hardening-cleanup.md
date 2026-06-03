# Elysia Hardening, Cleanup & Best-Practices Alignment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Assainir le backend `apps/server` (Elysia + Bun) — supprimer le code mort/dupliqué, fixer les failles de sécurité à la racine, et l'aligner à 100 % sur les best practices Elysia — sans pansement ni sur-ingénierie.

**Architecture :** Chantier en **6 phases, chacune = 1 PR shippable et testable**, dans l'ordre de dépendance (le nettoyage/config d'abord, car transverse). On ne migre PAS de framework (Elysia + Bun confirmés, à jour). La logique métier reste en services/repositories ; on ramène les routes au pattern fin déjà exemplaire (`deck.routes.ts`).

**Tech Stack :** Bun 1.3.14, Elysia 1.4.28, Better Auth 1.6.13, Drizzle ORM, Zod (env + non-HTTP + sortie IA), TypeBox `t` (validation HTTP), Eden Treaty (`@repo/api`).

## Principes (non négociables pour ce chantier)
- **Cause racine, pas pansement.** On supprime le code mort, on ne le contourne pas.
- **Zéro fallback silencieux** sur config/secret. Validation au boot, fail-fast, ou défaut **explicite et loggé** gardé par `NODE_ENV` non-prod.
- **YAGNI.** On ne crée pas de DI container, de rate-limit distribué, ni d'AsyncLocalStorage tant qu'il n'y a pas de besoin réel (voir « Hors scope »).
- **DRY.** Une seule source pour la config, les origines CORS, l'ownership des cartes, les types d'API.
- Chaque phase laisse `pnpm typecheck && pnpm lint && bun run test` vert.

## Hors scope (anti sur-ingénierie — décisions assumées)
- **Rate-limit distribué (Redis/Upstash)** : reporté. Zéro user, `MemoryCacheService` suffit. À faire quand le scaling horizontal Koyeb devient réel. (On corrige quand même le fail-open + IP-spoofing, qui sont gratuits.)
- **DI container / injection par constructeur** : non. Les singletons module-load conviennent à cette taille.
- **AsyncLocalStorage `requestId`** : reporté à quand l'observabilité devient un besoin actif.
- **Réécriture totale Zod→TypeBox** : non. `t` aux frontières HTTP, Zod conservé pour env, parsing webhook, et **sortie structurée IA** (`lib/ai/schemas/*` — Zod y est le bon outil, on n'y touche pas).

---

# Phase 0 — Cleanup + config unique (PR1) 🔴 fondation

**Goal :** Une seule source de config validée au boot, fail-fast, sans code mort ni fallback silencieux. Supprime C1 (secret fallback), M1/M2 (double config), le calcul CORS dupliqué, et ~100 lignes de code mort.

**Files:**
- Create: `apps/server/src/config/env.ts` (la NOUVELLE source unique, schéma Zod + parse boot)
- Delete: `apps/server/src/config/app.config.ts` (après migration des consommateurs réels)
- Modify: `apps/server/src/config/environment.config.ts` → fusionné dans `env.ts` puis supprimé
- Modify: `apps/server/src/lib/auth.ts` (consomme `env` + la fonction CORS unique)
- Modify: `apps/server/src/app.ts` (CORS depuis la fonction unique)
- Modify: tous les consommateurs réels de `appConfig.*` (grep ci-dessous)

### Task 0.1 : Inventorier les consommateurs réels de `appConfig`
- [ ] Lister ce qui est VRAIMENT utilisé (le reste est mort, à supprimer) :

Run: `cd apps/server && grep -rn "appConfig\.\|getEnv()\|env\." src --include="*.ts" | grep -v "config/" | sort`
Expected: liste des accès. On garde : `security.corsOrigins`, `ai.mistral.*`, `rag.*`, `qdrant.*`, `features.*`, rate-limit presets. On confirme morts (0 usage hors définition) : `security.betterAuthSecret`, `security.betterAuthUrl`, `database.{host,user,password,...}`, **tout `textToSpeech`** (vestige Google, contredit la stack 100 % EU), et on vérifie `usage.*` (vs `token-quota.service.ts`).

### Task 0.2 : Écrire `env.ts` — schéma Zod unique, fail-fast
- [ ] Créer `apps/server/src/config/env.ts` : un schéma Zod qui parse `Bun.env` **une fois**, throw en prod si un required manque (`BETTER_AUTH_SECRET`, `DATABASE_URL`, `BETTER_AUTH_URL`, **`PRONOTE_ENCRYPTION_KEY`** [fix C2], `REVENUECAT_WEBHOOK_AUTH`), expose un singleton typé. **Aucun fallback secret.** Les défauts non-sensibles (PORT 3000, LOG_LEVEL) sont explicites. Inclure `getCorsOrigins()` ici (fonction unique).

```ts
// apps/server/src/config/env.ts (forme cible)
import { z } from 'zod';

const isProd = Bun.env['NODE_ENV'] === 'production';
const requiredInProd = (name: string) =>
  z.string().min(1).superRefine((v, ctx) => {
    if (isProd && !v) ctx.addIssue({ code: 'custom', message: `${name} requis en production` });
  });

const Schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', '_error']).default('info'),
  DATABASE_URL: z.string().min(1),                 // requis partout
  BETTER_AUTH_SECRET: z.string().min(32),          // pas de fallback — fix C1
  BETTER_AUTH_URL: requiredInProd('BETTER_AUTH_URL').default('http://localhost:3000'),
  PRONOTE_ENCRYPTION_KEY: isProd ? z.string().min(1) : z.string().optional(), // fix C2
  REVENUECAT_WEBHOOK_AUTH: isProd ? z.string().min(32) : z.string().optional(),
  CORS_ORIGINS: z.string().optional(),
  // ... ai.mistral, rag, qdrant, features (migrés depuis app.config) ...
});

export const env = Schema.parse(Bun.env); // throw au boot si invalide — fail-fast

export function getCorsOrigins(): string[] {
  const origins = new Set<string>([env.BETTER_AUTH_URL]);
  env.CORS_ORIGINS?.split(',').map((o) => o.trim()).filter(Boolean).forEach((o) => origins.add(o));
  if (env.NODE_ENV === 'development') {
    origins.add('http://localhost:3001'); // landing
    origins.add('http://localhost:3002'); // web
  }
  return [...origins];
}
```

- [ ] Verify: `cd apps/server && bun -e "import('./src/config/env.ts').then(()=>console.log('boot OK'))"` → "boot OK" (avec `.env` dev présent).
- [ ] Verify fail-fast: lancer sans `BETTER_AUTH_SECRET` → throw clair (pas de démarrage silencieux).

### Task 0.3 : Brancher auth.ts + app.ts sur la source unique
- [ ] `lib/auth.ts` : remplacer `getTrustedOrigins()` (lignes ~36-79) par un appel à `getCorsOrigins()` (+ ajout des schemes Expo conditionnés dev — voir Phase 2 H1). `env.BETTER_AUTH_SECRET` reste la source.
- [ ] `app.ts` : `origin: getCorsOrigins()` au lieu de `appConfig.security.corsOrigins`. **Un seul calcul CORS** consommé par les deux.
- [ ] Verify: `grep -rn "getTrustedOrigins\|appConfig.security.corsOrigins" src` → 0 résultat.

### Task 0.4 : Migrer les consommateurs restants + SUPPRIMER le mort
- [ ] Remplacer chaque `appConfig.ai/rag/qdrant/features/usage` par `env.*` correspondant.
- [ ] `git rm apps/server/src/config/app.config.ts` et `environment.config.ts` (tout est dans `env.ts`).
- [ ] Verify: `grep -rn "app.config\|environment.config\|appConfig" src` → 0. `pnpm typecheck && pnpm lint && bun run test` → vert.
- [ ] Commit: `refactor(server): single validated env config, fail-fast, drop dead config (fixes C1/M1/M2)`

---

# Phase 1 — Auth en `macro` Elysia (PR2) 🔴

**Goal :** Remplacer les ~15 appels impératifs `handleAuthWithCookies(...)` par un **`macro({ auth })`** idiomatique qui injecte `{ user, session }` typés, renvoie `status(401)` + clear cookies, et dédup. Routes en `auth: true` / `.guard({ auth: true })`.

**Files:**
- Create: `apps/server/src/lib/auth-macro.ts` (le macro)
- Modify: tous les `routes/**` qui appellent `handleAuthWithCookies` (cf. grep)
- Modify/Delete: `apps/server/src/middleware/auth.middleware.ts` (garder `requireAuth` réutilisé par le macro ; retirer le helper impératif quand plus aucun appelant)

### Task 1.1 : Écrire le macro auth
- [ ] Créer `auth-macro.ts` (forme cible, réutilise `requireAuth` existant) :

```ts
import { Elysia } from 'elysia';
import { requireAuth } from '../middleware/auth.middleware';

export const authMacro = new Elysia({ name: 'auth-macro' }).macro({
  auth: {
    async resolve({ request, set, status }) {
      const result = await requireAuth(request.headers);
      if (!result.success) {
        if (result.shouldClearCookies) set.headers['Set-Cookie'] = result.clearCookieHeader;
        return status(result.status, result.error);
      }
      return { user: result.user, session: result.session };
    },
  },
});
```

- [ ] Verify: typecheck du fichier OK.

### Task 1.2 : Convertir les routes (groupe par groupe, vérifiable)
- [ ] Pour chaque routeur : `.use(authMacro)`, ajouter `.guard({ auth: true })` au groupe (ou `auth: true` par route), et **supprimer** le `const authContext = await handleAuthWithCookies(...)` + le `if (!authContext.success) return ...` de chaque handler — `user`/`session` viennent du context typé.
- [ ] Verify par routeur : `bun run typecheck` (le `user` doit être typé sans cast) + test du flux auth navigateur déjà éprouvé (signup→/parent).
- [ ] Quand `grep -rn handleAuthWithCookies src` → 0 hors def : supprimer le helper.
- [ ] Commit (un par groupe de routes, ou un par PR) : `refactor(server): auth via Elysia macro, drop imperative handleAuthWithCookies`

---

# Phase 2 — Hardening sécurité restant (PR3) 🟠

**Goal :** Fermer les findings de l'audit non couverts par Phase 0.

**Files:** `middleware/rate-limit.middleware.ts`, `lib/auth.ts`, `services/webhook-idempotence.service.ts`, `routes/revenuecat-webhook.handler.ts`, `lib/encryption.ts`, `services/server-lifecycle.ts`

### Tasks (chacune : fix + test + commit)
- [ ] **C3a** `rate-limit.middleware.ts` : `X-Forwarded-For` accepté **uniquement** si la connexion vient d'un proxy de confiance (allowlist IP Koyeb), sinon IP réelle. Test : header forgé → ignoré.
- [ ] **C3b** même fichier : remplacer le `catch { return; }` (fail-open) par **fail-closed** (429/503). Test : exception interne → requête bloquée.
- [ ] **H1** `auth.ts` : `exp://` (et `localhost`) uniquement si `env.NODE_ENV === 'development'`. En prod : `tomia://` seul. Test : origins prod ne contient pas `exp://`.
- [ ] **H2** `auth.ts` : plugin `mcp()` et **H3** `openAPI()` gardés par `isDev`. Test : route MCP/openAPI → 404 en prod.
- [ ] **H4/M7** webhook : `INSERT ... ON CONFLICT DO NOTHING` sur `webhook_events` **avant** d'appeler les handlers billing ; ne traiter que si `rowCount === 1` (idempotence atomique, fail-closed). Test : double event simultané → 1 seul traitement.
- [ ] **M5** `encryption.ts` : `process.env['PRONOTE_ENCRYPTION_KEY']` → `Bun.env[...]` (cohérence runtime build).
- [ ] **M3/L2/L3** : remplacer les `catch {}` muets (auth.ts:101, encryption.ts:136, webhook children parse) par un `logger.warn` contextualisé.
- [ ] Commit: `fix(server): security hardening (rate-limit fail-closed + proxy trust, exp:// dev-only, mcp/openAPI dev-only, atomic webhook idempotence)`

---

# Phase 3 — Layering learning (PR4) 🔴 dette + bug

**Goal :** Les routes `learning/*` délèguent à `LearningService` (transactions + ownership centralisés) au lieu de queries Drizzle inline. Corrige le bug `cardCount` non-transactionnel et la triple duplication du check d'ownership.

**Files:** `services/learning/learning.service.ts` (+méthodes), `routes/learning/card.routes.ts`, `routes/learning/fsrs.routes.ts`, `routes/learning/fsrs-extra.routes.ts`, repos cartes.

### Tasks
- [ ] Ajouter à `LearningService` : `addCardsToDeck`, `updateCard`, `deleteCard`, opérations FSRS — chacune **en `db.transaction`**, réutilisant `learningCardsRepository` + le pattern d'ownership `getDeckWithCardsOrThrow` (déjà existant), et mettant à jour `cardCount` **dans la même transaction** (fix du bug). Test : delete card → `cardCount` cohérent ; insert échoué → rollback.
- [ ] Ramener `card/fsrs/fsrs-extra.routes.ts` au pattern `deck.routes.ts` : auth (macro Phase 1) → service → `handleDeckDomainError`. Supprimer tous les `import { db }` + queries inline + checks ownership copiés-collés.
- [ ] Verify: `grep -rn "from '.*db/connection'" routes/learning` → 0. Tests learning verts.
- [ ] Commit: `refactor(server): move learning card/fsrs ops into LearningService (transactional, dedup ownership)`

---

# Phase 4 — Frontière `@repo/api` via `.d.ts` buildé (PR5) 🟡 débloque le web

**Goal :** Les clients (web/mobile) ne typecheckent plus le **source serveur** ni les globals Bun. Débloque le data-layer web (Eden Treaty), parqué précédemment.

**Files:** `apps/server` (build d'un `.d.ts` du type `App`), `apps/server/package.json` (export `./app`), `packages/api/tsconfig.json` (retrait `bun-types`), `apps/web/tsconfig.json` (retrait du `types` ajouté en contournement).

### Tasks
- [ ] Ajouter un point d'entrée minimal `apps/server/src/app-type.ts` : `export type { App } from './app';`. Build `tsc --emitDeclarationOnly` → `dist/app-type.d.ts`. Étape ajoutée au `build` serveur + générée en dev (script `build:types`).
- [ ] `apps/server/package.json` : export `"./app"` → le `.d.ts` buildé (plus `src/app.ts`).
- [ ] Retirer `bun-types` du tsconfig de `@repo/api` et de `apps/web` (plus nécessaire). Verify: `pnpm --filter web typecheck` vert **sans** `types: ["bun-types"]`.
- [ ] Re-câbler le data-layer web parqué (`apps/web/lib/api.ts` + `SubscriptionStatusCard`) → build web vert. Test navigateur : la carte abonnement affiche les vraies données.
- [ ] Commit: `refactor(api): export built App declaration, decouple clients from server source`

---

# Phase 5 — Convention validation + reference models (PR6) 🟡

**Goal :** `t` (TypeBox) aux frontières HTTP comme source unique (type + runtime + OpenAPI + inférence Eden) ; Zod réservé au non-HTTP. Schémas partagés en **reference models** Elysia.

**Files:** `apps/server/src/schemas/validation.ts` → modèles `t`, `app.ts`/routeurs (`.model()`).

### Tasks
- [ ] Convertir les validateurs HTTP partagés de `schemas/validation.ts` (email, password complexité, schoolLevel…) de Zod → `t` (TypeBox). **Conserver Zod** pour : env (`env.ts`), parsing webhook manuel, `lib/ai/schemas/*` (sortie IA).
- [ ] Enregistrer les schémas partagés en reference models : `.model({ ... })`, référencés par nom dans les routes. Verify: OpenAPI/swagger expose les modèles ; Eden infère.
- [ ] Migration **incrémentale** : commencer par les enums/contraintes dupliqués (ex. `schoolLevel`). Pas de big-bang.
- [ ] Commit: `refactor(server): standardize HTTP validation on TypeBox t + reference models`

---

## Self-review
- **Couverture :** cleanup/code mort (Phase 0 + 3) ; sécu C1 (0), C2 (0), C3 (2), H1/H2/H3/H4/M3/M5/M7 (2) ; Elysia 100 % : macro auth (1), guard (1), `t`+reference models (5) ; archi : config unique (0), layering (3), frontière `@repo/api` (4) ; débloque web Eden (4). ✅
- **Anti-pansement :** Phase 0 et 3 **suppriment** le code mort/dupliqué (pas de contournement) ; config unique remplace les deux systèmes.
- **Anti-sur-ingénierie :** rate-limit distribué / DI / AsyncLocalStorage explicitement hors scope avec justification.
- **Cohérence noms :** `env` (singleton), `getCorsOrigins()`, `authMacro`/`auth: true`, `LearningService.{addCardsToDeck,updateCard,deleteCard}`, export `./app` → `.d.ts`. Réutilisés tels quels entre phases.
- **Ordre :** 0 (config, transverse) → 1 (auth, dépend de env) → 2 (sécu, dépend de env+auth) → 3 (layering, dépend de macro) → 4 (api boundary, indépendant) → 5 (validation, dépend de macro/guard). Chaque phase = PR verte autonome.
