# TDD — Conventions TomAI

Le workflow TDD (Red-Green-Refactor) est enforce par :
- **Claude Code Stop hook** : bloque si les tests n'ont pas ete lances
- **Skill `/dev`** : guide le cycle RED → GREEN → REFACTOR automatiquement
- **lefthook pre-push** : empeche le push si les tests echouent

## Test runners par app

| App | Runner | Commande |
|-----|--------|----------|
| Server | Runner isole Bun | `cd apps/server && bun run test` |
| Mobile | jest-expo | `cd apps/mobile && pnpm test` |
| Landing | — | Pas de tests (site statique) |

## Localisation des tests

| App | Pattern | Exemple |
|-----|---------|---------|
| Server | `src/tests/<service>.test.ts` | `src/tests/encryption.test.ts` |
| Mobile | `__tests__/<path>/<name>.test.ts` | `__tests__/lib/pronote-helpers.test.ts` |

## Cycle TDD

1. **RED** : ecrire le test d'abord, verifier qu'il echoue
2. **GREEN** : implementer le minimum pour passer
3. **REFACTOR** : ameliorer sans casser les tests

Utiliser `/dev <description>` pour lancer le workflow automatiquement.

## Validation obligatoire avant commit

- Server : `cd apps/server && bun run typecheck && bun run lint && bun run test`
- Mobile : `cd apps/mobile && pnpm typecheck && pnpm lint && pnpm test`
- Landing : `cd apps/landing && pnpm typecheck && pnpm lint`

lefthook execute automatiquement : lint pre-commit, test+build pre-push.
