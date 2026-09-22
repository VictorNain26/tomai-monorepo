# Tests et commits — Conventions monorepo

Le workflow TDD (Red-Green-Refactor) est géré par **superpowers:test-driven-development**. Ce fichier définit les conventions **spécifiques au monorepo** : runners, paths, validation, scopes.

## Test runners par app

| App | Runner | Commande |
|-----|--------|----------|
| Server | Bun test runner | `cd apps/server && bun run test` |
| Landing | — | Pas de tests (site statique) |

## Localisation des tests

| App | Pattern | Exemple |
|-----|---------|---------|
| Server | `src/tests/<service>.test.ts` | `src/tests/encryption.test.ts` |

## Validation obligatoire avant commit

- Server : `cd apps/server && bun run typecheck && bun run lint && bun run test`
- Landing : `cd apps/landing && pnpm typecheck && pnpm lint`

**Avant push server, AUSSI `bun run test:integration`** (gating en CI). Piège connu :
`api-endpoints.test.ts` mocke `drizzle-orm` partiellement — tout nouveau module
importé par la chaîne `app.ts`/`server-lifecycle.ts` qui tire les schémas Drizzle
doit être mocké dans ce fichier (pattern : voir le mock de `retention-purge.service`).

## Scopes de commit conventionnels

`chat`, `server`, `landing`, `ci`, `db`, `auth`. Toujours stager les fichiers explicitement (jamais `git add .`).
