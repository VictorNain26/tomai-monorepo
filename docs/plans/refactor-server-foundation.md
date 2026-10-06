# Plan — étape 2 de la refonte : suppression de l'ancien serveur et socle

Étude : `docs/etudes/2026-10-06/refonte-architecture.md` (ordre des PR, point 2). Branche
`refactor/server-foundation`, depuis `main` à `e4acc6ea`.

## Arbitrages par rapport à l'étude

- **L'auth de base entre dans le socle** (better-auth, ses tables, e-mail et mot de passe). C'est
  de la plateforme, dont toute route dépend, et c'est la première vraie table : sans elle, ni
  migration, ni base par fichier de test, ni `/health/ready` n'auraient d'objet. Le foyer, les
  comptes élèves, le consentement et la vérification d'e-mail restent à l'étape 4.
- **L'e2e du web contre le vrai serveur entre ici**, et non à l'étape 3 : supprimer
  `@repo/web-host` retire `serve-web`, sur lequel l'e2e tourne. Le job e2e reçoit un Postgres ;
  le pipeline unique et `ci-ok` restent à l'étape 3.
- **Le faux Mistral et le rate limit attendent l'étape 5** : aucune route du socle n'appelle
  Mistral, et better-auth limite déjà ses propres routes.
- **Le client typé attend l'étape 6** : `packages/api` disparaît ici, `contract.ts` et
  `tomai-server/client` arrivent quand le web appelle l'API.
- **Les actifs de code** (détection de fuite, calculs, contrôle du tour…) ne sont pas déplacés
  ici : sans consommateur, ce seraient des fichiers morts. Chacun revient de l'historique
  (`048676b4`) dans l'étape qui l'utilise.

## Ce qui reste

- `apps/server/src/referential/` : l'outil d'extraction, les 8 textes, ses trois tests
  (`referential*.test.ts`) ; il ne dépend que des niveaux et des matières.
- Le jeu d'évaluation, données seules : `eval/exercises/*.json`, `scenarios.json`,
  `constructed-cases.json`, `agreement-sample.json`, avec `eval/schema.ts`, `eval/index.ts`
  (le chargeur) et `eval-alignment.test.ts`, qui vérifie chaque citation contre le référentiel.
- Niveaux et matières (`lib/education-levels.ts`, `lib/subjects.ts`), réécrits dans `domain/`.

## Ce qui part

Tout le reste de `apps/server/src` (modules, platform, routes, lib, shared, types, db, scripts,
tests, integration-tests, live, le reste d'eval), `apps/server/drizzle/` (migrations 0000 à
0003), `apps/server/scripts/run-tests.ts`, `packages/api`, `packages/web-host`, les scripts
`doctor*` de la racine et leurs tests, les plans périmés de `docs/plans/` (mars 2026), les
dépendances qui n'ont plus d'usage (knip les liste).

## Socle

Arborescence et règles de l'étude. Code nouveau, en anglais :

- `main.ts` : racine de composition. `loadConfig(Bun.env)`, `createDb`, vérification des
  migrations, `createAuth`, `createApp`, `Bun.serve({ idleTimeout: 30 })`, arrêt.
- `instrument.ts` : OTel et Sentry, chargés par `preload` dans `bunfig.toml`, chacun inactif
  sans sa variable ; endpoint et DSN contraints à l'UE en production, comme Mistral.
- `config.ts` : un schéma Zod, un objet figé ; garde les règles de l'ancien `env.ts` qui
  s'appliquent au socle (`WEB_DIST_DIR` avec `index.html`, URL publique, secret, niveau de log).
- `app.ts` : `createApp(deps)` ; `requestId` généré par le serveur, en-têtes de sécurité, montage
  de better-auth sur `/api/auth/*`, santé, service du web, `onError`, `notFound`.
- `platform/http/problem.ts` : la classe `Problem(code, detail?)`, l'`onError` en
  `application/problem+json` (RFC 9457), le 404 ; `validate.ts` repris de `http/context.ts`
  (JSON sans Content-Type refusé, une `FieldError` par clé inconnue, messages en français).
- `platform/http/security-headers.ts`, `web-client.ts` : repris de `@repo/web-host`, avec leurs
  tests ; `no-store` sur `/api`.
- `platform/db/` : `createDb(config)` (postgres.js, TLS vérifié en production), `migrate.ts` avec
  son verrou consultatif, la vérification « migrations appliquées = journal » au démarrage.
- `platform/auth/` : `createAuth({ db, config })` ; e-mail et mot de passe, pas de
  `cookieCache`, révocation des sessions au changement de mot de passe ;
  tables better-auth dans le schéma ; une garde de session typée par `auth.$Infer.Session`.
- `platform/observability/logger.ts` : pino sans surcouche, `mixin` qui lit `requestId` et
  `userId` par `hono/context-storage`, le sérialiseur d'erreurs en liste blanche repris.
- `platform/lifecycle/` : `/health/live`, `/health/ready` (base joignable, 503 pendant l'arrêt,
  sans message d'erreur ni version), registre des tâches de fond, arrêt sous échéance.
- `domain/levels.ts`, `domain/subjects.ts`.
- Une seule migration, la baseline des tables better-auth, générée par `drizzle-kit generate`.

## Tests

- `bun test` simple : aucun `mock.module`, plus de lanceur maison.
- Une base par fichier de test, copiée d'un modèle migré (`CREATE DATABASE … TEMPLATE`), par une
  aide de test ; l'app construite par `createApp` et appelée par `testClient`.
- Cas : config (refus au démarrage, valeurs dérivées), erreurs (forme RFC 9457, aucun message
  interne, 404 JSON), validation, en-têtes et service du web (repris), santé (live, ready, 503 à
  l'arrêt), migrations (journal différent refusé, verrou), auth (inscription, connexion, cookie
  de l'hôte, session révoquée après changement de mot de passe, champ inconnu refusé), arrêt
  (tâche de fond attendue, échéance).
- e2e du web : Playwright lance le serveur avec le build du web, contre un Postgres migré ;
  les specs actuelles (accueil, PWA, CSP, rechargement après déploiement) passent dessus.

## Outillage touché

- `eslint-plugin-boundaries` dans `apps/server/eslint.config.mjs`, avec les règles de l'étude.
- `knip.json` : workspaces `packages/api` et `packages/web-host` retirés, entrées du serveur
  (`src/main.ts`, `src/instrument.ts`, `src/referential/extract.ts`, tests).
- CI : job de test sans `test:integration` séparé ni migration préalable (chaque fichier crée sa
  base) ; job e2e avec Postgres ; Migration Sync sur les nouveaux chemins de schéma.
- Dockerfile : chemins nouveaux, `instrument.ts` en preload ; la réécriture complète reste à
  l'étape 3.
- `apps/server/.env.example`, `README.md`, `.claude/rules/server.md`, `testing.md`,
  `database-migrations.md`, skill `dev-bootstrap`, `docs/architecture.md` (partie serveur).

## Pré-vol (2026-10-06)

- **postgres.js 3.4.9** (`src/connection.js`, `secure()`) : `'require'`, `'allow'` et `'prefer'`
  posent `rejectUnauthorized = false` ; toute autre valeur (`'verify-full'`) laisse la
  vérification par défaut de Node, nom d'hôte compris. Une CA privée d'hébergeur demandera
  l'objet `ssl` avec `ca`, à l'étape 7.
- **better-auth 1.7.5** : `revokeSessionsOnPasswordReset` (`init-options.d.mts`) et `$Infer`
  (`dist/types/auth.d.mts`) existent. `advanced.ipAddress.trustedProxies` demande les adresses
  réelles du proxy de l'hébergeur : il attend l'étape 7, comme le note le suivi. La CLI n'est
  pas installée : le schéma Drizzle des tables better-auth reprend `auth.schema.ts` de
  `048676b4` sans ses champs métier, relu contre les tables du cœur de better-auth.
- **drizzle-orm 0.45** : `readMigrationFiles(config)` renvoie `{ hash, folderMillis }` par
  migration (`migrator.d.ts`), à comparer aux lignes de `__drizzle_migrations`.
- **hono 4.13.12** : `contextStorage`, `tryGetContext` (`middleware/context-storage`) et
  `testClient` (`helper/testing`) existent.
- **eslint-plugin-boundaries 7.2.0** (2026-08-09 ; dépôt actif, push du 2026-10-05, 997 étoiles,
  2,2 M téléchargements par semaine, peer `eslint >=6`) : flat config, réglage
  `boundaries/elements`, règle `boundaries/dependencies` avec `default: 'disallow'` et des
  `policies` (doc via Context7). Nos imports relatifs en `.js` vers des `.ts` demandent un
  résolveur TypeScript : à vérifier pendant la tâche, avec le critère de maintenance.
- **Playwright** : `webServer` accepte un tableau, chaque entrée avec `env` et `url`
  (doc `test-webserver`).
- **Bun** : `preload` au niveau racine de `bunfig.toml` vaut pour `bun run` et `bun test` ; l'image
  lance `bun --preload` (doc Bun, guide Sentry). `bun test` sans `--isolate` face à #44161 : à
  mesurer sur la suite neuve.

## Validation

`bun run typecheck`, `bun run lint`, `bun run test`, Prettier, knip, sherif ; e2e du web en local
(Android) ; image Docker construite et lancée contre un Postgres TLS ; CI verte ; test dans Chrome.
Le dernier commit supprime ce plan.
