# Tests et commits — Conventions monorepo

Le workflow TDD (Red-Green-Refactor) est géré par **superpowers:test-driven-development**. Ce fichier définit les conventions **spécifiques au monorepo** : runners, paths, validation, scopes.

## Test runners par app

| App | Runner | Commande |
|-----|--------|----------|
| Server | Bun test runner | `cd apps/server && bun run test` |
| Landing | Playwright | `pnpm --filter landing test:e2e` |

La suite e2e de la landing est locale uniquement : ni en CI, ni dans la validation avant commit.
Prérequis unique : `pnpm --filter landing exec playwright install chromium`. Elle construit le
site, le sert sur le port 3011 et couvre la mise en page (aucun défilement horizontal, cibles
de 44 px, lignes légales), le rendu sans JavaScript et sous mouvement réduit, le formulaire et
le menu mobile.

## Localisation des tests

| App | Pattern | Exemple |
|-----|---------|---------|
| Server | `src/tests/<service>.test.ts` | `src/tests/encryption.test.ts` |
| Landing | `apps/landing/tests/<name>.spec.ts` | `tests/layout.spec.ts` |

## Validation obligatoire avant commit

- Server : `cd apps/server && bun run typecheck && bun run lint && bun run test`
- Landing : `cd apps/landing && pnpm typecheck && pnpm lint`

**Avant push server, AUSSI `bun run test:integration`** (gating en CI). Piège connu :
`api-endpoints.test.ts` mocke `drizzle-orm` partiellement — tout nouveau module
importé par la chaîne `app.ts`/`server-lifecycle.ts` qui tire les schémas Drizzle
doit être mocké dans ce fichier (pattern : voir le mock de `retention-purge.service`).

## Scopes de commit conventionnels

`chat`, `server`, `landing`, `ci`, `db`, `auth`. Toujours stager les fichiers explicitement (jamais `git add .`).
