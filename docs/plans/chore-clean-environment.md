# Environnement de travail propre

Audit du 2026-10-06 : configuration, CI, Docker et scripts qui décrivent un déploiement, des
outils ou des chemins qui n'existent plus. Aucune fonctionnalité produit ne change.

## Pré-vol

Chaque constat de l'audit vérifié dans le code contre `main` à jour.

- `.gitignore` n'ignore que `.env`, `.env.local` et trois `.env.*.local` : un `.env.production`
  ou `.env.staging` serait commitable, et `turbo.json` les compte dans `build.inputs`. Seuls
  `apps/server/.env.example` et `apps/landing/.env.example` sont suivis.
- `turbo.json` : `test.env` répète `globalEnv` ; `test.inputs`, `lint.inputs` et
  `typecheck.inputs` ajoutent à `$TURBO_DEFAULT$` des fichiers suivis du paquet qu'il couvre déjà
  (schéma installé, turbo 2.11.2 : sans `inputs`, tous les fichiers du paquet comptent). Une fois
  les `.env.*` retirés, `build.inputs` se réduit lui aussi au défaut.
- `claude-code-action@cfc3eb22` : son `action.yml` n'a pas d'entrée `model`, `max_turns` ni
  `allowed_tools` ; son `docs/migration-guide.md` les renvoie vers `claude_args` (`--model`,
  `--max-turns`, `--allowedTools`). Aujourd'hui les trois réglages sont ignorés.
- `docker-compose.yml` : `drizzle-studio` monte `package.json` en lecture seule puis lance
  `bun add`, cassé ; `bun run db:studio` existe. `adminer` (`latest`) double `db:studio` et
  n'est cité que par `apps/server/README.md`. Le profil `backend` construit le stage
  `development` du Dockerfile, alors que `scripts/dev.mjs` lance le serveur sur l'hôte et que la
  CI (`docker.yml`) ne construit que `production` ; seul `dev-bootstrap` le cite.
  `apps/server/.dockerignore` est mort : le contexte de build est la racine, dont le
  `.dockerignore` s'applique.
- `apps/server/Dockerfile` : `EXPOSE`/`HEALTHCHECK` sur 8000 alors que `env.ts` met `PORT` à
  3000 par défaut ; en-tête Koyeb ; le commentaire annonce `--packages external`, que
  `build:server` et `build:migrate` ne passent pas ; appelle `typecheck:strict`, identique à
  `typecheck`.
- `apps/server/package.json` : `db:health` importe `src/platform/db/connection.js`, absent ;
  `build:koyeb`, `build:validated`, `validate*`, `dev:memory`, `start:prod`, `db:pull`,
  `typecheck:strict`, `test:watch` (`--isolate`, que `scripts/run-tests.ts` déclare instable)
  ne sont appelés par rien (CI, lefthook, doc, scripts) ; `clean` supprime `bun.lockb`, lockfile
  binaire abandonné. `trustedDependencies` : `@better-auth/cli` absent du lockfile, et ni
  `better-auth` ni `drizzle-kit` n'ont de script d'installation, le bloc ne sert à rien.
  Landing : `lint:ci` ne diffère que par `--format stylish`, le format par défaut d'ESLint ;
  `validate*` sans appelant. Racine : `validate` sans appelant.
- `apps/server/bunfig.toml` : face à `bun-types/docs/runtime/bunfig.mdx` (1.4.2), seul
  `[test] preload` est documenté et utile ; `install.exact`/`install.registry` y valent leur
  défaut, `install.cache = true` n'est pas la forme documentée, `[run] smol/hot`, `[build]` et
  `[macros]` n'existent pas.
- tsconfig serveur : aucun import `@/` dans `src`, `scripts` ni `drizzle.config.ts`, et
  `src/services`, `src/config` n'existent pas ; `exclude` cite `patches/` et
  `src/scripts/archive/`, absents (comme `eslint.config.mjs` pour `patches/**`) ;
  `tsBuildInfoFile` est sans effet sans `incremental` ni `composite`. `packages/ui` :
  `composite`, `declaration*`, `outDir`, `rootDir` alors que le paquet est consommé en source et
  que rien ne le référence ; c'est `composite` qui fait écrire `tsconfig.tsbuildinfo` à
  `tsc --noEmit`. Artefacts périmés sur disque (ignorés) : `packages/ui/tsconfig.tsbuildinfo`,
  `packages/tokens/tsconfig.tsbuildinfo` (`tokens` n'a pas de tsconfig).
- Restes : `smoke-test.yml` vise `api.tomia.fr`, non déployé ; commentaires Koyeb dans
  `platform/db/migrate.ts`, `platform/http/rate-limit.ts` et
  `integration-tests/migrate-lock.integration.test.ts` ; le nom d'un test de
  `health-routes.test.ts` cite le smoke test. Détection Supabase en double (`db/connection.ts`,
  `platform/db/migrate.ts`) : aucune base Supabase, la règle de prod (`ssl: 'require'` en
  production) suffit, pas d'option dans `env.ts`. `.dockerignore` racine : bloc Python sans
  code Python dans le contexte copié. `.gitleaks.toml` : `google-services.json` absent.
  `.gitattributes` : `package-lock.json`, `yarn.lock` et un second `*.toml`. `CODEOWNERS` :
  `/apps/server/docker-compose.yml` absent, toutes les lignes redondantes avec `*`.
  `packages/eslint-config` : « see react.js », fichier absent.

Écarté : `DATABASE_URL_EXTERNAL` et la détection Docker de `platform/config/database-url.ts`
et `env.ts` ne servaient qu'au backend conteneurisé ; les retirer touche `env.ts`, trois mocks de
tests, `drizzle.config.ts`, le test d'intégration de migration et `.env.example`. Hors du
périmètre de l'audit : PR suivante. `apps/server/README.md` n'est pas touché (doc refaite dans
une PR suivante).

## Tâches

1. Sécurité : `.gitignore` (`.env*` partout sauf `!.env.example`), `turbo.json` élagué.
2. Sécurité : `claude-code.yml` passe modèle, tours et outils par `claude_args`.
3. Docker : `drizzle-studio`, `adminer`, profil `backend`, stage `development`,
   `apps/server/.dockerignore` supprimés ; Dockerfile (port 3000, en-tête, commentaire du bundle,
   `typecheck`) ; bloc Python du `.dockerignore` ; `dev-bootstrap` mis à jour.
4. Scripts : `package.json` serveur, landing et racine ; `bunfig.toml` serveur.
5. TypeScript : tsconfig serveur et `packages/ui`, `eslint.config.mjs` ; artefacts supprimés du
   disque.
6. Restes : `smoke-test.yml`, Koyeb, Supabase, `.gitleaks.toml`, `.gitattributes`,
   `CODEOWNERS`, `packages/eslint-config`.

Validation à chaque commit : `bun run typecheck && bun run lint`, `bun run test` quand le
serveur change, `docker build --target production` non lancé (consigne : pas de Docker sur la
machine pendant le rejugement), la CI `docker.yml` le fait.
