# Monorepo Tom

Tutorat IA socratique adaptatif (CP-Terminale). Stack 100% Mistral (souveraineté EU).

## Commandes

```bash
pnpm install
pnpm dev                    # Landing:3001 + Server:3000 (Docker requis pour le server)
pnpm dev:mobile             # Expo (8081)
pnpm typecheck && pnpm lint # Validation obligatoire avant commit
pnpm build
```

Backend nécessite `docker compose up -d` dans `apps/server` (PostgreSQL + pgvector).

## Détails par couche

Chaque app a son propre `CLAUDE.md` avec ses spécificités :
- @apps/server/CLAUDE.md — backend Bun/Elysia, services AI, RAG, billing, Pronote
- @apps/mobile/CLAUDE.md — Expo, navigation, intégration Eden Treaty
- @apps/landing/CLAUDE.md — Next.js, structure composants

## Règles inviolables

Codifiées dans @./constitution.md (TypeScript strict, branches, garde-fous CI/CD, sécurité). Lis-la avant tout contribution non triviale.

Conventions complémentaires :
- @.claude/rules/testing-and-commits.md — TDD, runners, scopes commit
- @.claude/rules/database-migrations.md — Drizzle dev vs prod

## Garde-fous déterministes

- **Stop hook** : force validation + commit avant fin de session
- **PreToolUse hook** : bloque commandes destructives
- **Permission deny** : interdit la lecture des secrets
- **lefthook** : lint+typecheck (pre-commit), tests+build (pre-push)

## Review IA

- PR staging→main : CodeRabbit Free (auto)
- `/review` localement avant push
- E2E Maestro Android en preview (signal, pas gate)
