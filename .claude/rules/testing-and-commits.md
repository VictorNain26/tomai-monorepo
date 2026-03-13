# Tests et commits — Conventions monorepo

Le workflow TDD (Red-Green-Refactor) est géré par **superpowers:test-driven-development**. Ce fichier définit les conventions **spécifiques au monorepo** : runners, paths, validation, scopes.

## Enforcement

| Mécanisme | Fiabilité | Ce qu'il fait |
|---|---|---|
| **Stop hook** (exit 2) | Déterministe | Force validation + commit avant de quitter |
| **lefthook pre-commit** | Déterministe | lint + typecheck automatiques |
| **lefthook pre-push** | Déterministe | tests + build automatiques |
| **superpowers skills** | Auto-invoqués | brainstorming → planning → TDD → review → completion |

## Test runners par app

| App | Runner | Commande |
|-----|--------|----------|
| Server | Bun test runner | `cd apps/server && bun run test` |
| Mobile | jest-expo | `cd apps/mobile && pnpm test` |
| Landing | — | Pas de tests (site statique) |

## Localisation des tests

| App | Pattern | Exemple |
|-----|---------|---------|
| Server | `src/tests/<service>.test.ts` | `src/tests/encryption.test.ts` |
| Mobile | `__tests__/<path>/<name>.test.ts` | `__tests__/lib/pronote-helpers.test.ts` |

## Validation obligatoire avant commit

- Server : `cd apps/server && bun run typecheck && bun run lint && bun run test`
- Mobile : `cd apps/mobile && pnpm typecheck && pnpm lint && pnpm test`
- Landing : `cd apps/landing && pnpm typecheck && pnpm lint`

## Scopes de commit conventionnels

`chat`, `server`, `landing`, `mobile`, `ci`, `db`, `auth`, `rag`. Toujours stager les fichiers explicitement (jamais `git add .`).
