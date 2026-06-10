# Dev Environment Architecture — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Faire de « lancer l'app complète en local » une expérience à une commande, déterministe et sans piège (fin du clash `:3000`, RAG fonctionnel par défaut, build context propre).

**Architecture:** Hybride — infra (`postgres`, `qdrant`, `ai-service`) en Docker via un `docker-compose.yml` à la racine ; apps (`server`, `web`, `landing`) sur l'host via Turbo ; mobile séparé (Expo). Orchestration par `pnpm setup` (one-time) + `pnpm dev`.

**Tech Stack:** Docker Compose v2 (`--wait`), Turborepo (`--filter`), pnpm scripts, Node script (`scripts/*.mjs`), Bun.

**Contrainte connue :** l'assistant ne peut pas lire les fichiers `.env*` (permission). Les tâches qui touchent au *contenu* des `.env.example` sont déléguées à Victor (cf. Task 6). Les scripts générés manipulent les `.env` à l'exécution (côté Victor), ce qui est hors permission.

---

## File Structure

| Fichier | Action | Responsabilité |
|---|---|---|
| `.dockerignore` | Create (racine) | Réduire le build context, exclure les secrets |
| `docker-compose.yml` | Move (`apps/server/` → racine) + edit | Infra dev partagée ; backend en profil `backend` |
| `scripts/dev.mjs` | Create | Orchestration `pnpm dev` (infra + wait + turbo) |
| `scripts/setup.mjs` | Create | Bootstrap one-time (.env, secret, migrations, préchauffe modèles) |
| `package.json` (racine) | Edit | Scripts `dev`, `setup`, `dev:down` |
| `apps/server/package.json` | Edit | Nettoyer les scripts `docker:*` obsolètes |
| `README.md` | Edit | Quick start cohérent |
| `apps/server/CLAUDE.md` | Edit | Corriger les commandes Docker (compose remonté) |
| `apps/curriculum/CLAUDE.md` | Edit | Corriger `cd apps/ai-service && docker compose up` (faux) |

---

## Task 0: Branche + commit de la Phase 1 tooling

**Files:** aucun nouveau — met au propre le working tree existant.

- [ ] **Step 1: Créer la branche dédiée depuis l'état courant**

L'état courant (`feat/qdrant-dev-compose`) contient déjà le commit Qdrant local (cohérent avec ce chantier) + les 4 fixes tooling non commités.

Run:
```bash
git status
git branch -m feat/dev-environment   # renomme la branche courante (qdrant fait partie du même chantier)
```
Expected: `git status` montre modifiés `lefthook.yml`, `.coderabbit.yaml`, `.github/workflows/ai-service.yml`, et non-suivis `.editorconfig`, `docs/superpowers/specs/...`, `docs/superpowers/plans/...`.

- [ ] **Step 2: Committer les fixes tooling (Phase 1)**

```bash
git add lefthook.yml .coderabbit.yaml .github/workflows/ai-service.yml .editorconfig
git commit -m "chore(ci): harden dev tooling (lint gate, coderabbit, editorconfig, ai-service ruff)"
```

- [ ] **Step 3: Committer la spec + le plan**

```bash
git add docs/superpowers/specs/2026-06-10-dev-environment-architecture-design.md docs/superpowers/plans/2026-06-10-dev-environment.md
git commit -m "docs(dev): spec + plan for hybrid dev environment architecture"
```

---

## Task 1: `.dockerignore` racine

**Files:**
- Create: `.dockerignore`

- [ ] **Step 1: Créer `/.dockerignore`**

```
# Dependencies
**/node_modules/
.pnpm-store/

# Python
**/.venv/
**/__pycache__/
**/.pytest_cache/
**/.ruff_cache/
**/.mypy_cache/

# Build outputs
**/dist/
**/.next/
**/build/
**/.turbo/
**/coverage/
**/*.tsbuildinfo

# Mobile
**/.expo/

# Env & secrets
**/.env
**/.env.*
!**/.env.example

# VCS / IDE / docs / AI
.git/
.gitignore
**/.vscode/
**/.idea/
.claude/
docs/
**/*.md
!**/package.json

# OS
**/.DS_Store
```

- [ ] **Step 2: Vérifier que le context est réduit et sans secret**

Run:
```bash
docker compose -f apps/server/docker-compose.yml build backend 2>&1 | grep -iE "transferring context|sending build context" | head
```
(à ce stade le compose est encore dans `apps/server/`)
Expected: la taille du context transféré est de l'ordre du Mo (plus les 2,5 Go observés).

Sanity (le `.dockerignore` exclut bien les `.env`) :
```bash
git check-ignore -v --no-index apps/server/.env || echo "NB: git n'ignore pas, mais docker oui via .dockerignore"
```

- [ ] **Step 3: Commit**

```bash
git add .dockerignore
git commit -m "build(docker): add root .dockerignore (build context = monorepo root)"
```

---

## Task 2: Déplacer le compose à la racine + réécrire les chemins + profil `backend`

**Files:**
- Move: `apps/server/docker-compose.yml` → `docker-compose.yml`
- Edit: `docker-compose.yml` (chemins relatifs + profils)

- [ ] **Step 1: Déplacer le fichier (préserve l'historique git)**

```bash
git mv apps/server/docker-compose.yml docker-compose.yml
```

- [ ] **Step 2: Réécrire les chemins relatifs (context désormais = racine)**

Appliquer EXACTEMENT ces remplacements dans `docker-compose.yml` :

Service `backend` :
- `context: ../..` → `context: .`
- `env_file:` `- .env` → `- apps/server/.env`
- volumes :
  - `- ./src:/app/apps/server/src:ro` → `- ./apps/server/src:/app/apps/server/src:ro`
  - `- ./drizzle:/app/apps/server/drizzle:ro` → `- ./apps/server/drizzle:/app/apps/server/drizzle:ro`
  - `- ./scripts:/app/apps/server/scripts:ro` → `- ./apps/server/scripts:/app/apps/server/scripts:ro`
  - `- ./tsconfig.json:/app/apps/server/tsconfig.json:ro` → `- ./apps/server/tsconfig.json:/app/apps/server/tsconfig.json:ro`
  - `- ./drizzle.config.ts:/app/apps/server/drizzle.config.ts:ro` → `- ./apps/server/drizzle.config.ts:/app/apps/server/drizzle.config.ts:ro`

Service `ai-service` :
- `context: ../ai-service` → `context: ./apps/ai-service`

Service `drizzle-studio` (volumes) :
- `- ./drizzle:/app/drizzle:ro` → `- ./apps/server/drizzle:/app/drizzle:ro`
- `- ./drizzle.config.ts:/app/drizzle.config.ts:ro` → `- ./apps/server/drizzle.config.ts:/app/drizzle.config.ts:ro`
- `- ./src/db:/app/src/db:ro` → `- ./apps/server/src/db:/app/src/db:ro`
- `- ./package.json:/app/package.json:ro` → `- ./apps/server/package.json:/app/package.json:ro`

(`qdrant`, `postgres`, `adminer`, `volumes:`, `networks:` : aucun chemin relatif, inchangés.)

- [ ] **Step 3: Mettre le backend en profil `backend` (opt-in, retiré du défaut)**

Dans le service `backend`, ajouter sous `container_name` (ou à côté de `networks`) :
```yaml
    profiles:
      - backend
```

- [ ] **Step 4: Vérifier la validité du compose et le démarrage par défaut**

Run:
```bash
docker compose config >/dev/null && echo "compose OK"
docker compose up -d --wait postgres qdrant
docker compose ps
```
Expected: `compose OK` ; `postgres` et `qdrant` `healthy` ; **`backend` absent** de `ps` (profil non activé).

```bash
docker compose --profile backend config --services | sort
```
Expected: liste incluant `backend` (le profil le révèle).

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml
git commit -m "refactor(docker): move compose to monorepo root, backend behind opt-in profile"
```

---

## Task 3: Script d'orchestration `pnpm dev`

**Files:**
- Create: `scripts/dev.mjs`
- Edit: `package.json` (racine)

- [ ] **Step 1: Créer `scripts/dev.mjs`**

```js
#!/usr/bin/env node
// Orchestration dev : infra Docker (détaché) -> attente des services critiques healthy -> apps host (Turbo).
import { spawnSync, spawn } from "node:child_process";

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: "inherit" });
  if (r.status !== 0) {
    console.error(`\n[dev] échec: ${cmd} ${args.join(" ")}`);
    process.exit(r.status ?? 1);
  }
}

console.log("[dev] démarrage de l'infra (postgres, qdrant, ai-service)…");
run("docker", ["compose", "up", "-d"]);

console.log("[dev] attente postgres + qdrant (healthy)…");
run("docker", ["compose", "up", "-d", "--wait", "--wait-timeout", "120", "postgres", "qdrant"]);

console.log("[dev] ai-service chauffe en arrière-plan ; lancement des apps (server, web, landing)…");
const turbo = spawn("pnpm", ["exec", "turbo", "run", "dev", "--filter=!tom-mobile"], { stdio: "inherit" });
turbo.on("exit", (code) => process.exit(code ?? 0));
```

- [ ] **Step 2: Câbler les scripts racine**

Dans `package.json` (racine), remplacer la ligne `"dev": "turbo run dev",` par :
```json
    "dev": "node scripts/dev.mjs",
    "dev:down": "docker compose down",
```
(Conserver `dev:web`, `dev:landing`, `dev:server`, `dev:mobile`, `dev:mobile:ios`, `dev:mobile:android` tels quels.)

- [ ] **Step 3: Vérifier l'orchestration (sans bloquer indéfiniment)**

Run:
```bash
node -e "process.exit(0)"   # sanity node
docker compose up -d --wait --wait-timeout 120 postgres qdrant && echo "infra OK"
pnpm exec turbo run dev --filter=!tom-mobile --dry-run=json | grep -o '"command":"[^"]*"' | head
```
Expected: `infra OK` ; le dry-run liste les tâches `dev` de `server`, `web`, `landing` mais **pas** `tom-mobile`.

- [ ] **Step 4: Commit**

```bash
git add scripts/dev.mjs package.json
git commit -m "feat(dev): single-command dev orchestration (infra + apps, mobile excluded)"
```

---

## Task 4: Script `pnpm setup` (bootstrap one-time)

**Files:**
- Create: `scripts/setup.mjs`
- Edit: `package.json` (racine) — ajouter `"setup"`

- [ ] **Step 1: Créer `scripts/setup.mjs`**

```js
#!/usr/bin/env node
// Bootstrap one-time idempotent du dev local.
import { spawnSync } from "node:child_process";
import { existsSync, copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", ...opts });
  if (r.status !== 0) { console.error(`[setup] échec: ${cmd} ${args.join(" ")}`); process.exit(r.status ?? 1); }
}

// 1. .env depuis .env.example (idempotent)
for (const app of ["apps/server", "apps/curriculum"]) {
  const env = `${app}/.env`, example = `${app}/.env.example`;
  if (!existsSync(env) && existsSync(example)) {
    copyFileSync(example, env);
    console.log(`[setup] créé ${env} depuis .env.example`);
  }
}

// 2. BETTER_AUTH_SECRET dans apps/server/.env (génère si absent/placeholder)
const serverEnvPath = "apps/server/.env";
if (existsSync(serverEnvPath)) {
  let content = readFileSync(serverEnvPath, "utf8");
  const secret = randomBytes(32).toString("base64");
  if (/^BETTER_AUTH_SECRET=\s*$/m.test(content) || !/^BETTER_AUTH_SECRET=/m.test(content)) {
    content = /^BETTER_AUTH_SECRET=/m.test(content)
      ? content.replace(/^BETTER_AUTH_SECRET=.*$/m, `BETTER_AUTH_SECRET=${secret}`)
      : content + `\nBETTER_AUTH_SECRET=${secret}\n`;
    writeFileSync(serverEnvPath, content);
    console.log("[setup] BETTER_AUTH_SECRET généré");
  }
}

// 3. Postgres up + extension vector + migrations
console.log("[setup] postgres…");
run("docker", ["compose", "up", "-d", "--wait", "--wait-timeout", "60", "postgres"]);
run("docker", ["exec", "tomai-postgres-dev", "psql", "-U", "tomai_dev", "-d", "tomai_dev",
  "-c", "CREATE EXTENSION IF NOT EXISTS vector;"]);
console.log("[setup] migrations Drizzle…");
run("bun", ["run", "db:migrate"], { cwd: "apps/server" });

// 4. Préchauffe ai-service (download ~3,5 Go la première fois)
console.log("[setup] préchauffe ai-service (download des modèles, peut prendre plusieurs minutes)…");
run("docker", ["compose", "up", "-d", "--wait", "--wait-timeout", "600", "ai-service"]);

console.log("\n[setup] terminé. Lance `pnpm dev`.");
```

- [ ] **Step 2: Ajouter le script**

Dans `package.json` (racine), ajouter après `"dev:down"` :
```json
    "setup": "node scripts/setup.mjs",
```

- [ ] **Step 3: Vérifier (idempotence)**

Run:
```bash
pnpm setup
pnpm setup   # 2e passage : ne doit rien recréer ni régénérer le secret
```
Expected: 1er passage exécute tout ; 2e passage saute la création `.env` et la génération du secret, postgres/ai-service déjà up, migrations « already applied ».

- [ ] **Step 4: Commit**

```bash
git add scripts/setup.mjs package.json
git commit -m "feat(dev): one-time idempotent setup (env, secret, migrations, model preheat)"
```

---

## Task 5: Nettoyer les scripts `docker:*` de `apps/server`

**Files:**
- Edit: `apps/server/package.json:48-55`

- [ ] **Step 1: Retirer/rediriger les scripts Docker obsolètes**

Le compose n'est plus dans `apps/server/`. Supprimer ces lignes de `apps/server/package.json` (orchestration désormais à la racine) :
```
"docker:up", "docker:down", "docker:logs", "docker:dev", "docker:studio", "docker:clean", "docker:restart"
```
Conserver `docker:build` mais corriger le contexte :
```json
    "docker:build": "docker build -f apps/server/Dockerfile -t tomai-backend:latest ../..",
```

- [ ] **Step 2: Vérifier qu'aucun de ces scripts n'est référencé ailleurs**

Run:
```bash
grep -rn "docker:up\|docker:dev\|docker:studio\|docker:restart\|docker:clean" --include="*.json" --include="*.md" --include="*.yml" . | grep -v node_modules
```
Expected: aucune référence résiduelle (sinon, mettre à jour les appelants).

- [ ] **Step 3: Commit**

```bash
git add apps/server/package.json
git commit -m "chore(server): drop stale docker:* scripts (compose now at root)"
```

---

## Task 6: `.env.example` (délégué — contrainte permission)

**Files:**
- Edit (par Victor): `apps/server/.env.example`, `apps/curriculum/.env.example`

> L'assistant ne peut pas lire les `.env*`. Cette tâche est **manuelle (Victor)** ou exécutée par un agent sans la restriction.

- [ ] **Step 1: Vérifier que `apps/server/.env.example` couvre toutes les variables du compose**

Liste de référence (issue de `docker-compose.yml` service `backend` + `apps/server/CLAUDE.md`) :
`NODE_ENV, PORT, LOG_LEVEL, DATABASE_URL, DATABASE_URL_EXTERNAL, CORS_ORIGINS, BETTER_AUTH_SECRET, BETTER_AUTH_URL, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, MISTRAL_API_KEY, QDRANT_URL, QDRANT_API_KEY, QDRANT_COLLECTION, AI_SERVICE_URL, AI_SERVICE_TOKEN, PRONOTE_ENCRYPTION_KEY, REVENUECAT_WEBHOOK_AUTH, SCALEWAY_*, OTEL_EXPORTER_OTLP_ENDPOINT, SENTRY_DSN`.
Pour le dev local host, `DATABASE_URL` doit pointer `localhost:5432`, `QDRANT_URL` `localhost:6333`, `AI_SERVICE_URL` `localhost:8001`.

- [ ] **Step 2: `BETTER_AUTH_SECRET=` doit être présent et vide** (placeholder), pour que `setup.mjs` le remplisse.

- [ ] **Step 3: Commit** (par Victor) — `docs(env): complete server/.env.example for local dev`

---

## Task 7: README + CLAUDE.md cohérents

**Files:**
- Edit: `README.md:5-14`
- Edit: `apps/server/CLAUDE.md` (section Commandes + RAG local)
- Edit: `apps/curriculum/CLAUDE.md` (commande ai-service)

- [ ] **Step 1: Réécrire le Quick Start du README**

Remplacer le bloc `## Quick Start` (lignes 5-14) par :
```markdown
## Quick Start

```bash
pnpm install        # Node 22+, pnpm 11+
pnpm setup          # one-time : .env, secret, postgres, migrations, modèles ai-service (~3,5 Go)
pnpm dev            # infra (Docker) + server :3000 + web :3002 + landing :3001
pnpm dev:mobile     # Expo mobile (8081), terminal séparé
```

Stop infra : `pnpm dev:down`. API docs : http://localhost:3000/swagger
```

- [ ] **Step 2: Corriger `apps/server/CLAUDE.md`**

Remplacer `docker compose up -d` (lancé depuis `apps/server`) par les commandes racine : `pnpm dev` (stack complète) ou `docker compose up -d postgres` (depuis la racine) pour postgres seul. Mettre à jour la section « RAG en local » : le compose est à la racine.

- [ ] **Step 3: Corriger `apps/curriculum/CLAUDE.md`**

Remplacer la mention fausse `cd apps/ai-service && docker compose up -d` par : `docker compose up -d ai-service` (depuis la racine du monorepo).

- [ ] **Step 4: Commit**

```bash
git add README.md apps/server/CLAUDE.md apps/curriculum/CLAUDE.md
git commit -m "docs(dev): align quick start + CLAUDE.md with root compose and pnpm dev/setup"
```

---

## Task 8: Vérification end-to-end

**Files:** aucun (validation).

- [ ] **Step 1: Stack complète depuis zéro**

Run:
```bash
pnpm dev:down
docker compose up -d --wait --wait-timeout 120 postgres qdrant && echo "infra healthy"
docker compose ps   # backend NE doit PAS apparaître
```
Expected: postgres + qdrant + ai-service présents, `backend` absent, pas d'erreur de port `:3000`.

- [ ] **Step 2: Pas de clash `:3000`**

Run (dans un terminal, puis Ctrl-C) :
```bash
pnpm dev
```
Expected: server (host) démarre sur `:3000` sans `EADDRINUSE` ; web `:3002` ; landing `:3001`. Aucun backend conteneurisé sur `:3000`.

- [ ] **Step 3: Validation tooling**

Run:
```bash
pnpm typecheck && pnpm lint
```
Expected: PASS (aucune régression introduite par les scripts/compose).

- [ ] **Step 4: Commit final éventuel + ouverture PR**

```bash
git push -u origin feat/dev-environment
gh pr create --base main --title "feat(dev): hybrid local dev environment (root compose, one-command up)" --body "Voir docs/superpowers/specs/2026-06-10-dev-environment-architecture-design.md"
```

---

## Self-Review

**Spec coverage :**
- §3 hybride → Task 2 (backend profil) + Task 3 (turbo host). ✔
- §4.1 compose racine + profils → Task 2. ✔
- §4.2 `.dockerignore` racine → Task 1. ✔
- §4.3 commandes → Task 3 (`dev`, `dev:down`) + Task 4 (`setup`). ✔
- §4.4 env & secrets → Task 4 (setup) + Task 6 (.env.example, délégué). ✔
- §4.5 README → Task 7. ✔
- §1 clash :3000 → Task 8 step 2 (vérif). ✔

**Placeholder scan :** Task 6 est explicitement déléguée (contrainte permission documentée), pas un placeholder masqué. Le reste contient code/commandes exacts.

**Type/chemin consistency :** noms de services (`postgres`, `qdrant`, `ai-service`, `backend`), conteneur `tomai-postgres-dev`, package `tom-mobile`, ports (3000/3001/3002/5432/6333/8001) cohérents entre tâches et avec le compose lu.

**Gap connu :** Task 6 dépend de Victor (lecture `.env*` bloquée). Aucun autre gap.
