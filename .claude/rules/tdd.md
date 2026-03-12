# TDD — Conventions TomAI

Le workflow TDD (Red-Green-Refactor) est **OBLIGATOIRE** et s'applique automatiquement a toute tache de developpement via `/dev`. Il est enforce par :
- **CLAUDE.md** : directive obligatoire — l'agent invoque `/dev` automatiquement sur chaque tache de code
- **Claude Code Stop hook** : bloque si du code modifie n'est pas commite (force validation + commit)
- **lefthook pre-commit** : lint + typecheck automatiques
- **lefthook pre-push** : tests + build automatiques

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

L'agent invoque `/dev <description>` automatiquement sur toute tache de code (voir CLAUDE.md).

## Validation obligatoire avant commit

- Server : `cd apps/server && bun run typecheck && bun run lint && bun run test`
- Mobile : `cd apps/mobile && pnpm typecheck && pnpm lint && pnpm test`
- Landing : `cd apps/landing && pnpm typecheck && pnpm lint`

lefthook execute automatiquement : lint pre-commit, test+build pre-push.
