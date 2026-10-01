# Plan — `refactor/server-platform`

Première PR de la refonte du serveur (lot 0, `roadmap.md`, point 7). Elle fixe la structure
cible et y range le socle commun. Chemins relatifs à `apps/server/src/`.

## Structure cible de la refonte

- `platform/` : ce que tous les modules utilisent et qui ne porte aucune règle métier.
  - `config/` : `env.ts`, `database-url.ts` ;
  - `db/` : connexion et migrateur ;
  - `http/` : contexte Hono, gardes, validation, erreurs, rate limit ;
  - `observability/` : logger, OpenTelemetry, Sentry ;
  - `ai/` : client Mistral ;
  - `lifecycle/` : démarrage et arrêt.
- `modules/<module>/` : un dossier par module de `docs/architecture.md` (`voice`,
  `documents`, `learning`, `chat`, `auth` et parent, `billing`). Chacun réunit :
  - ses routes Hono, montées par `app.ts` sur son préfixe ;
  - ses services et ses dépôts ;
  - ses tables Drizzle et ses schémas Zod.
- Un module en appelle un autre par ses services, jamais par ses dépôts ni ses tables.
- Les tests restent dans `tests/` et `integration-tests/` ; les co-localiser changerait les
  scripts de test sans gain mesurable.

## Cette PR

- Déplacements (`git mv`, imports et chemins de `mock.module` réécrits) :

  | Avant | Après |
  |---|---|
  | `config/env.ts`, `config/database-url.ts` | `platform/config/` |
  | `db/connection.ts`, `db/migrate.ts` | `platform/db/` |
  | `lib/http.ts` | `platform/http/context.ts` |
  | `lib/errors.ts`, `middleware/error-handler.middleware.ts`, `middleware/rate-limit.middleware.ts` | `platform/http/` |
  | `lib/observability.ts`, `lib/log-levels.ts`, `lib/otel/otel.ts`, `lib/sentry.ts` | `platform/observability/` |
  | `lib/graceful-shutdown.ts`, `services/server-lifecycle.ts` | `platform/lifecycle/` |
  | client Mistral de `lib/ai/` | `platform/ai/` |

- Chemins hors TypeScript alignés : `bunfig.toml` (préchargement), scripts de
  `package.json`, doc, règles et skills `.claude/`.
- Restent en place pour leur module : tables et dépôts (`db/`), auth (`lib/auth.ts`,
  `middleware/auth.middleware.ts`), schémas de cartes (`lib/ai/schemas/`).

## Validation

Typecheck, lint, tests unitaires et d'intégration, build, knip ; boot du build.
