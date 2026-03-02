---
description: Review current branch changes against main
---

Review the current branch against `main` for production readiness.

## Steps

1. **Get the diff:** run `git diff main...HEAD` and `git log main..HEAD --oneline` to understand all changes.

2. **Check each category:**

   - **TypeScript strict** — no `any`, no `@ts-ignore`, no unhandled `null`/`undefined`
   - **Security** — no secrets, no `.env` files committed, no SQL injection, no XSS vectors
   - **API contracts** — changes in `packages/api/` or `packages/shared-types/` are backwards-compatible
   - **Monorepo conventions** — imports use workspace packages, no circular dependencies, files under 400 lines
   - **DB migrations** — if `schema.ts` changed, drizzle SQL files are generated and committed, new columns are nullable

3. **Report findings** with this format:
   - `[BLOQUANT]` file:line — description (must fix before merge)
   - `[SUGGESTION]` file:line — description (nice to have)

4. **If bloquants found:** propose auto-fix for each one. Ask for confirmation before applying.

5. **Summary:** overall assessment — ready to merge or not, with reasoning.
