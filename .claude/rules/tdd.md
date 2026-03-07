# TDD — Conventions TomAI

Le workflow TDD (Red-Green-Refactor) est enforce par le plugin `dev-standards`.
Ce fichier definit uniquement les conventions SPECIFIQUES au monorepo TomAI.

## Test runners par app

| App | Runner | Commande |
|-----|--------|----------|
| Server | Bun natif | `cd apps/server && bun test` |
| Mobile | jest-expo | `cd apps/mobile && pnpm test` |
| Landing | — | Pas de tests (site statique) |

## Localisation des tests

| App | Pattern | Exemple |
|-----|---------|---------|
| Server | `src/tests/<service>.test.ts` | `src/tests/encryption.test.ts` |
| Mobile | `__tests__/<path>/<name>.test.ts` | `__tests__/lib/pronote-helpers.test.ts` |

## Validation obligatoire avant commit

- Server : `cd apps/server && bun run typecheck && bun run lint && bun test`
- Mobile : `cd apps/mobile && pnpm typecheck && pnpm lint && pnpm test`
- Landing : `cd apps/landing && pnpm typecheck && pnpm lint`
