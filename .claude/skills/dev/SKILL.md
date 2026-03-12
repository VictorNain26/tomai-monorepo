---
name: dev
description: Develop a feature or fix with TDD workflow
---

Feature/fix: $ARGUMENTS

Follow this TDD workflow strictly.

**Test file conventions** (see `.claude/rules/tdd.md`):
- Server: `apps/server/src/tests/<service>.test.ts` (runner: `bun run test`)
- Mobile: `apps/mobile/__tests__/<path>/<name>.test.ts` (runner: `pnpm test`)

## Phase 1: Understand
1. Read relevant existing code and tests
2. Understand the current architecture and patterns

## Phase 2: RED — Write failing tests
3. Write tests in the correct location per conventions above
4. Run tests — confirm they FAIL (this is expected)
5. If tests pass already, the feature may already exist — investigate

## Phase 3: GREEN — Implement
6. Write the minimum code to make tests pass
7. Run tests — confirm they PASS
8. Do NOT over-engineer. Minimum viable implementation.

## Phase 4: REFACTOR
9. Refactor if needed (duplication, naming, structure)
10. Run tests after each refactor — they must stay GREEN

## Phase 5: Validate
11. Run full validation: typecheck + lint + test for the affected app
12. Fix any issues found

## Phase 6: Commit
13. Stage only relevant files
14. Commit with descriptive message
