---
description: Develop a feature or fix in the monorepo
---

Implement the following task: $ARGUMENTS

Follow this workflow:

1. **Identify impacted apps** — determine which of server, landing, mobile, or packages/ are affected.

2. **Implement** — make the changes. Follow existing patterns, TypeScript strict (no `any`), max 400 lines per file.

3. **Validate per app:**
   - Server: `cd apps/server && bun run typecheck && bun run lint && bun test`
   - Landing: `cd apps/landing && pnpm typecheck && pnpm lint`
   - Mobile: `cd apps/mobile && pnpm typecheck && pnpm lint`
   - If packages/ changed, validate all dependent apps.

4. **If DB schema changed:** `cd apps/server && bun run db:generate` — commit the generated SQL files.

5. **Commit** — use conventional commits with monorepo scopes: `chat`, `server`, `landing`, `mobile`, `ci`, `db`, `auth`, `rag`. Stage files explicitly (never `git add .`).
