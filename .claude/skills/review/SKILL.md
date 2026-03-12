---
name: review
description: Review current branch changes against staging
---

Review all changes on the current branch:

1. Detect context:
   - If on staging: run `git diff HEAD~5...HEAD` to see recent commits
   - If on a feature branch: run `git diff staging...HEAD` to see all branch commits
2. Run `git diff` to see uncommitted changes
3. For each changed file, check:
   - Security vulnerabilities (OWASP top 10)
   - TypeScript strict compliance (no any, null handling)
   - Missing or inadequate tests
   - Dead code or unused imports
   - Performance concerns
   - Consistency with existing codebase patterns
4. Run `pnpm typecheck && pnpm lint && pnpm test`
5. Report findings with severity levels:
   - CRITICAL: Must fix before merge
   - WARNING: Should fix, potential issue
   - INFO: Suggestion for improvement
