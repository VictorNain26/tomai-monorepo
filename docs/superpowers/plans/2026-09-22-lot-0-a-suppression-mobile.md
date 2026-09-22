# Lot 0, PR A — Suppression de apps/mobile et du billing RevenueCat

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Index du lot, contraintes globales, ordre des PR et étapes manuelles :** `docs/superpowers/plans/2026-09-22-lot-0-assainissement.md` — à lire avant ce plan.

**Specs :** `docs/superpowers/specs/2026-09-22-cible-v1.md`, `docs/superpowers/specs/2026-09-22-agent-ia.md`.

---

## PR A — Suppression de `apps/mobile` et du billing RevenueCat

**Branche :** `chore/remove-mobile-app`

**Objectif :** retirer du dépôt l'app Expo et tout ce qui n'existe que pour elle (webhook
RevenueCat, push tokens, plugin Better Auth Expo, miroir TS des tokens, outillage, CI,
overrides pnpm de la chaîne Expo), sans toucher au schéma de facturation que le lot 3 refait.

**Prérequis manuel (avant le merge, par l'utilisateur) :** le ruleset GitHub « Protect main »
(id `15514160`, lu le 2026-09-22 via `gh api repos/VictorNain26/tomai-monorepo/rulesets/15514160`)
exige les checks `typecheck`, `lint`, `Test`, `Build`, `Migration Sync`, `Expo deps check`,
`Mobile bundle`, `Dependency audit (prod, high+)`. La PR supprime les jobs `Expo deps check`
et `Mobile bundle` : sans retrait préalable, ils restent « Expected » et bloquent le merge.
Procédure : GitHub → Settings → Rules → Rulesets → « Protect main » → *Require status checks
to pass* → retirer `Expo deps check` et `Mobile bundle` → Save. À faire une fois la PR verte
sur les autres checks, juste avant le merge. Aucun agent ne modifie ce réglage.

**Ordre des tâches :** l'app est supprimée en premier. Le hook pre-commit lance
`turbo run typecheck --affected` ; tant que `apps/mobile` existe, toute suppression de route
serveur casse son typecheck (le client Eden lit les types du serveur) et bloque le commit.

**Fichiers touchés :**
- Supprimés : `apps/mobile/` (238 fichiers suivis, dont `.eas/workflows/`, `CLAUDE.md`,
  `e2e/`, `.maestro/`), `scripts/e2e-local.mjs`, `scripts/e2e-local.test.mjs`,
  `.claude/skills/mobile-device/SKILL.md`, `.npmrc`,
  `apps/server/src/routes/revenuecat-webhook.routes.ts`, `…/revenuecat-webhook.handler.ts`,
  `…/revenuecat-webhook-events.ts`, `apps/server/src/services/webhook-idempotence.service.ts`,
  `apps/server/src/services/billing/{index,billing.service,billing-types}.ts`,
  `apps/server/src/lib/plan-cache.ts`, `apps/server/src/routes/api/push-token.routes.ts`,
  `apps/server/src/db/repositories/push-tokens.repository.ts`,
  `apps/server/src/db/schema/notifications.schema.ts`, `apps/server/scripts/generate-eden-types.ts`,
  `apps/server/src/tests/{revenuecat-webhook,webhook-idempotence,billing.service}.test.ts`,
  `packages/tokens/src/{index,colors,colors.test,motion,motion.test}.ts`,
  `packages/tokens/tsconfig.json`, `packages/eslint-config/react.js`
- Modifiés : `package.json`, `turbo.json`, `lefthook.yml`, `knip.json`, `pnpm-workspace.yaml`,
  `pnpm-lock.yaml`, `scripts/dev.mjs`, `.github/workflows/ci.yml`, `.github/workflows/docker.yml`,
  `.github/renovate.json`, `.github/CODEOWNERS`, `.github/pull_request_template.md`,
  `.gitignore`, `.dockerignore`, `.vscode/extensions.json`, `docker-compose.yml`,
  `apps/server/{package.json,.env.example,Dockerfile,CLAUDE.md,README.md}`,
  `apps/server/src/{app.ts,config/env.ts,config/database-url.ts,lib/auth.ts,schemas/validation.ts}`,
  `apps/server/src/middleware/rate-limit.middleware.ts`, `apps/server/src/routes/api/index.ts`,
  `apps/server/src/routes/subscription/{index,status.routes}.ts`, `apps/server/src/config/app-guide/app-guide-data.ts`,
  `apps/server/src/db/schema.ts`, `apps/server/src/db/schema/{index,auth.schema,billing.schema}.ts`,
  `apps/server/src/tests/{auth-config,rate-limit}.test.ts`, `apps/server/src/tests/_helpers/fixtures.ts`,
  `apps/server/src/integration-tests/api-endpoints.test.ts`,
  `packages/api/src/{client,config,index,types}.ts`, `packages/tokens/{package.json,theme.css,theme-dark.css}`,
  `packages/eslint-config/package.json`, `CLAUDE.md`, `README.md`, `apps/landing/CLAUDE.md`,
  `.claude/settings.json`, `.claude/rules/{design-system,testing-and-commits}.md`,
  `.claude/skills/verify/SKILL.md`
- Créés : `apps/server/src/tests/app-guide-data.test.ts` (A.2), `apps/server/drizzle/0027_<nom généré>.sql` + `drizzle/meta/0027_snapshot.json` +
  `drizzle/meta/_journal.json` (générés par `db:generate`, tâche A.6)

---

### Tâche A.1 — Suppression de `apps/mobile`, de sa CI et de son outillage

**Files:**
- Delete: `apps/mobile/` (tout), `scripts/e2e-local.mjs`, `scripts/e2e-local.test.mjs`
- Modify: `package.json:14-16,20,26,33` ; `turbo.json:42-49,79-90` ; `lefthook.yml:17-21` ;
  `scripts/dev.mjs:3,31` ; `knip.json:31-47` ; `.github/workflows/ci.yml:233-283` ;
  `.github/renovate.json:25,94-120,126-130,178-184,198-202` ; `.github/CODEOWNERS:11-13` ;
  `.github/pull_request_template.md:18` ; `.gitignore:39-44` ; `.dockerignore:23-25` ;
  `.vscode/extensions.json:7-8` ; `pnpm-lock.yaml` (régénéré)

**Interfaces:**
- Consumes : rien.
- Produces : workspace sans le package `tom-mobile` ; scripts racine `dev:mobile*`,
  `build:mobile`, `test:mobile`, `e2e:local` supprimés ; tâches turbo `dev:ios`/`dev:android`
  supprimées.

Toutes les modifications de cette tâche sont des retraits d'entrées dans des configs
existantes ; aucune nouvelle option n'est introduite (turbo, lefthook, knip, renovate,
GitHub Actions).

- [x] **Preuve qu'aucun autre workspace n'importe l'app.**
  `git grep -n "tom-mobile\|apps/mobile" -- ':!apps/mobile' ':!pnpm-lock.yaml'`
  Attendu : uniquement les fichiers de config/doc listés dans cette tâche et en A.7
  (`package.json`, `scripts/dev.mjs`, `scripts/e2e-local*.mjs`, `knip.json`, `lefthook.yml`,
  `.github/*`, `apps/server/scripts/generate-eden-types.ts`, `CLAUDE.md`, `README.md`,
  `.claude/*`, `packages/api/src/index.ts`, `packages/tokens/theme.css`). Aucun import de code.

- [x] **Supprimer l'app et le script E2E Maestro** (retrait versionné, l'historique git le garde) :
  ```bash
  git rm -r -q apps/mobile scripts/e2e-local.mjs scripts/e2e-local.test.mjs
  ```
  Puis, **après confirmation explicite de l'utilisateur** (suppression hors git :
  `node_modules`, `.expo`, builds natifs, `.env` locale) : `rm -rf apps/mobile`.

- [x] **`package.json`** : supprimer les lignes 14-16 (`dev:mobile`, `dev:mobile:ios`,
  `dev:mobile:android`), 20 (`build:mobile`), 26 (`test:mobile`), 33 (`e2e:local`).

- [x] **`turbo.json`** : supprimer les tâches `dev:ios` et `dev:android` (lignes 42-49) et
  réduire les `inputs` de `test` aux seuls fichiers qui existent encore (plus de Jest, plus
  de `.test.tsx` hors mobile — vérifié : `git ls-files | grep -v ^apps/mobile/ | grep -E '\.test\.tsx$|__tests__|jest\.config'` est vide) :
  ```json
      "test": {
        "inputs": [
          "$TURBO_DEFAULT$",
          "**/*.test.ts"
        ],
        "outputs": ["coverage/**"],
        "env": ["NODE_ENV", "CI"],
        "passThroughEnv": ["DATABASE_URL", "BETTER_AUTH_SECRET"]
      }
  ```

- [x] **`lefthook.yml`** : supprimer le job `lint-mobile` (lignes 17-21, bloc et ligne vide).

- [x] **`scripts/dev.mjs`** : ligne 3, remplacer `apps host (Turbo, mobile exclu)` par
  `apps host (Turbo)` ; ligne 31 :
  ```js
  const turbo = spawn("pnpm", ["exec", "turbo", "run", "dev"], {
  ```

- [x] **`knip.json`** : supprimer le bloc `"apps/mobile": { … }` (lignes 31-47).

- [x] **`.github/workflows/ci.yml`** : supprimer les jobs 7 `expo-deps` et 8 `mobile-bundle`
  (lignes 233-283, de la bannière `# Job 7` à la fin du fichier). Le fichier se termine
  alors sur le job `monorepo-lint` (ligne 231).

- [x] **`.github/renovate.json`** : supprimer `"**/.expo/**",` (l. 25) ; supprimer les
  `packageRules` « Group all Expo packages », « React Navigation », « React Native core »,
  « RN Reusables primitives » (l. 94-120), « TanStack Query » (l. 126-130, `@tanstack/*`
  n'est importé que par le mobile : `git grep -n "@tanstack" -- apps/server apps/landing packages`
  est vide), « RevenueCat SDK » (l. 178-184) ; remplacer la règle React (l. 198-202) par :
  ```json
      {
        "description": "Pin React + React DOM together (catalog-managed).",
        "matchPackageNames": ["react", "react-dom"],
        "groupName": "react"
      }
  ```

- [x] **`.github/CODEOWNERS`** : supprimer le bloc `# Mobile` (l. 11-13).
  **`.github/pull_request_template.md`** : supprimer `- [x] Tested on mobile if UI change` (l. 18).
  **`.gitignore`** : supprimer le bloc `# Expo` (l. 39-44 : `.expo/`, `.expo-shared/`,
  `web-build/`, `.metro-health-check*` et la ligne vide en trop).
  **`.dockerignore`** : supprimer `# Mobile` / `**/.expo/` et la ligne vide (l. 23-25).
  **`.vscode/extensions.json`** : supprimer `"expo.vscode-expo-tools"` et la virgule de la
  ligne 7.

- [x] **Lockfile :** `pnpm install` à la racine. Attendu : exit 0, l'importer `apps/mobile`
  disparaît de `pnpm-lock.yaml`. (Simulé le 2026-09-22 sur une copie du dépôt :
  `pnpm install --lockfile-only` → exit 0, ~9 000 lignes retirées, aucun changement de
  version hors suffixes de peers.)

- [x] **Validation :**
  ```bash
  pnpm typecheck && pnpm lint && pnpm test && pnpm run test:scripts && pnpm exec knip && npx sherif@1.13.0
  ```
  Attendu : exit 0 pour chaque commande.

- [x] **Commit :**
  ```bash
  git add package.json turbo.json lefthook.yml knip.json scripts/dev.mjs pnpm-lock.yaml
  git add .github/workflows/ci.yml .github/renovate.json .github/CODEOWNERS .github/pull_request_template.md
  git add .gitignore .dockerignore .vscode/extensions.json
  git status --short   # les suppressions git rm sont déjà indexées ; rien d'autre ne doit apparaître
  git commit -m "chore(mobile): remove the Expo app and its CI and tooling

  Co-Authored-By: Claude <noreply@anthropic.com>"
  ```

---

### Tâche A.2 — Serveur : webhook RevenueCat et billing qu'il pilotait

**Files:**
- Delete: `apps/server/src/routes/revenuecat-webhook.routes.ts`, `…/revenuecat-webhook.handler.ts`,
  `…/revenuecat-webhook-events.ts`, `apps/server/src/services/webhook-idempotence.service.ts`,
  `apps/server/src/services/billing/index.ts`, `…/billing.service.ts`, `…/billing-types.ts`,
  `apps/server/src/lib/plan-cache.ts`, `apps/server/src/tests/revenuecat-webhook.test.ts`,
  `apps/server/src/tests/webhook-idempotence.test.ts`, `apps/server/src/tests/billing.service.test.ts`
- Modify: `apps/server/src/app.ts:20,96-100,124,220` ; `apps/server/src/config/env.ts:58-59,132-134` ;
  `apps/server/src/config/database-url.ts:8` ; `apps/server/src/schemas/validation.ts:141-185` ;
  `apps/server/src/tests/_helpers/fixtures.ts:108-137` ;
  `apps/server/src/middleware/rate-limit.middleware.ts:15-17,108-116` ;
  `apps/server/src/tests/rate-limit.test.ts:193-219` (fin de fichier) ;
  `apps/server/src/integration-tests/api-endpoints.test.ts:233` ;
  `apps/server/src/routes/subscription/index.ts:1-10` ; `…/subscription/status.routes.ts:4` ;
  `apps/server/.env.example:63-69` ; `docker-compose.yml:41-43` ;
  `apps/server/src/config/app-guide/app-guide-data.ts:34-45,63-77,85,95-102,111-123,133-136`
- Create: `apps/server/src/tests/app-guide-data.test.ts`

**Interfaces:**
- Consumes : `getAppHelpContent(topic: string, role: 'student' | 'parent'): string | null`
  (`config/app-guide/app-guide-data.ts:148`, signature inchangée).
- Produces : plus de route `POST /webhooks/revenuecat` ; `env.REVENUECAT_WEBHOOK_AUTH` et
  le contrôle de prod associé disparaissent ; `RateLimitConfig` perd `skipPaths?: string[]`.
  `GET /api/subscriptions/status` et `/usage` restent (lecture de `family_billing` /
  `user_subscriptions`), contrat Eden inchangé.

Constat vérifié : `services/billing/` n'a qu'un consommateur, `revenuecat-webhook-events.ts`
(`grep -rln "services/billing" apps/server/src` → events + ses tests) ; `lib/plan-cache.ts` n'a
que `billing.service.ts` ; `webhook-idempotence.service.ts` n'a que le handler (son
`cleanupExpired` n'est appelé nulle part) ; `skipPaths` n'est passé qu'une fois, pour
`/webhooks/` (`app.ts:100`). Conséquence assumée : plus rien n'écrit un plan premium tant que
le lot 3 n'a pas branché le paiement web (aucun utilisateur, app hors production).

- [x] **Preuve de périmètre avant suppression :**
  ```bash
  cd apps/server && grep -rn "revenuecat-webhook\|services/billing\|plan-cache\|webhook-idempotence\|skipPaths\|revenueCatWebhookSchema\|makeRevenueCatEvent" src --include=*.ts | grep -v "^src/routes/revenuecat-webhook\|^src/services/billing/\|^src/services/webhook-idempotence\|^src/lib/plan-cache\|^src/tests/revenuecat-webhook\|^src/tests/webhook-idempotence\|^src/tests/billing.service"
  ```
  Attendu : exactement `app.ts:20`, `app.ts:100`, `middleware/rate-limit.middleware.ts` (17, 110, 112),
  `tests/rate-limit.test.ts` (194-215), `schemas/validation.ts:159`, `tests/_helpers/fixtures.ts:108`,
  `integration-tests/api-endpoints.test.ts:233`. Ce sont les points modifiés ci-dessous.

- [x] **Supprimer les modules :**
  ```bash
  git rm -q apps/server/src/routes/revenuecat-webhook.routes.ts apps/server/src/routes/revenuecat-webhook.handler.ts apps/server/src/routes/revenuecat-webhook-events.ts apps/server/src/services/webhook-idempotence.service.ts apps/server/src/services/billing/index.ts apps/server/src/services/billing/billing.service.ts apps/server/src/services/billing/billing-types.ts apps/server/src/lib/plan-cache.ts apps/server/src/tests/revenuecat-webhook.test.ts apps/server/src/tests/webhook-idempotence.test.ts apps/server/src/tests/billing.service.test.ts
  ```

- [x] **`app.ts`** : supprimer l'import ligne 20 (`revenuecatWebhookRoutes`), la ligne 124
  (`webhooks: '/webhooks/revenuecat',`), la ligne 220 (`.use(revenuecatWebhookRoutes) …`).
  Remplacer les lignes 96-100 par :
  ```ts
    // Rate Limiting Global - Protection DDoS et brute-force
    .onBeforeHandle(createRateLimitMiddleware(RateLimitPresets.api))
  ```

- [x] **`middleware/rate-limit.middleware.ts`** : supprimer de `RateLimitConfig` les lignes
  15-17 (commentaire + `skipPaths?: string[];`) et, dans `rateLimitMiddleware`, le bloc
  lignes 108-116 (commentaire `// Exempt configured path prefixes…`, le
  `if (finalConfig.skipPaths?.length) { … }` et la ligne vide 116).
  **`tests/rate-limit.test.ts`** : supprimer le `describe('createRateLimitMiddleware — skipPaths (webhook exemption)', …)`
  (lignes 193-219, ligne vide 193 comprise ; le fichier se termine ligne 192 sur `});`).

- [x] **`config/env.ts`** : supprimer les lignes 58-59 (commentaire + `REVENUECAT_WEBHOOK_AUTH`)
  et 132-134 (le `if (!result.data.REVENUECAT_WEBHOOK_AUTH) { … }` et la ligne vide qui suit).
  **`config/database-url.ts:8`** :
  ```ts
   * 1. migrate.ts: Runs before app boot, doesn't have BETTER_AUTH_SECRET, PRONOTE_ENCRYPTION_KEY, etc.
  ```

- [x] **`schemas/validation.ts`** : supprimer le bloc « SCHÉMAS WEBHOOK REVENUECAT » (de la
  bannière ligne 141 à la fermeture `});` ligne 183, plus les lignes vides 184-185).
  **`tests/_helpers/fixtures.ts`** : supprimer `makeRevenueCatEvent` (lignes 108-136 et la
  ligne vide 137).
  **`integration-tests/api-endpoints.test.ts`** : supprimer la ligne 233
  (`mock.module('../routes/revenuecat-webhook.routes', …)`).

- [x] **`routes/subscription/index.ts`** lignes 1-10 :
  ```ts
  /**
   * Subscription Routes Module
   *
   * Read-only family subscription status. No payment provider is wired: the
   * web payment flow arrives with lot 3.
   *
   * Only PARENTS can view their subscription status.
   */
  ```
  **`routes/subscription/status.routes.ts:4`** :
  ```ts
   * GET /api/subscriptions/status - Get subscription status (DB-driven)
  ```

- [x] **`apps/server/.env.example`** : supprimer le bloc « Payments — RevenueCat webhooks »
  (lignes 63-69, bannière, commentaires, `REVENUECAT_WEBHOOK_AUTH=` et ligne vide).
  **`docker-compose.yml`** lignes 41-43 :
  ```yaml
        # Les secrets (BETTER_AUTH_SECRET, GOOGLE_*, MISTRAL_API_KEY,
        # PRONOTE_ENCRYPTION_KEY) viennent d'env_file :
        # les lister en ${VAR} ici les écraserait (environment > env_file).
  ```

- [x] **Contenu d'aide de l'agent (`get_app_help`) — test qui échoue.**
  `apps/server/src/config/app-guide/app-guide-data.ts` alimente l'outil `get_app_help`
  (`services/chat/tool-executor.ts:182` → `getAppHelpContent(topic, role)`), que la description
  de l'outil rend obligatoire pour toute question sur l'app (`chat-tools.ts:123-126`). Il affirme
  « Paiement securise via App Store ou Play Store » (l. 121) et décrit l'UI mobile : onglets en bas
  d'écran et badge (l. 35-44, 66-76, 136), bouton « + » appareil photo/galerie (l. 97), « son
  application » (l. 85). Vérifié : aucune mention de notifications push ni de caméra native
  ailleurs. Aucun test ne lit ce contenu : `tool-executor.test.ts:84` et
  `tool-executor-profile.test.ts:70` mockent `getAppHelpContent`. On crée donc
  `apps/server/src/tests/app-guide-data.test.ts` :
  ```ts
  import { describe, expect, it } from 'bun:test';
  import { getAppHelpContent } from '../config/app-guide/app-guide-data';

  const TOPICS = [
    'overview',
    'navigation',
    'chat',
    'flashcards',
    'pronote',
    'files',
    'subscription',
    'profile',
  ] as const;
  const ROLES = ['student', 'parent'] as const;
  const MOBILE_ONLY = [
    /app store/i,
    /play store/i,
    /google play/i,
    /revenuecat/i,
    /onglet/i,
    /en bas de l'ecran/i,
    /appareil photo/i,
    /galerie/i,
    /badge/i,
  ];

  describe('app guide content served by get_app_help', () => {
    for (const topic of TOPICS) {
      for (const role of ROLES) {
        it(`${topic}/${role} describes no mobile-only UI or store payment`, () => {
          const content = getAppHelpContent(topic, role);
          expect(content).not.toBeNull();
          for (const pattern of MOBILE_ONLY) {
            expect(content).not.toMatch(pattern);
          }
        });
      }
    }

    it.each(ROLES)('subscription/%s says the online subscription is not available yet', (role) => {
      expect(getAppHelpContent('subscription', role)).toContain("pas encore disponible en ligne");
    });
  });
  ```
  `it.each` : `apps/server/node_modules/bun-types/test.d.ts:569-571` (`each<…>(table): Test<…>`
  sur l'interface `Test`, l. 468).

- [x] **Voir l'échec :** `cd apps/server && bun test src/tests/app-guide-data.test.ts`
  Attendu : échecs sur `navigation/*` (onglet), `flashcards/*` (onglet, badge), `files/student`
  (appareil photo, galerie), `subscription/parent` (App Store, Play Store), `profile/parent`
  (onglet) et les deux tests « pas encore disponible en ligne ».

- [x] **Implémentation — `app-guide-data.ts`.** Le client web n'existe pas encore (lot 3) : le
  texte décrit des espaces et des fonctions, pas une disposition d'écran, et ne promet aucun
  parcours de paiement. Remplacer les entrées suivantes de `APP_GUIDE` (le reste du fichier est
  inchangé) :
  ```ts
    navigation: {
      student: `L'application est organisee en quatre espaces :
  - Accueil : ton tableau de bord avec suggestions personnalisees
  - Tom : ta conversation avec l'assistant (espace principal)
  - Revisions : tes decks de flashcards et le nombre de cartes a revoir
  - Profil : tes informations, Pronote, classeur de fichiers et parametres`,
      parent: `L'espace parent est organise en deux parties :
  - Accueil : la liste de vos enfants, leurs statistiques et la gestion Pronote
  - Profil : parametres du compte et abonnement
  Depuis Accueil, vous pouvez ajouter des enfants, voir leur progression et connecter Pronote.`,
    },
  ```
  ```ts
    flashcards: {
      student: `Les flashcards t'aident a reviser efficacement :
  - Tom cree des cartes quand tu demandes de reviser un sujet
  - Tes cartes apparaissent dans l'espace Revisions
  - Le systeme de repetition espacee te montre les cartes au bon moment
  - Apres chaque carte, indique si c'etait facile ou difficile
  - Les cartes que tu rates reviennent plus souvent
  - Tu peux aussi creer tes propres decks depuis l'espace Revisions
  L'espace Revisions t'indique combien de cartes sont a revoir.`,
      parent: `Le systeme de flashcards utilise la repetition espacee (algorithme FSRS) :
  - Les cartes sont creees depuis les conversations ou manuellement par l'enfant
  - Chaque carte s'adapte au rythme de memorisation de l'enfant
  - Les matieres en difficulte (basees sur les notes Pronote) sont priorisees
  - L'enfant retrouve ses decks et ses cartes dues dans l'espace Revisions`,
    },
  ```
  Dans `pronote.student`, dernière ligne :
  ```ts
  Si Pronote n'est pas connecte, demande a ton parent de le faire depuis son espace.`,
  ```
  ```ts
    files: {
      student: `Tu peux envoyer des fichiers a Tom dans le chat :
  - Joins une photo, un document ou un fichier de ton classeur a ton message
  - Formats acceptes : photos (JPG, PNG, WebP, HEIC), documents (PDF, Word, texte)
  - Tom analyse l'image ou le document et t'aide dessus
  - Tes fichiers sont sauvegardes dans "Mon Classeur" (Profil > Mon Classeur)
  - Tu peux reutiliser un fichier du classeur dans une nouvelle conversation
  Tes fichiers sont stockes de facon securisee et restent prives.`,
  ```
  (`files.parent` inchangé.)
  ```ts
    subscription: {
      student: `Ton abonnement Tom :
  - La version gratuite a un nombre limite de messages par jour
  - L'abonnement Premium n'est pas encore disponible en ligne
  Tu peux voir ton utilisation dans Profil.`,
      parent: `Abonnement Tom :
  - Version gratuite : nombre de messages limite par jour
  - L'abonnement Premium n'est pas encore disponible en ligne : il n'existe aujourd'hui aucun moyen de paiement
  - Un seul abonnement couvrira tous les enfants rattaches a votre compte
  Ne propose aucune demarche de paiement : il n'y en a pas encore.`,
    },
  ```
  Dans `profile.parent`, remplacer `Depuis l'onglet Accueil vous pouvez :` par
  `Depuis l'espace Accueil vous pouvez :` et `- Gerer votre abonnement (gratuit ou Premium)` par
  `- Voir votre formule (gratuite ; Premium pas encore disponible en ligne)`.

- [x] **Voir passer :** `cd apps/server && bun test src/tests/app-guide-data.test.ts` → tous verts.
  Puis `bun test src/tests/tool-executor.test.ts src/tests/chat-tools.test.ts` → verts (ils
  mockent le contenu, inchangés).

- [x] **Validation serveur :**
  ```bash
  cd apps/server && bun run typecheck && bun run lint && bun run test && bun run test:integration
  ```
  (`test:integration` exige postgres : `docker compose up -d --wait postgres` à la racine et
  `DATABASE_URL` de `apps/server/.env`.) Attendu : exit 0 partout.

- [x] **Commit :**
  ```bash
  git add apps/server/src/app.ts apps/server/src/middleware/rate-limit.middleware.ts apps/server/src/tests/rate-limit.test.ts
  git add apps/server/src/config/env.ts apps/server/src/config/database-url.ts apps/server/src/schemas/validation.ts
  git add apps/server/src/tests/_helpers/fixtures.ts apps/server/src/integration-tests/api-endpoints.test.ts
  git add apps/server/src/routes/subscription/index.ts apps/server/src/routes/subscription/status.routes.ts
  git add apps/server/.env.example docker-compose.yml
  git add apps/server/src/config/app-guide/app-guide-data.ts apps/server/src/tests/app-guide-data.test.ts
  git commit -m "refactor(server): remove the RevenueCat webhook and the billing it drove

  Co-Authored-By: Claude <noreply@anthropic.com>"
  ```

---

### Tâche A.3 — Serveur : push tokens, plugin Better Auth Expo, origines mobiles

**Files:**
- Delete: `apps/server/src/routes/api/push-token.routes.ts`,
  `apps/server/src/db/repositories/push-tokens.repository.ts`, `apps/server/scripts/generate-eden-types.ts`
- Modify: `apps/server/src/routes/api/index.ts:7,27` ; `apps/server/src/lib/auth.ts:1-18,33,196` ;
  `apps/server/src/config/env.ts` (bloc `getCorsOrigins` l. 176-181, `getTrustedOrigins` l. 210-230,
  numéros avant A.2) ; `apps/server/src/app.ts:65-66` ; `apps/server/src/db/schema/auth.schema.ts:21` ;
  `apps/server/src/tests/auth-config.test.ts:6,53` + nouveaux tests ;
  `apps/server/src/integration-tests/api-endpoints.test.ts:70,235-256` ; `apps/server/package.json:55` ;
  `pnpm-lock.yaml`

**Interfaces:**
- Consumes : `getCorsOrigins(): string[]` (`config/env.ts`, inchangée).
- Produces : `getTrustedOrigins` supprimée ; `auth.options.trustedOrigins === getCorsOrigins()`
  (plus de `tomia://` ni `exp://`) ; plus d'endpoint Better Auth `/expo-authorization-proxy`
  ni de réécriture d'origine par l'en-tête `expo-origin` ; plus de `POST|DELETE /api/users/push-token`
  dans le type `App`.

Doc-first :
- Plugin Expo côté serveur — `apps/server/node_modules/@better-auth/expo/dist/index.d.ts:21-39`
  (endpoint `expoAuthorizationProxy` `GET /expo-authorization-proxy`, `onRequest`, `init` qui
  ajoute `trustedOrigins`) et `dist/index.js:40-51` (`exp://` en dev, origine recopiée depuis
  l'en-tête `expo-origin`). Rien de cela ne sert un client web.
- `auth.options` — `better-auth@1.6.23` `dist/types/auth.d.mts:9-12` (`options: Options`) ;
  `trustedOrigins?: string[] | …` — `@better-auth/core@1.6.23` `dist/types/init-options.d.mts:1116`.

- [x] **Test qui échoue** — ajouter à la fin du `describe('Better Auth Configuration', …)` de
  `apps/server/src/tests/auth-config.test.ts` (avant la dernière ligne `});`) :
  ```ts
    describe('Web-only client surface', () => {
      it('trusts only the HTTP CORS origins', () => {
        const options = auth.options as { trustedOrigins: string[] };
        expect(options.trustedOrigins).toEqual(['http://localhost:3000', 'http://localhost:3001']);
      });

      it('does not mount the Expo authorization proxy', () => {
        expect(apiMethods).not.toContain('expoAuthorizationProxy');
      });
    });
  ```

- [x] **Voir l'échec :** `cd apps/server && bun test src/tests/auth-config.test.ts`
  Attendu : 2 échecs — `trustedOrigins` reçoit `[…, 'tomia://', 'exp://']` (mock de
  `getTrustedOrigins` l. 53) et `apiMethods` contient `expoAuthorizationProxy`.

- [x] **Constat de départ sur le contrat Eden :**
  `cd apps/server && bun run build:types && grep -c "push-token" dist/types/app.d.ts; grep -c "expo-authorization-proxy" dist/types/lib/auth.d.ts`
  Attendu : `2` puis `1` (vérifié le 2026-09-22).

- [x] **Implémentation.**
  Supprimer :
  ```bash
  git rm -q apps/server/src/routes/api/push-token.routes.ts apps/server/src/db/repositories/push-tokens.repository.ts apps/server/scripts/generate-eden-types.ts
  ```
  (`generate-eden-types.ts` n'est référencé par aucun script ni doc — `git grep -n generate-eden-types`
  ne renvoie que lui-même — et n'avait pour but que de copier les types vers `apps/mobile` ;
  `build:types` l'a remplacé.)

  `routes/api/index.ts` : supprimer l'import ligne 7 et `.use(pushTokenApiRoutes)` ligne 27.

  `lib/auth.ts` lignes 1-18 :
  ```ts
  /**
   * Better Auth Configuration - Production Ready
   * Configuration propre et flexible basée sur la configuration centralisée
   *
   * Plugins:
   * - openAPI: API documentation
   * - mcp: Model Context Protocol
   * - username: Autonomous child login
   */

  import { betterAuth, type BetterAuthPlugin } from "better-auth";
  import { openAPI, mcp, username } from "better-auth/plugins";
  import { drizzleAdapter } from "better-auth/adapters/drizzle";
  import { db } from "../db/connection";
  import { user, session, account, verification } from "../db/schema";
  import { env, isProduction, isDevelopment, getCorsOrigins } from "../config/env";
  import { logger } from "./observability";
  ```
  ligne 33 : `const trustedOrigins = getCorsOrigins();` ; supprimer la ligne 196
  (`expo(),     // Mobile app support (deep links, secure storage)`).

  `config/env.ts` : supprimer la dernière ligne du JSDoc de `getCorsOrigins`
  (` * Single source of truth for HTTP origins — no mobile schemes here`) et toute la
  fonction `getTrustedOrigins` avec son JSDoc et la ligne vide qui la précède ; le fichier
  se termine sur la `}` de `getCorsOrigins`.

  `app.ts` lignes 65-66 :
  ```ts
        // Set-Cookie intentionally NOT exposed: JavaScript must not be able to read
        // session cookies cross-origin.
  ```

  `db/schema/auth.schema.ts:21` (commentaire seul, aucun effet sur la migration) :
  ```ts
   * Configuration alignée avec Better Auth + plugin username
  ```

  `tests/auth-config.test.ts` : supprimer la ligne 6 (` * - Expo plugin (mobile deep links)`)
  et la ligne 53 (`getTrustedOrigins: …`).

  `integration-tests/api-endpoints.test.ts` : supprimer la ligne 70 (`getTrustedOrigins: …`) ;
  remplacer les lignes 235-257 par :
  ```ts
  // DB schema + repositories (dynamic imports in apiRoutes)
  // The mock must spread all real sub-modules so that other integration tests
  // sharing this Bun process (single module registry) can still import named
  // exports such as `pronoteCredentials`, `user`, `parentChild`, etc.
  import * as authSchema from '../db/schema/auth.schema';
  import * as learningSchema from '../db/schema/learning.schema';
  import * as pronoteSchema from '../db/schema/pronote.schema';
  import * as billingSchema from '../db/schema/billing.schema';
  import * as filesSchema from '../db/schema/files.schema';
  import * as learningToolsSchema from '../db/schema/learning-tools.schema';
  mock.module('../db/schema', () => ({
    ...authSchema,
    ...learningSchema,
    ...pronoteSchema,
    ...billingSchema,
    ...filesSchema,
    ...learningToolsSchema,
  }));
  ```
  (Le bloc est conservé plutôt que supprimé : le mock partiel de `drizzle-orm` du même
  fichier rend incertain le chargement réel de `db/schema.ts`, qui tire les `relations` ;
  seul l'override `devicePushTokens` n'a plus de raison d'être.)

  `apps/server/package.json` : supprimer la ligne 55 (`"@better-auth/expo": "^1.6.23",`),
  puis `pnpm install` à la racine (le lockfile perd `@better-auth/expo` et toute la chaîne
  `expo`/`@expo/*` qu'il tirait — `pnpm why @xmldom/xmldom` le montre aujourd'hui via
  `@better-auth/expo → expo-constants → expo`).

- [x] **Voir passer :**
  ```bash
  cd apps/server && bun test src/tests/auth-config.test.ts
  bun run build:types && grep -c "push-token" dist/types/app.d.ts; grep -c "expo-authorization-proxy" dist/types/lib/auth.d.ts
  bun run typecheck && bun run lint && bun run test && bun run test:integration
  ```
  Attendu : tests auth verts ; `0` et `0` pour les deux `grep -c` ; exit 0 pour le reste.

- [x] **Commit :**
  ```bash
  git add apps/server/src/routes/api/index.ts apps/server/src/lib/auth.ts apps/server/src/config/env.ts apps/server/src/app.ts
  git add apps/server/src/db/schema/auth.schema.ts apps/server/src/tests/auth-config.test.ts apps/server/src/integration-tests/api-endpoints.test.ts
  git add apps/server/package.json pnpm-lock.yaml
  git commit -m "refactor(auth): drop the Expo plugin, mobile origins and push-token routes

  Co-Authored-By: Claude <noreply@anthropic.com>"
  ```

---

### Tâche A.4 — Packages partagés : `@repo/api`, `@repo/tokens`, `@repo/eslint-config`

**Files:**
- Delete: `packages/tokens/src/index.ts`, `colors.ts`, `colors.test.ts`, `motion.ts`, `motion.test.ts`,
  `packages/tokens/tsconfig.json`, `packages/eslint-config/react.js`
- Modify: `packages/api/src/config.ts` (tout), `packages/api/src/client.ts:1-6,25-56,93-111`,
  `packages/api/src/index.ts:1-20,37`, `packages/api/src/types.ts:4` ;
  `packages/tokens/package.json` (tout), `packages/tokens/theme.css:1-6`, `packages/tokens/theme-dark.css:1-7` ;
  `packages/eslint-config/package.json:10` ; `knip.json` (bloc `packages/tokens`) ; `pnpm-lock.yaml`

**Interfaces:**
- Consumes : `treaty<App>(domain, config)` d'`@elysiajs/eden@1.4.9` — `Config` :
  `fetch?: Omit<RequestInit, 'headers' | 'method'>`, `headers?: …`, `onResponse?: …`
  (`packages/api/node_modules/@elysiajs/eden/dist/treaty2/types.d.ts:48-53`).
- Produces :
  - `interface ApiConfig { baseUrl: string }` ; `getApiConfig(): ApiConfig`.
  - `UPLOAD_CONFIG` et `ApiConfig.cookieProvider|defaultTimeout|uploadTimeout|chatTimeout` supprimés.
  - `@repo/tokens` n'exporte plus que `./theme.css` et `./theme-dark.css`.
  - `@repo/eslint-config` perd l'export `./react`.

Constats vérifiés : `@repo/api` n'a plus aucun consommateur après A.1
(`git grep -n "@repo/api" -- apps packages ':!packages/api'` ne renvoie que de la doc) ; il est
gardé pour `apps/web` (lot 3). `defaultTimeout`, `uploadTimeout`, `chatTimeout` ne sont lus
nulle part (`grep -rn "Timeout" packages/api/src` → seulement `config.ts`). Le TS de
`@repo/tokens` (`lightColors`, `darkColors`, `motionDurations`, `motionEasings`) n'était
importé que par le mobile (NativeWind, Reanimated) ; la landing ne consomme que les CSS
(`apps/landing/app/globals.css:2-3`). `eslint-config/react` n'était importé que par
`apps/mobile/eslint.config.mjs`.

- [x] **Preuve d'absence de consommateur :**
  ```bash
  git grep -n "UPLOAD_CONFIG\|cookieProvider\|uploadTimeout\|chatTimeout\|defaultTimeout" -- ':!packages/api'
  git grep -n "lightColors\|darkColors\|motionDurations\|motionEasings\|@repo/eslint-config/react\b" -- ':!packages/tokens' ':!packages/eslint-config'
  ```
  Attendu : aucune ligne.

- [x] **`packages/api/src/config.ts`** (fichier complet) :
  ```ts
  /**
   * @repo/api - Configuration API injectable
   *
   * @example
   * // Dans l'app (une seule fois au démarrage)
   * import { initializeApi } from '@repo/api/config';
   *
   * initializeApi({ baseUrl: 'https://api.tomia.fr' });
   */

  export interface ApiConfig {
    /** URL de base du backend API (ex: https://api.tomia.fr) */
    baseUrl: string;
  }

  let apiConfig: ApiConfig | null = null;

  /**
   * Initialise la configuration API.
   * DOIT être appelé une fois au démarrage de l'application.
   */
  export function initializeApi(config: ApiConfig): void {
    if (apiConfig !== null) {
      console.warn('[API] Configuration already initialized, skipping.');
      return;
    }

    apiConfig = config;
  }

  /**
   * Récupère l'URL de base du backend.
   *
   * @throws Error si l'API n'est pas initialisée
   */
  export function getBaseUrl(): string {
    return getApiConfig().baseUrl;
  }

  /**
   * Récupère la configuration complète.
   *
   * @throws Error si l'API n'est pas initialisée
   */
  export function getApiConfig(): ApiConfig {
    if (!apiConfig) {
      throw new Error(
        '[API] Not initialized. Call initializeApi() at app startup.'
      );
    }
    return apiConfig;
  }

  /**
   * Réinitialise la configuration (utile pour les tests).
   * @internal
   */
  export function resetApiConfig(): void {
    apiConfig = null;
  }
  ```

- [x] **`packages/api/src/client.ts`** : supprimer la ligne 5 (` * Compatible Web (Vite) et Mobile (React Native/Expo).`)
  et la ligne ` *` vide qui la précède ; supprimer la section « CONFIGURATION UPLOAD »
  (bannière + `UPLOAD_CONFIG`, lignes 25-56 et la ligne vide qui suit) ; remplacer l'appel
  `treaty` (lignes 93-111) par :
  ```ts
    treatyClient = treaty<App>(config.baseUrl, {
      fetch: {
        credentials: 'include',
        mode: 'cors',
      },
      onResponse: (response) => {
        if (response.status === 401 && unauthorizedHandler) {
          unauthorizedHandler();
        }
      },
    });
  ```

- [x] **`packages/api/src/index.ts`** lignes 1-20 :
  ```ts
  /**
   * @repo/api - Platform-agnostic API package
   *
   * Eden Treaty client typed from the server's `App`, shared by the clients.
   *
   * @example
   * // Initialize at app startup
   * import { initializeApi, getTreaty, unwrap } from '@repo/api';
   *
   * initializeApi({
   *   baseUrl: 'https://api.tomia.fr',
   * });
   *
   * // Type-safe API calls
   * const data = unwrap(await getTreaty().api.parent.dashboard.get());
   */
  ```
  et supprimer `UPLOAD_CONFIG,` (ligne 37).
  **`packages/api/src/types.ts:4`** : ` * Platform-agnostic types shared by the clients.`

- [x] **`@repo/tokens`** :
  ```bash
  git rm -q packages/tokens/src/index.ts packages/tokens/src/colors.ts packages/tokens/src/colors.test.ts packages/tokens/src/motion.ts packages/tokens/src/motion.test.ts packages/tokens/tsconfig.json
  ```
  `packages/tokens/package.json` (fichier complet ; sans `typecheck`/`test`, turbo ne lance
  plus rien sur ce package) :
  ```json
  {
    "name": "@repo/tokens",
    "version": "1.0.0",
    "private": true,
    "exports": {
      "./theme.css": "./theme.css",
      "./theme-dark.css": "./theme-dark.css"
    }
  }
  ```
  `packages/tokens/theme.css` lignes 1-6 :
  ```css
  /* @repo/tokens — source unique de vérité des tokens de marque (light).
   * Consommé en CSS par les apps Tailwind v4 via :
   *   @import "@repo/tokens/theme.css";
   * Importer APRÈS l'import de Tailwind de l'app.
   * Dark mode : theme-dark.css (classe .dark). */
  ```
  `packages/tokens/theme-dark.css` lignes 1-7 :
  ```css
  /* @repo/tokens — overrides dark, classe .dark (next-themes).
   * Réconciliation 2026-06 : canoniques Tailwind slate, format hex unique
   * (divergences web/landing tranchées : card=#0F172A, violet=#8B5CF6,
   * status-foreground stone→slate). */
  ```
  `knip.json` : supprimer le bloc `"packages/tokens": { "project": ["src/**/*.ts"] }` et la
  virgule du bloc précédent.

- [x] **`@repo/eslint-config`** : `git rm -q packages/eslint-config/react.js` ; dans
  `packages/eslint-config/package.json`, supprimer `"./react": "./react.js"` (ligne 10) et
  la virgule finale de la ligne 9.

- [x] **Lockfile :** `pnpm install` (le package `@repo/tokens` perd `bun-types` et `typescript`).

- [x] **Validation :**
  ```bash
  pnpm typecheck && pnpm lint && pnpm test && pnpm --filter landing build && pnpm exec knip
  ```
  Attendu : exit 0. Le build landing prouve que `@import "@repo/tokens/theme.css"` se résout
  toujours par l'`exports` restant.

- [x] **Commit :**
  ```bash
  git add packages/api/src/config.ts packages/api/src/client.ts packages/api/src/index.ts packages/api/src/types.ts
  git add packages/tokens/package.json packages/tokens/theme.css packages/tokens/theme-dark.css
  git add packages/eslint-config/package.json knip.json pnpm-lock.yaml
  git commit -m "refactor(api): drop mobile-only exports from shared packages

  Co-Authored-By: Claude <noreply@anthropic.com>"
  ```

---

### Tâche A.5 — `pnpm-workspace.yaml`, `.npmrc`, Dockerfile : réglages de la chaîne Expo

**Files:**
- Delete: `.npmrc`
- Modify: `pnpm-workspace.yaml` (tout) ; `apps/server/Dockerfile:34,50,77` ;
  `.github/workflows/docker.yml:14,24` ; `pnpm-lock.yaml`

**Interfaces:**
- Consumes : réglages pnpm 11 (`overrides`, `catalog`, `publicHoistPattern`,
  `minimumReleaseAgeExclude`, `auditConfig.ignoreGhsas`).
- Produces : workspace sans override, catalogue, hoisting ni exception d'audit propres à Expo/RN.

Doc-first :
- pnpm 11 : « Only auth and registry settings are read from `.npmrc` files. All other settings
  (like `hoistPattern`, `nodeLinker`, …) must be configured in `pnpm-workspace.yaml` » —
  https://pnpm.io/settings. Vérifié en local : `pnpm config get node-linker`,
  `auto-install-peers`, `strict-peer-dependencies` → `undefined`. Le `.npmrc` actuel ne contient
  que ces trois réglages : il est inopérant, on le supprime.
- `lightningcss: 1.30.1` venait de NativeWind v5 : « Force `lightningcss` to a specific version
  … `"lightningcss": "1.30.1"` » — https://www.nativewind.dev/v5/getting-started/installation
  (introduit par le commit `7defb41`, migration NativeWind v5).
- Dockerfile `COPY` échoue si une source manque — https://docs.docker.com/reference/dockerfile/#copy ;
  d'où le retrait de `.npmrc` des trois `COPY`.

Tri des réglages, vérifié par simulation le 2026-09-22 (copie du dépôt sans `apps/mobile` ni
`@better-auth/expo`, `pnpm install --lockfile-only`, puis recherche de chaque cible dans le
lockfile) :

| Réglage | Cible encore présente ? | Sort |
|---|---|---|
| `publicHoistPattern: ['@babel/*']` | pour `@react-native/jest-preset` | supprimé |
| catalog `react-test-renderer` | absent | supprimé |
| commentaire du pin `react: 19.2.3` (« version Expo SDK 56 ») | — | commentaire supprimé, le pin reste (montée en PR B) |
| `minimumReleaseAgeExclude: [tinyexec]` | absent | supprimé |
| `@types/node: 25.9.1` (raison : `Response` de RN) | une seule version résolue sans override | supprimé |
| `@expo/dom-webview`, `expo-build-properties>ajv` | absents | supprimés |
| `lightningcss: 1.30.1` | présent via `@tailwindcss/node` | supprimé (NativeWind) → 1.32.0 résolu |
| `tar`, `qs`, `lodash-es`, `@isaacs/brace-expansion`, `markdown-it`, `hono`, `@hono/node-server`, `@tootallnate/once`, `lodash`, `uuid`, `jsdom>undici`, `markdown-it>linkify-it`, `js-yaml@4`, `js-yaml@3`, `shell-quote`, `@xmldom/xmldom@0.9` | absents | supprimés |
| `@xmldom/xmldom@0.8` | présent via `mammoth` (serveur) | gardé, commentaire corrigé |
| `auditConfig.ignoreGhsas` (shell-quote via react-native, image-size via metro) | absents | bloc supprimé |
| tous les autres overrides, `allowBuilds` | présents | inchangés |

Résultat de la simulation : `pnpm install --lockfile-only` exit 0 ; seul changement de version
`lightningcss` 1.30.1 → 1.32.0 ; une seule entrée `@types/node@25.9.1` ;
`pnpm audit --prod --audit-level high` exit 0 (1 low, 4 moderate).

- [x] **`pnpm-workspace.yaml`** (fichier complet) :
  ```yaml
  packages:
    - apps/*
    - packages/*

  # Supply-chain protection: chaque package qui veut exécuter un build script
  # doit être listé explicitement (pnpm 11 strictDepBuilds=true par défaut).
  # Tous les packages ici sont des libs officielles/matures qu'on trust pour
  # installer leurs binaires natifs.
  allowBuilds:
    '@evilmartians/lefthook': true
    '@sentry/cli': true
    esbuild: true
    protobufjs: true
    sharp: true

  catalog:
    '@radix-ui/react-slot': ^1.2.4
    '@types/react': ~19.2.10
    '@types/react-dom': ~19.2.3
    class-variance-authority: ^0.7.1
    clsx: ^2.1.1
    eslint: ^10.4.1
    lucide-react: ^1.17.0
    react: 19.2.3
    react-dom: 19.2.3
    tailwind-merge: ^3.6.0
    tailwindcss: ^4.3.0
    typescript: 6.0.3

  # Supply-chain protection: bloque l'install de packages publiés depuis <24h
  # (défaut pnpm 11).
  minimumReleaseAge: 1440

  # Migré depuis package.json#pnpm.overrides — pnpm 11 ne lit plus le champ "pnpm"
  # du package.json. Toutes les overrides doivent vivre ici.
  overrides:
    # kysely 0.29 moved DEFAULT_MIGRATION_TABLE/_LOCK_TABLE to the `kysely/migration`
    # entry; better-auth's bundled kysely-adapter still imports them from the root,
    # breaking the bun server build. Known upstream bug, still open:
    # https://github.com/better-auth/better-auth/issues/9610
    # Pin to the latest 0.28.x (last line that re-exports them from root) and drop
    # this override once better-auth ships the fix.
    kysely: 0.28.17
    esbuild: '>=0.25.0'
    fast-xml-parser: '>=5.3.8'
    rollup: '>=4.59.0'
    'eslint>minimatch': '>=3.1.4'
    'eslint-plugin-react>minimatch': '>=3.1.4'
    'glob>minimatch': '>=10.2.3'
    '@typescript-eslint/typescript-estree>minimatch': '>=9.0.7'
    'eslint>ajv': '>=6.14.0 <7.0.0'
    file-type: '>=21.3.1'
    underscore: '>=1.13.8'
    # CVE fixes for transitive deps (GitHub Dependabot alerts). Drop once parents bump.
    postcss: '>=8.5.18'
    brace-expansion: '>=5.0.9'
    # `pnpm audit --prod --audit-level high` fixes (2026-07-06 review). Patch/minor
    # bumps of transitive deps via override; drop once the parent packages bump.
    # @grpc/grpc-js <1.14.4: malformed request/compressed message can crash the
    # process (via @opentelemetry/sdk-node's otlp-grpc exporters).
    '@grpc/grpc-js': '1.14.4'
    # protobufjs <=7.6.0: DoS via unbounded Any expansion during JSON conversion
    # (via @grpc/grpc-js>@grpc/proto-loader). Pinned exact (not >=) — protobufjs
    # 8.x is a major bump @grpc/proto-loader doesn't support yet.
    protobufjs: '7.6.1'
    # `pnpm audit --prod --audit-level high` fixes (2026-08-24). Advisories
    # published after the 2026-07-17 green run; all transitive. Scoped by version
    # range where a package resolves to several majors and only one is affected
    # (syntax: https://pnpm.io/settings/dependency-resolution#overrides).
    # nanoid <3.3.18: predictable IDs from a biased random pool. Only the 3.x
    # copy is affected; the workspace also resolves 5.1.11, which must not be
    # dragged back two majors.
    'nanoid@3': '3.3.18'
    # nanoid >=4.0.0 <5.1.16: non-secure generators loop forever on a negative
    # size. Hits the 5.x copy (via @elysiajs/swagger), so both lines need a floor.
    'nanoid@5': '>=5.1.16'
    # sharp <0.35.0: out-of-bounds read in the bundled libvips.
    # Floor raised to 0.35.4 for GHSA-rgj7-g3m4-5g8c (<0.35.4), via next.
    sharp: '>=0.35.4'
    # fast-uri >=3.0.0 <3.1.5: ReDoS in the URI parser (via @sentry/nextjs>ajv).
    fast-uri: '>=3.1.5'
    # @opentelemetry/propagator-jaeger <2.9.0: unbounded baggage parsing.
    '@opentelemetry/propagator-jaeger': '>=2.9.0'
    # `pnpm audit --prod --audit-level high` fixes (2026-09-16). All transitive.
    # @xmldom/xmldom 0.8.x <0.8.15: XML injection / parser advisories
    # (GHSA-w2rr-34g9-rvrj, GHSA-4w3w-2rp5-g8jm, GHSA-c7q8-3ch8-vqpv,
    # GHSA-27p8-2357-5qqv, GHSA-8344-3jmq-59r6, GHSA-x4fp-j954-r2f4,
    # GHSA-965w-775f-mr7g, GHSA-93r5-fhx6-vmg9, GHSA-6mj3-qw4j-hgrw,
    # GHSA-g53g-w8rj-fmg7, GHSA-3px3-54cx-rmw9, GHSA-vr34-hp96-76pp), via
    # mammoth (DOCX extraction, server).
    '@xmldom/xmldom@0.8': '0.8.15'
    # browserslist <=4.28.6: GHSA-c83g-rgw3-j3cx, GHSA-73wf-gq98-2v4g (via
    # @babel/helper-compilation-targets under @sentry/nextjs).
    browserslist: '^4.28.7'
  ```

- [x] **`.npmrc`** : `git rm -q .npmrc`.
  **`apps/server/Dockerfile`** lignes 34, 50 et 77 :
  ```dockerfile
  COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
  ```
  **`.github/workflows/docker.yml`** : supprimer `- '.npmrc'` des filtres `paths` (lignes 14 et 24).

- [x] **Lockfile et contrôles :**
  ```bash
  pnpm install
  grep -cE "^  '@types/node@" pnpm-lock.yaml
  grep -E "^  lightningcss@" pnpm-lock.yaml
  pnpm audit --prod --audit-level high
  ```
  Attendu : install exit 0 ; `2` (une version, présente dans `packages:` et `snapshots:`) ;
  `lightningcss@1.32.0:` ; audit exit 0.

- [x] **Validation :**
  ```bash
  pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm exec knip && npx sherif@1.13.0
  docker build --target production -f apps/server/Dockerfile .
  ```
  Attendu : exit 0 partout (le build landing couvre la montée de `lightningcss`, le build
  Docker couvre le retrait de `.npmrc`).

- [x] **Commit :**
  ```bash
  git add pnpm-workspace.yaml pnpm-lock.yaml apps/server/Dockerfile .github/workflows/docker.yml
  git commit -m "build: drop pnpm settings that only served the Expo toolchain

  Sources: https://pnpm.io/settings (.npmrc only carries auth/registry in pnpm 11),
  https://www.nativewind.dev/v5/getting-started/installation (lightningcss pin).

  Co-Authored-By: Claude <noreply@anthropic.com>"
  ```

---

### Tâche A.6 — Suppression des tables `device_push_tokens` et `webhook_events`

**Files:**
- Delete: `apps/server/src/db/schema/notifications.schema.ts`
- Modify: `apps/server/src/db/schema.ts:15` ; `apps/server/src/db/schema/index.ts:77` ;
  `apps/server/src/db/schema/billing.schema.ts:176-196,261-264`
- Create (générés) : `apps/server/drizzle/0027_<nom>.sql`, `apps/server/drizzle/meta/0027_snapshot.json`,
  modification de `apps/server/drizzle/meta/_journal.json`

**Interfaces:**
- Consumes : rien.
- Produces : exports `devicePushTokens`, `devicePushTokensRelations`, `DevicePushToken`,
  `NewDevicePushToken`, `webhookEvents`, `WebhookEvent`, `NewWebhookEvent`, `WebhookSource`
  supprimés ; migration `DROP TABLE … CASCADE` pour les deux tables.

Règle appliquée : `.claude/rules/database-migrations.md` — source de vérité `schema.ts`,
`db:generate` pour produire la migration, jamais d'édition manuelle du `.sql` ni du journal,
backup avant migration destructive. L'app n'est pas en production et aucune base déployée
n'existe : il n'y a rien à sauvegarder, à confirmer par l'utilisateur avant d'appliquer.

- [x] **Preuve : aucun lecteur ni écrivain restant** (après A.2 et A.3) :
  ```bash
  cd apps/server && grep -rn "devicePushTokens\|DevicePushToken\|webhookEvents\|WebhookEvent\|WebhookSource\|device_push_tokens\|webhook_events" src scripts --include=*.ts
  ```
  Attendu : uniquement `src/db/schema/notifications.schema.ts` et `src/db/schema/billing.schema.ts`.
  `family_billing` (et ses colonnes `revenuecat_*`) reste lu par `subscription.repository.ts` :
  il n'est pas touché.

- [x] **Schéma :**
  ```bash
  git rm -q apps/server/src/db/schema/notifications.schema.ts
  ```
  Supprimer `export * from './schema/notifications.schema';` (`db/schema.ts:15`) et
  `export * from './notifications.schema';` (`db/schema/index.ts:77`). Dans `billing.schema.ts`,
  supprimer le JSDoc et la table `webhookEvents` (lignes 176-196, jusqu'à la ligne vide avant
  le JSDoc de `waitlist_entries`) et le bloc de types lignes 261-264
  (`// Webhook Events Types …`, `WebhookEvent`, `NewWebhookEvent`, `WebhookSource`, ligne vide).

- [x] **Migration :**
  ```bash
  cd apps/server && bun run db:generate
  cat drizzle/0027_*.sql
  ```
  Attendu : un fichier `0027_<nom>.sql` contenant exactement les deux ordres (format vérifié
  sur `drizzle/0026_silent_polaris.sql` : `DROP TABLE "retrieval_audit" CASCADE;`) :
  ```sql
  DROP TABLE "device_push_tokens" CASCADE;--> statement-breakpoint
  DROP TABLE "webhook_events" CASCADE;
  ```
  L'ordre des deux lignes et le séparateur `--> statement-breakpoint` sont ceux que drizzle-kit
  produit ; ne rien retoucher à la main. Toute autre instruction signale une dérive
  schéma/migrations préexistante : s'arrêter et la remonter.

- [x] **Appliquer en local et vérifier :**
  ```bash
  cd apps/server && bun run db:migrate && bun run db:check
  bun run typecheck && bun run lint && bun run test && bun run test:integration
  ```
  Attendu : exit 0 partout.

- [x] **Commit :**
  ```bash
  git add apps/server/src/db/schema.ts apps/server/src/db/schema/index.ts apps/server/src/db/schema/billing.schema.ts
  git add apps/server/drizzle/meta/_journal.json
  git add apps/server/drizzle/meta/0027_snapshot.json
  git add apps/server/drizzle/0027_*.sql
  git commit -m "feat(db): drop the device_push_tokens and webhook_events tables

  Co-Authored-By: Claude <noreply@anthropic.com>"
  ```

---

### Tâche A.7 — Documentation et configuration Claude

**Files:**
- Delete: `.claude/skills/mobile-device/SKILL.md`
- Modify: `CLAUDE.md:11,27,47,81-85` ; `README.md:12,28,32-33,43,48,50,52,58,75-76` ;
  `apps/server/CLAUDE.md:60-61,76` ; `apps/server/README.md:46,99,112-116,138` ;
  `apps/landing/CLAUDE.md:17-18` ; `.claude/settings.json:5` ;
  `.claude/rules/design-system.md:5,7,15-31` ; `.claude/rules/testing-and-commits.md:10,12,19,24,34` ;
  `.claude/skills/verify/SKILL.md:9,49-60,68-70`

**Interfaces:** aucune (documentation et config d'agent).

Doc-first : `enabledPlugins` est une clé des settings partagés `.claude/settings.json` —
https://code.claude.com/docs/en/settings. On retire le plugin `expo@claude-plugins-official`.
Les `deny` `Read(**/*.keystore|*.jks|*.p8|*.p12|*.pem)` restent : ce sont des protections de
secrets génériques, sans coût.

- [x] **`CLAUDE.md`** : supprimer la ligne 11 (`pnpm dev:mobile …`) ; ligne 27 :
  `dedans : \`apps/server/CLAUDE.md\`, \`apps/landing/CLAUDE.md\`.` ; ligne 47 :
  `  circulaire.` (supprimer la phrase `@repo/ui` / `apps/mobile`) ; supprimer la section
  « Review externe » (lignes 81-85, avec la ligne vide qui la précède).

- [x] **`README.md`** :
  - supprimer la ligne 12 (`pnpm dev:mobile …`) et la ligne 28 (`└── mobile/ …`), et changer la
    ligne 27 en `└── landing/      # Next.js — vitrine SEO (3001)` ;
  - ligne 32 : `├── ui/              # Primitives shadcn (DOM)` ;
  - ligne 33 : `├── tokens/          # Design tokens CSS (Tailwind v4) partagés` ;
  - supprimer la ligne 43 (`| Mobile | …`) ;
  - ligne 48 : `| Paiements | Aucun branché. Paiement web prévu au lot 3 |` ;
  - ligne 50 : `… Sentry initialisé sur server et landing. …` ;
  - ligne 52 : `| Déploiement | Cibles : Vercel (landing), Koyeb (server). …` ;
  - ligne 58 : `pnpm test                     # server (Bun)` ;
  - lignes 75-76 : `Chaque app a sa propre doc : [server](./apps/server/CLAUDE.md) · [landing](./apps/landing/CLAUDE.md)`.

- [x] **`apps/server/CLAUDE.md`** : supprimer le point « Webhooks RevenueCat » (lignes 60-61) ;
  lignes 76-77 :
  ```md
  qui casse silencieusement : quotas, round-trip de chiffrement, transactions
  multi-tables.
  ```
  **`apps/server/README.md`** : ligne 46 `| Paiements | Aucun branché (paiement web au lot 3) |` ;
  supprimer la ligne 99 (`REVENUECAT_WEBHOOK_AUTH`), la section « Device → Backend (LAN) »
  (lignes 112-116) et la ligne 138 (`revenuecat-webhook.*.ts`) ; ligne 139 :
  `│   └── subscription/           # Status lecture seule (DB)`.

- [x] **`apps/landing/CLAUDE.md`** lignes 17-18 :
  ```md
    `POST /api/waitlist`. Toute fonctionnalité « produit » qui la tenterait
    appartient au client applicatif — c'est ce qui l'empêche de dériver en second produit.
  ```

- [x] **`.claude/settings.json`** : supprimer la ligne 5 (`"expo@claude-plugins-official": true,`).
  **`.claude/skills/mobile-device/`** : `git rm -q .claude/skills/mobile-device/SKILL.md`.

- [x] **`.claude/rules/design-system.md`** :
  - supprimer la ligne 5 (`- "apps/mobile/**/*.{ts,tsx,css}"`) ; ligne 7 :
    `  - "packages/tokens/**/*.css"` ;
  - lignes 15-17 : `  dans composants et écrans — classes utilitaires issues de \`@repo/tokens\`
    (\`bg-primary\`, \`duration-base\`, \`rounded-lg\`…). Nouveau token = ajout dans
    \`theme.css\` (et \`theme-dark.css\` s'il change en dark).` ;
  - supprimer la puce « Parité des homonymes » (lignes 18-22) ;
  - lignes 23-24 : `- **États complets** sur tout interactif : disabled, loading, hover, active,
    focus visible, error. Pas de happy-path only.` ;
  - ligne 25-26 : `- **A11y AA** : cibles ≥ 44 px, labels (\`aria-*\` / \`<label>\`), contraste 4.5:1.` ;
  - ligne 31 : `  micro-motion) sans infantiliser.`

- [x] **`.claude/rules/testing-and-commits.md`** : supprimer les lignes 10 (`| Mobile | jest-expo …`),
  12 (`| packages/tokens | …`), 19 (`| Mobile | __tests__ …`), 24 (`- Mobile : …`) ; ligne 34 :
  ``chat`, `server`, `landing`, `ci`, `db`, `auth`. Toujours stager …`` (retirer `mobile`).

- [x] **`.claude/skills/verify/SKILL.md`** : ligne 9 `real surface — server, landing, scripts — and pastes the actual` ;
  supprimer la section « Mobile (apps/mobile) » (lignes 49-61, jusqu'à la ligne vide avant
  « Scripts ») ; lignes 68-70 :
  ```md
  (Node test runner over `scripts/*.test.mjs` — covers `doctor-checks.mjs` and the
  `.claude/hooks` scripts; `dev.mjs`/`doctor.mjs`/`setup.mjs` have no dedicated
  tests — their proof is the real execution paths above.)
  ```

- [x] **Vérification :** `pnpm run test:scripts` (le test des hooks lit `.claude/`) → exit 0 ;
  `python3 -m json.tool .claude/settings.json >/dev/null` → exit 0.

- [x] **Commit :**
  ```bash
  git add CLAUDE.md README.md apps/server/CLAUDE.md apps/server/README.md apps/landing/CLAUDE.md
  git add .claude/settings.json .claude/rules/design-system.md .claude/rules/testing-and-commits.md .claude/skills/verify/SKILL.md
  git commit -m "docs: remove the mobile app from docs and Claude config

  Co-Authored-By: Claude <noreply@anthropic.com>"
  ```

---

### Tâche A.8 — Validation complète et recherche des restes

**Files:** aucun (sauf correction si un reste injustifié apparaît : il rejoint la tâche
concernée par un nouveau commit).

- [x] **Validation de fin de PR** (racine, codes de sortie lus un par un) :
  ```bash
  CI=true pnpm install --frozen-lockfile
  pnpm typecheck && pnpm lint && pnpm test
  pnpm build
  pnpm run test:scripts
  pnpm exec knip
  npx sherif@1.13.0
  pnpm audit --prod --audit-level high
  cd apps/server && bun run test:integration && bun run db:generate && git status --short drizzle/
  docker build --target production -f apps/server/Dockerfile .
  ```
  Attendu : exit 0 partout ; `git status --short drizzle/` vide (schéma et migrations en phase).

- [x] **Recherche des restes.** La commande suggérée `grep -rn "apps/mobile\|expo\|RevenueCat\|revenuecat"`
  ne sert à rien telle quelle : `expo` est une sous-chaîne de `export` et renvoie des milliers
  de lignes. Commande retenue :
  ```bash
  grep -rniE "apps/mobile|tom-mobile|\bexpo\b|@expo|expo-|exp://|revenuecat|nativewind|react-native|maestro|push-token" \
    --exclude-dir=node_modules --exclude-dir=.git --exclude-dir=.turbo --exclude-dir=dist --exclude-dir=.next .
  ```
  Restes attendus, et leur justification :

  | Fichier | Pourquoi il reste |
  |---|---|
  | `apps/server/drizzle/0006_*.sql`, `apps/server/drizzle/meta/*_snapshot.json` | historique des migrations appliquées : interdit d'éditer ou de supprimer (`database-migrations.md`) |
  | `apps/server/src/db/schema/billing.schema.ts` (enum `billing_status`, `family_billing.revenuecat_customer_id` / `revenuecat_subscription_id`, index `idx_family_billing_revenuecat_customer`, commentaires) | schéma de facturation refait au lot 3 ; la table est encore lue par `subscription.repository.ts` |
  | `apps/server/src/db/schema/auth.schema.ts:50` (commentaire « RevenueCat-driven ») | idem, lot 3 |
  | `apps/landing/app/confidentialite/page.tsx:104,114` (RevenueCat sous-traitant) | copie légale de la landing : hors périmètre, cf. notes |
  | `docs/superpowers/**` | specs et plans qui décrivent cette suppression |

  Tout autre résultat est un oubli : le corriger dans la tâche concernée, nouveau commit.

- [x] **Push et PR :** `git push -u origin chore/remove-mobile-app`, PR vers `main`.
  Merge commit (chaque commit de tâche se relit seul). Avant le merge : l'étape manuelle
  du ruleset décrite en tête de section.

#### Notes de section

**Dette explicite pour le lot 3 (schéma et produit de facturation) :**
- `family_billing.revenuecat_customer_id`, `revenuecat_subscription_id`, l'index
  `idx_family_billing_revenuecat_customer`, l'enum `billing_status` (littéraux RevenueCat) et les
  commentaires de `billing.schema.ts` / `auth.schema.ts:50` restent tels quels.
- Plus aucun code n'écrit `family_billing` ni ne passe un enfant en premium ; `BillingService`
  (activation, prolongation, past_due, annulation, expiration) et `plan-cache` sont récupérables
  dans l'historique (`git log --diff-filter=D --oneline -- apps/server/src/services/billing/` donne le commit de suppression)
  si le paiement web veut les reprendre.
- `app-guide-data.ts` (outil `get_app_help`) est rendu neutre en A.2 : espaces fonctionnels au
  lieu d'écrans mobiles, abonnement « pas encore disponible en ligne ». Le lot 3 le réécrit avec
  la vraie navigation web et le parcours de paiement, et met à jour le test qui l'accompagne.

**Hors périmètre, à ouvrir dans une autre PR :**
- Copie de la landing qui annonce une app iOS/Android et un paiement App Store / Google Play
  (`cgu/page.tsx:21,74`, `confidentialite/page.tsx:104,114,158`, `faq-data.ts:36,41`,
  `features.tsx:77`, `pricing.tsx:106`). Le sort de la landing est une décision du lot 3 et les
  pages légales font partie de la « porte avant ouverture » de la roadmap.
- Routes `PUT|GET|DELETE /api/pronote/credentials` (`pronote-sync.routes.ts`) : l'en-tête les
  décrit « device-first » pour le mobile et `GET` renvoie les identifiants déchiffrés au client,
  contraire à « Pronote serveur uniquement ». Aucun client ne les appelait déjà (le mobile
  n'utilise que `credentials/list`, `:id/children`, `:id/activate`, `:id/resync`, `DELETE :id`).
  Candidat pour la PR D ou E, pas pour A.
- `apps/server/src/lib/encryption.ts:51-53,72-73` justifie la copie en `ArrayBuffer` par le
  typecheck mobile ; le contournement peut rester nécessaire pour le typage des `Uint8Array`
  en TS 6. À revérifier en PR B/E, pas supprimé ici sans preuve.
- `pnpm-workspace.yaml` : l'override `'nanoid@5': '>=5.1.16'` résout déjà `nanoid@6.0.1`
  (saut de majeure) et son commentaire (« 5.1.11 ») est faux ; `.vscode/extensions.json`
  recommande encore `ruff`/`python` (ai-service supprimé). Relève de la PR B.

**Constats d'audit écartés ou corrigés :**
- « `node-linker=hoisted` est requis par React Native » (`.npmrc`) : le réglage n'a jamais été
  appliqué sous pnpm 11 (`pnpm config get node-linker` → `undefined`) ; le supprimer ne change rien.
- `@repo/api` : supprimé partiellement seulement ; le package garde `getTreaty`, `unwrap`,
  `setUnauthorizedHandler`, `IAppUser` et les types de chat pour `apps/web`. Il n'a pas de
  runner de test : la modification (suppression) est prouvée par typecheck et knip ; le lot 3
  ajoute les tests avec son premier consommateur.
- `@xmldom/xmldom` : la consigne le supposait tiré seulement par `@expo/config-plugins`. Faux
  pour la ligne 0.8 : `mammoth` (extraction DOCX serveur) le tire aussi. Seul l'override 0.9 part.
- La recherche `pnpm why` montre que `@better-auth/expo` côté serveur tirait toute la chaîne
  `expo` (via `expo-constants`) : sans le retirer (A.3), les overrides Expo resteraient vivants.
  C'est pourquoi A.5 vient après A.3.

**Non vérifié en exécution réelle (à prouver par l'exécutant) :** le nom et le contenu exact de
la migration `0027` (format attendu déduit de `0026`) ; le build landing avec `lightningcss`
1.32.0 ; le `docker build` sans `.npmrc` ; le passage de `knip` sans le workspace mobile. Chacun a
son étape de vérification dans la tâche.

**Dépendances avec les autres PR du lot 0 :**
- PR B (montée des dépendances) part de ce lockfile allégé : le pin `react: 19.2.3` et les
  overrides restants y sont réévalués ; plus aucune contrainte Expo SDK ne bloque React.
- PR C (Small 4), D (bugs) et E (réinventions) supposent `app.ts`, `auth.ts`, `env.ts` et le
  mock `api-endpoints.test.ts` dans l'état laissé par A.2/A.3 (sans webhook, sans `skipPaths`,
  sans `getTrustedOrigins`).
- Mémoire utilisateur hors dépôt (`~/.claude/projects/.../memory/`) : plusieurs entrées décrivent
  encore le mobile comme actif ; à mettre à jour par l'orchestrateur après merge.
