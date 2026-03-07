---
description: Develop a feature or fix in the monorepo
---

Implement the following task: $ARGUMENTS

Follow this workflow:

1. **Identify impacted apps** — determine which of server, landing, mobile, or packages/ are affected.

2. **TDD if logic code** — si la tache implique de la logique metier, suivre Red-Green-Refactor (tests d'abord, implementation ensuite). Les conventions de test TomAI sont dans `.claude/rules/tdd.md`.

3. **Implement** — follow existing patterns, TypeScript strict (no `any`), max 400 lines per file.

4. **Validate per app:**
   - Server: `cd apps/server && bun run typecheck && bun run lint && bun test`
   - Landing: `cd apps/landing && pnpm typecheck && pnpm lint`
   - Mobile: `cd apps/mobile && pnpm typecheck && pnpm lint && pnpm test`
   - If packages/ changed, validate all dependent apps.

5. **If DB schema changed:** `cd apps/server && bun run db:generate` — commit the generated SQL files.

6. **Commit** — use conventional commits with monorepo scopes: `chat`, `server`, `landing`, `mobile`, `ci`, `db`, `auth`, `rag`. Stage files explicitly (never `git add .`).
