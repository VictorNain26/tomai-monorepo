# Workflow AI-Native 2026 — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refondre le workflow developpeur du monorepo TomAI pour un dev solo avec TDD enforce, git hooks locaux, review IA gratuite, et CI optimise.

**Architecture:** lefthook pour la validation locale (pre-commit/pre-push), Claude Code hooks pour enforcer le TDD, CodeRabbit Free pour les reviews IA sur PR, CI GitHub Actions optimise avec full-run sur main. Zero cout supplementaire.

**Tech Stack:** lefthook, ESLint, Turborepo --affected, Semgrep, CodeRabbit Free, Claude Code hooks/skills

**Spec:** `docs/superpowers/specs/2026-03-12-workflow-refonte-design.md`

---

## Chunk 1: Git Hooks (lefthook)

### Task 1: Install lefthook and create config

**Files:**
- Create: `lefthook.yml`
- Modify: `package.json` (root)
- Modify: `.gitignore`

- [ ] **Step 1: Install lefthook**

```bash
pnpm add -wD @evilmartians/lefthook
```

- [ ] **Step 2: Create `lefthook.yml` at repo root**

```yaml
# lefthook.yml
#
# Note: les scripts lint de chaque app utilisent ESLint avec un scope fixe
# (ex: "eslint .", "eslint src"). On invoque ESLint directement avec les
# fichiers staged pour eviter ce probleme.
# Note Windows: lefthook est un binaire Go, {staged_files} utilise des
# forward slashes — compatible avec ESLint/Node sur Windows.

pre-commit:
  parallel: true
  jobs:
    - name: lint-server
      root: "apps/server/"
      glob: "*.ts"
      run: npx eslint {staged_files}

    - name: lint-mobile
      root: "apps/mobile/"
      glob: "*.{ts,tsx}"
      run: npx eslint --max-warnings 0 {staged_files}

    - name: lint-landing
      root: "apps/landing/"
      glob: "*.{ts,tsx}"
      run: npx eslint --max-warnings 0 {staged_files}

    - name: typecheck
      run: pnpm turbo run typecheck --affected --output-logs=errors-only

pre-push:
  parallel: true
  jobs:
    - name: test
      run: pnpm turbo run test --affected --output-logs=errors-only

    - name: build
      run: pnpm turbo run build --affected --output-logs=errors-only
```

- [ ] **Step 3: Add `postinstall` script to root `package.json`**

In `package.json`, add inside `"scripts"`:

```json
"postinstall": "lefthook install"
```

This goes after the existing `"db:studio"` script line. The rest of `package.json` stays unchanged.

- [ ] **Step 4: Add `.claude/worktrees/` to `.gitignore`**

Append at the end of `.gitignore`:

```
# Claude Code worktrees
.claude/worktrees/
```

- [ ] **Step 5: Run lefthook install**

```bash
npx lefthook install
```

Expected: `lefthook installed` message. Verify with `ls .git/hooks/pre-commit` — should exist.

- [ ] **Step 6: Test pre-commit hook**

Create a dummy change and test (note: `--dry-run` does NOT trigger hooks, use `lefthook run` directly):

```bash
echo "// test" >> apps/server/src/index.ts
git add apps/server/src/index.ts
npx lefthook run pre-commit
```

Expected: lefthook runs lint-server + typecheck in parallel. Then clean up:

```bash
git checkout -- apps/server/src/index.ts
```

- [ ] **Step 7: Commit lefthook setup**

```bash
git add lefthook.yml package.json pnpm-lock.yaml .gitignore
git commit -m "chore: add lefthook git hooks (pre-commit lint+typecheck, pre-push test+build)"
```

---

## Chunk 2: Claude Code Settings & Hooks

### Task 2: Configure Claude Code hooks for TDD enforcement

**Files:**
- Modify: `.claude/settings.json`
- Modify: `.claude/settings.local.json`

- [ ] **Step 1: Write `.claude/settings.json` with hooks**

Replace the current empty `{}` with:

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [
          {
            "type": "command",
            "command": "echo '[hook] File modified - remember to run tests'"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "prompt",
            "prompt": "Before stopping, verify: 1) Were code files modified in this session? 2) If yes, have the relevant tests been run and do they pass? 3) Does typecheck pass? If tests or typecheck should have been run but were not, respond with 'BLOCK' and explain what needs to be verified. If everything looks good or no code changes were made, respond with 'ALLOW'."
          }
        ]
      }
    ]
  }
}
```

- [ ] **Step 2: Replace `.claude/settings.local.json` with clean wildcards**

Replace the entire 136-line file with:

```json
{
  "permissions": {
    "allow": [
      "Read",
      "Edit",
      "Write",
      "Glob",
      "Grep",
      "Bash(pnpm *)",
      "Bash(bun *)",
      "Bash(git *)",
      "Bash(gh *)",
      "Bash(ls *)",
      "Bash(docker *)",
      "Bash(npx *)",
      "Bash(curl *)",
      "Bash(tree *)",
      "Bash(wc *)",
      "Bash(rm *)",
      "Bash(find *)",
      "Bash(dir *)",
      "Bash(node *)",
      "Bash(timeout *)",
      "Bash(aws *)",
      "mcp__context7__*",
      "mcp__github__*",
      "mcp__koyeb__*",
      "mcp__vercel__*",
      "WebSearch",
      "WebFetch"
    ]
  },
  "enableAllProjectMcpServers": true,
  "enabledMcpjsonServers": [
    "supabase"
  ]
}
```

- [ ] **Step 3: Commit settings**

```bash
git add .claude/settings.json
git commit -m "chore: add Claude Code hooks (PostToolUse reminder + Stop TDD enforcement)"
```

Note: `.claude/settings.local.json` is in `.gitignore` — not committed.

---

### Task 3: Create Claude Code custom skills

**Files:**
- Create: `.claude/skills/dev/SKILL.md`
- Create: `.claude/skills/review/SKILL.md`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p .claude/skills/dev .claude/skills/review
```

- [ ] **Step 2: Create `/dev` skill**

Create `.claude/skills/dev/SKILL.md`:

```markdown
---
name: dev
description: Develop a feature or fix with TDD workflow
---

Feature/fix: $ARGUMENTS

Follow this TDD workflow strictly.

**Test file conventions** (see `.claude/rules/tdd.md`):
- Server: `apps/server/src/tests/<service>.test.ts` (runner: `bun test`)
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
```

- [ ] **Step 3: Create `/review` skill**

Create `.claude/skills/review/SKILL.md`:

```markdown
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
```

- [ ] **Step 4: Commit skills**

```bash
git add .claude/skills/
git commit -m "feat: add /dev (TDD workflow) and /review (code review) Claude Code skills"
```

---

### Task 4: Update tdd.md and CLAUDE.md

**Files:**
- Modify: `.claude/rules/tdd.md`
- Modify: `CLAUDE.md` (monorepo root)

- [ ] **Step 1: Update `.claude/rules/tdd.md`**

Replace the entire file with:

```markdown
# TDD — Conventions TomAI

Le workflow TDD (Red-Green-Refactor) est enforce par :
- **Claude Code Stop hook** : bloque si les tests n'ont pas ete lances
- **Skill `/dev`** : guide le cycle RED → GREEN → REFACTOR automatiquement
- **lefthook pre-push** : empeche le push si les tests echouent

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

## Cycle TDD

1. **RED** : ecrire le test d'abord, verifier qu'il echoue
2. **GREEN** : implementer le minimum pour passer
3. **REFACTOR** : ameliorer sans casser les tests

Utiliser `/dev <description>` pour lancer le workflow automatiquement.

## Validation obligatoire avant commit

- Server : `cd apps/server && bun run typecheck && bun run lint && bun test`
- Mobile : `cd apps/mobile && pnpm typecheck && pnpm lint && pnpm test`
- Landing : `cd apps/landing && pnpm typecheck && pnpm lint`

lefthook execute automatiquement : lint pre-commit, test+build pre-push.
```

- [ ] **Step 2: Append workflow sections to `CLAUDE.md`**

Add the following **before** the existing `## Regles detaillees` section (line 60) in `CLAUDE.md`:

```markdown
## Workflow TDD

Toute feature/bugfix suit le cycle Red-Green-Refactor :
1. Ecrire les tests d'abord (RED) — ils doivent echouer
2. Implementer le minimum pour passer (GREEN)
3. Refactorer (REFACTOR) — tests doivent rester verts
4. Valider : `pnpm typecheck && pnpm lint && pnpm test`

Utiliser `/dev <description>` pour lancer le workflow TDD automatiquement.

## Git hooks (lefthook)

lefthook verifie automatiquement :
- Pre-commit : lint (fichiers modifies par app) + typecheck (affected)
- Pre-push : test (affected) + build (affected)

Bypass exceptionnel : `git commit --no-verify` (a eviter)

## Review IA

- PR staging→main : review automatique par CodeRabbit Free
- `/review` localement : review avant push (Claude Code Max, gratuit)
- @claude dans un commentaire PR : Claude repond (opt-in, cle API)

```

- [ ] **Step 3: Commit docs updates**

```bash
git add .claude/rules/tdd.md CLAUDE.md
git commit -m "docs: update TDD rules and CLAUDE.md with new workflow (lefthook, skills, review)"
```

---

## Chunk 3: CI/CD Optimization

### Task 5: Optimize ci.yml

**Files:**
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add `paths-ignore` to the `on:` block**

In `.github/workflows/ci.yml`, replace lines 6-10:

```yaml
on:
  push:
    branches: [main, staging]
  pull_request:
    branches: [main]
```

With:

```yaml
on:
  push:
    branches: [main, staging]
    paths-ignore:
      - 'docs/**/*.md'
      - 'README.md'
      - '.vscode/**'
      - 'LICENSE'
  pull_request:
    branches: [main]
    paths-ignore:
      - 'docs/**/*.md'
      - 'README.md'
      - '.vscode/**'
```

- [ ] **Step 2: Add full-run-on-main logic to `validate-tasks` job**

Replace line 43:

```yaml
      - run: pnpm turbo run ${{ matrix.task }} --affected
```

With:

```yaml
      - name: Run ${{ matrix.task }}
        run: |
          if [ "${{ github.event_name }}" = "push" ] && [ "${{ github.ref }}" = "refs/heads/main" ]; then
            pnpm turbo run ${{ matrix.task }}
          else
            pnpm turbo run ${{ matrix.task }} --affected
          fi
```

- [ ] **Step 3: Apply same logic to `test` job**

Find and replace the `run:` line for the test step. **Important: preserve the `env:` block that follows.**

Replace:

```yaml
      - run: pnpm turbo run test --affected
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL || 'postgresql://localhost:5432/test' }}
          BETTER_AUTH_SECRET: ${{ secrets.BETTER_AUTH_SECRET || 'ci-test-secret-not-for-production' }}
```

With:

```yaml
      - name: Run tests
        run: |
          if [ "${{ github.event_name }}" = "push" ] && [ "${{ github.ref }}" = "refs/heads/main" ]; then
            pnpm turbo run test
          else
            pnpm turbo run test --affected
          fi
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL || 'postgresql://localhost:5432/test' }}
          BETTER_AUTH_SECRET: ${{ secrets.BETTER_AUTH_SECRET || 'ci-test-secret-not-for-production' }}
```

- [ ] **Step 4: Apply same logic to `build` job**

Replace line 92:

```yaml
      - run: pnpm turbo run build --affected
```

With:

```yaml
      - name: Run build
        run: |
          if [ "${{ github.event_name }}" = "push" ] && [ "${{ github.ref }}" = "refs/heads/main" ]; then
            pnpm turbo run build
          else
            pnpm turbo run build --affected
          fi
```

- [ ] **Step 5: Commit ci.yml changes**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add paths-ignore for docs, full run on main push"
```

---

### Task 6: Add save-always to setup-monorepo

**Files:**
- Modify: `.github/actions/setup-monorepo/action.yml`

- [ ] **Step 1: Add `save-always: true` to turbo cache step**

In `.github/actions/setup-monorepo/action.yml`, at line 31 (after `restore-keys:`), add:

```yaml
        save-always: true
```

The cache block should look like:

```yaml
    - uses: actions/cache@0057852bfaa89a56745cba8c7296529d2fc39830 # v4.3.0
      with:
        path: .turbo
        key: turbo-${{ runner.os }}-${{ inputs.turbo-cache-key }}-${{ github.sha }}
        restore-keys: turbo-${{ runner.os }}-${{ inputs.turbo-cache-key }}-
        save-always: true
```

- [ ] **Step 2: Commit**

```bash
git add .github/actions/setup-monorepo/action.yml
git commit -m "ci: add save-always to turbo cache (preserve cache on failure)"
```

---

### Task 7: Add Semgrep SAST to security.yml

**Files:**
- Modify: `.github/workflows/security.yml`

- [ ] **Step 1: Add Semgrep job after the existing `secrets` job**

Append after line 31 (end of the `secrets` job):

```yaml

  sast:
    name: SAST
    runs-on: ubuntu-latest
    container:
      image: semgrep/semgrep:latest
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.2.2
      - name: Run Semgrep
        run: semgrep scan --config auto --error
        env:
          SEMGREP_APP_TOKEN: ${{ secrets.SEMGREP_APP_TOKEN }}
```

Note: After the first successful run, pin the Semgrep image to its SHA digest for consistency with the project's SHA-pinning policy.

- [ ] **Step 2: Add `SEMGREP_APP_TOKEN` secret to GitHub**

Go to GitHub repo → Settings → Secrets and variables → Actions → New repository secret.
Name: `SEMGREP_APP_TOKEN`. Value: get from https://semgrep.dev/manage/settings (free account).

If you want to skip the token for now, Semgrep still works without it (just no dashboard). Remove the `env:` block in that case.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/security.yml
git commit -m "ci: add Semgrep SAST scanning to security pipeline"
```

---

## Chunk 4: CodeRabbit Free + Final Verification

### Task 8: Configure CodeRabbit Free

**Files:**
- Create: `.coderabbit.yaml`

- [ ] **Step 1: Create `.coderabbit.yaml` at repo root**

```yaml
# .coderabbit.yaml
language: fr
reviews:
  profile: assertive
  path_instructions:
    - path: "apps/server/**"
      instructions: "TypeScript strict, Elysia.js patterns, Drizzle ORM, never any"
    - path: "apps/mobile/**"
      instructions: "Expo SDK 55, NativeWind, React Native Reusables only"
    - path: "apps/landing/**"
      instructions: "Next.js 16, shadcn/ui only, no custom CSS"
```

- [ ] **Step 2: Connect CodeRabbit to GitHub repo**

Go to https://app.coderabbit.ai → Sign in with GitHub → Select the `tomai-monorepo` repo → Enable.

This is a manual step — CodeRabbit installs as a GitHub App and will automatically review all future PRs.

- [ ] **Step 3: Commit**

```bash
git add .coderabbit.yaml
git commit -m "chore: add CodeRabbit config for automated PR reviews"
```

---

### Task 9: Final verification

- [ ] **Step 1: Run full validation**

```bash
pnpm typecheck && pnpm lint && pnpm test
```

Expected: all pass (no regressions from config changes).

- [ ] **Step 2: Test pre-commit hook end-to-end**

Make a small change to any `.ts` file, stage it, and commit. Verify lefthook runs lint + typecheck.

- [ ] **Step 3: Verify Claude Code hooks are loaded**

Start a new Claude Code session and check that the hooks are active. Edit a file — you should see `[hook] File modified - remember to run tests`.

- [ ] **Step 4: Test `/dev` and `/review` skills**

In Claude Code, run:
- `/dev` — should show the TDD workflow prompt
- `/review` — should show the review workflow prompt

- [ ] **Step 5: Push to staging and verify CI**

```bash
git push origin staging
```

Check GitHub Actions — CI should run with `--affected` (not full), and security should include the new Semgrep SAST job.

- [ ] **Step 6: Create test PR staging→main**

```bash
gh pr create --base main --head staging --title "chore: workflow AI-native 2026 refonte" --body "$(cat <<'EOF'
## Summary
- Add lefthook git hooks (pre-commit lint+typecheck, pre-push test+build)
- Add Claude Code hooks for TDD enforcement (Stop hook)
- Add /dev and /review custom skills
- Optimize CI: paths-ignore, full run on main, save-always cache
- Add Semgrep SAST to security pipeline
- Add CodeRabbit config for automated PR reviews
- Update CLAUDE.md and tdd.md with new workflow docs

## Test plan
- [ ] lefthook pre-commit runs on commit
- [ ] lefthook pre-push runs on push
- [ ] CI passes on staging push
- [ ] Semgrep SAST job runs in security workflow
- [ ] CodeRabbit reviews this PR automatically
- [ ] Claude Code Stop hook blocks if tests not run
- [ ] /dev skill shows TDD workflow
- [ ] /review skill shows review workflow

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Verify: CodeRabbit should automatically review this PR within a few minutes.

---

## Summary of all commits

| # | Commit message | Files |
|---|---------------|-------|
| 1 | `chore: add lefthook git hooks (pre-commit lint+typecheck, pre-push test+build)` | lefthook.yml, package.json, pnpm-lock.yaml, .gitignore |
| 2 | `chore: add Claude Code hooks (PostToolUse reminder + Stop TDD enforcement)` | .claude/settings.json |
| 3 | `feat: add /dev (TDD workflow) and /review (code review) Claude Code skills` | .claude/skills/dev/SKILL.md, .claude/skills/review/SKILL.md |
| 4 | `docs: update TDD rules and CLAUDE.md with new workflow` | .claude/rules/tdd.md, CLAUDE.md |
| 5 | `ci: add paths-ignore for docs, full run on main push` | .github/workflows/ci.yml |
| 6 | `ci: add save-always to turbo cache` | .github/actions/setup-monorepo/action.yml |
| 7 | `ci: add Semgrep SAST scanning to security pipeline` | .github/workflows/security.yml |
| 8 | `chore: add CodeRabbit config for automated PR reviews` | .coderabbit.yaml |
