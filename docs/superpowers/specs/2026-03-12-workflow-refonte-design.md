# Refonte Workflow AI-Native 2026 — TomAI Monorepo

> Spec document — 12 mars 2026
> Objectif : Refondre le workflow developpeur pour un dev solo utilisant Claude Code, avec TDD enforce, review IA automatique, CI/CD optimise, et git hooks locaux.

---

## 1. Contexte et diagnostic

### 1.1 Ce qui fonctionne bien (a garder)

| Element | Detail |
|---------|--------|
| Structure monorepo | Turborepo + 3 apps + 3 packages, optimal pour la taille du projet |
| CI pipeline | `--affected`, matrix parallele, remote cache Vercel, SHA-pinned actions |
| Concurrency groups | Cancel-in-progress sur CI |
| Migration sync | Detection auto des changements schema DB |
| Security | Gitleaks secret detection, Dependabot auto-merge patch/minor |
| CLAUDE.md | Bien structure avec regles par app et `.claude/rules/` |
| Git workflow | staging/main avec merge commits only |

### 1.2 Gaps identifies

| Gap | Impact |
|-----|--------|
| Pas de git hooks | Feedback uniquement en CI (lent), erreurs poussees inutilement |
| TDD documente mais pas enforce | Pas de mecanisme qui force le cycle red-green-refactor |
| Pas de review IA automatique sur PR | Review uniquement manuelle ou via @claude (opt-in) |
| Settings Claude Code chaotiques | 136 lignes de permissions accumulees, pas de hooks configures |
| Pas de skills custom | Workflow dev/review non standardise |
| CI ne fait pas full run sur main | `--affected` sur main peut rater des regressions cross-package |
| Pas de SAST | Gitleaks couvre les secrets, mais pas les vulnerabilites code |

---

## 2. Architecture du workflow

### 2.1 Vue d'ensemble — Le pipeline complet

```
BOUCLE DE DEV QUOTIDIENNE
==========================

1. PLAN      → Claude brainstorm + spec
2. TEST      → Claude ecrit tests RED (TDD enforce par hooks Claude Code)
3. IMPLEMENT → Claude implemente GREEN (auto-test reminder apres chaque edit)
4. REFACTOR  → Claude refactor (Stop hook verifie que tests passent)
5. VALIDATE  → lefthook pre-commit (lint staged files + typecheck affected)
6. PUSH      → lefthook pre-push (test + build affected)
7. CI        → GitHub Actions (--affected sur staging, full sur main)
8. PR REVIEW → CodeRabbit Free (review auto) + `/review` local (Claude Code Max)
9. DEPLOY    → Auto (Vercel/Koyeb/EAS)
```

### 2.2 Git workflow : GitHub Flow + Worktrees

```
main (production, protege, deploy auto Vercel/Koyeb)
  ↑ PR + claude-code-action review automatique
staging (integration, CI auto sur push)
  ↑ merge depuis worktrees ou push direct (petits fixes)
  ├── .claude/worktrees/feature-auth/
  ├── .claude/worktrees/bugfix-123/
  └── .claude/worktrees/refactor-api/
```

**Regles :**
- `main` : Production. PR only depuis staging. Merge commit (jamais squash).
- `staging` : Dev quotidien. Push direct OK, CI auto.
- Worktrees : `claude --worktree feature-x` pour features/bugfix non-triviales. Auto-cleanup si pas de changements.
- Ajouter `.claude/worktrees/` au `.gitignore`

**Pourquoi les worktrees :**
- Sessions Claude Code paralleles sur features differentes sans conflit git
- Chaque worktree = branche isolee + repertoire isole
- Pattern recommande par Nx blog et communaute AI-assisted dev en 2026

---

## 3. Git Hooks : lefthook (sans lint-staged)

### 3.1 Pourquoi lefthook

| Critere | lefthook v2.1 | Husky v9 | simple-git-hooks |
|---------|---------------|----------|------------------|
| Execution parallele | Native | Manuel (shell &) | Non |
| Filtrage fichiers | Integre ({staged_files}, glob) | Necessite lint-staged | Necessite lint-staged |
| Support monorepo (root) | Natif | Non | Non |
| Config | YAML unique | Scripts shell disperses | JSON (1 cmd/hook) |
| Dependencies | 0 (binaire Go) | lint-staged requis | lint-staged requis |
| Performance | Sub-milliseconde (Go binary) | ~1ms + Node.js overhead | ~1ms |

**lefthook elimine le besoin de lint-staged** grace a `{staged_files}` et `glob` natifs.

### 3.2 Configuration

```yaml
# lefthook.yml (racine du monorepo)
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

### 3.3 Installation

```bash
pnpm add -wD @evilmartians/lefthook
npx lefthook install
```

Ajouter dans `package.json` racine :
```json
{
  "scripts": {
    "postinstall": "lefthook install"
  }
}
```

### 3.4 Feedback loop

| Hook | Duree estimee | Ce qui tourne |
|------|---------------|---------------|
| Pre-commit | ~5-8s | Lint (fichiers modifies, parallele par app) + typecheck affected |
| Pre-push | ~15-30s | Tests affected + build affected |
| CI | ~2-3min | Pipeline complete (affected sur staging, full sur main) |

---

## 4. Claude Code Hooks : TDD Enforcement

### 4.1 Configuration `.claude/settings.json`

Refonte complete — remplace le fichier vide actuel :

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

### 4.2 Configuration `.claude/settings.local.json`

Nettoyage des permissions — wildcards au lieu de 136 lignes :

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

### 4.3 Ce que les hooks font

| Hook | Type | Declencheur | Comportement |
|------|------|-------------|--------------|
| PostToolUse | command | Apres chaque Edit/Write | Rappel leger de lancer les tests (non bloquant) |
| Stop | prompt | Quand Claude veut terminer | LLM verifie si tests/typecheck ont ete lances. BLOCK si non. |

**Pourquoi ce design :**
- Le PostToolUse est un rappel leger, pas un lancement automatique de tests (trop lent, trop couteux a chaque edit)
- Le Stop hook est le vrai garde-fou : il empeche Claude de dire "c'est fait" sans avoir valide
- Le prompt-based hook permet un jugement contextuel (pas de tests necessaires si c'est du markdown, etc.)

---

## 5. CI/CD GitHub Actions — Optimise

### 5.1 Changements au `ci.yml` existant

**3 ameliorations :**

1. **`paths-ignore`** pour les fichiers non-code (.md, .vscode, LICENSE)
2. **Full run sur `main`** (pas de `--affected`) pour validation complete avant deploy prod
3. **`save-always: true`** sur le cache turbo pour sauvegarder meme en cas d'echec

```yaml
# Changement 1 : paths-ignore (exclut docs mais PAS CLAUDE.md ni .claude/)
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

# Changement 2 : full run sur main push (dans chaque job)
# Note: github.ref = refs/heads/main sur push, refs/pull/N/merge sur PR
# On veut full run uniquement sur push vers main (apres merge)
- name: Run ${{ matrix.task }}
  run: |
    if [ "${{ github.event_name }}" = "push" ] && [ "${{ github.ref }}" = "refs/heads/main" ]; then
      pnpm turbo run ${{ matrix.task }}
    else
      pnpm turbo run ${{ matrix.task }} --affected
    fi

# Changement 3 : dans setup-monorepo/action.yml
- uses: actions/cache@v4
  with:
    path: .turbo
    key: turbo-${{ runner.os }}-${{ inputs.turbo-cache-key }}-${{ github.sha }}
    restore-keys: turbo-${{ runner.os }}-${{ inputs.turbo-cache-key }}-
    save-always: true
```

### 5.2 Review IA automatique : CodeRabbit Free

**Pourquoi CodeRabbit Free au lieu de claude-code-action :**
- `claude-code-action` necessite une cle API Anthropic (pay-per-use, ~$5-15/mois)
- CodeRabbit Free offre une review IA automatique sur chaque PR, gratuitement
- 2M+ repos connectes, 13M+ PRs traites, 40+ linters/SAST integres
- Review ligne par ligne avec niveaux de severite
- Compatible GitHub, pas de cle API a payer

**Installation :**
1. Aller sur https://app.coderabbit.ai et connecter le repo GitHub
2. CodeRabbit s'active automatiquement sur chaque PR (zero config)
3. Optionnel : creer `.coderabbit.yaml` a la racine pour personnaliser :

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

**Complement avec `/review` local :**
- Avant de push, lancer `/review` localement (utilise l'abonnement Claude Max, gratuit)
- CodeRabbit review la PR automatiquement apres le push
- Double couverture : review locale + review CI, zero cout supplementaire

### 5.3 Workflow `claude-code.yml` existant

Le workflow `claude-code.yml` existant necessite `ANTHROPIC_API_KEY` (pay-per-use).
**Decision : le garder tel quel** (deja en place) mais ne pas l'etendre.
- Il s'active uniquement sur opt-in (`@claude` ou label `claude`)
- Cout quasi-nul si rarement utilise
- Si le cout API est un probleme, le workflow peut etre desactive sans impact

### 5.4 Securite : ajout Semgrep (SAST)

Ajouter dans `security.yml` :

```yaml
sast:
  name: SAST
  runs-on: ubuntu-latest
  container:
    image: semgrep/semgrep:latest  # TODO: pin to specific SHA digest after first run
  steps:
    - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683
    - name: Run Semgrep
      run: semgrep scan --config auto --error
      env:
        SEMGREP_APP_TOKEN: ${{ secrets.SEMGREP_APP_TOKEN }}
```

**Note :** Apres le premier run, noter le digest SHA de l'image semgrep et remplacer `latest` par le digest pour rester coherent avec la politique SHA-pinning du projet.

**Pourquoi Semgrep :** Plus rapide que CodeQL, moins de faux positifs pour TypeScript, tier gratuit suffisant, analyse semantique (pas juste regex). Detecte SQL injection, XSS, prototype pollution, etc.

---

## 6. Custom Skills Claude Code

### 6.1 Skill `/dev` — Workflow TDD

Fichier `.claude/skills/dev/SKILL.md` :

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

### 6.2 Skill `/review` — Review changes

Fichier `.claude/skills/review/SKILL.md` :

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

---

## 7. CLAUDE.md — Ajouts

Ajouter au `CLAUDE.md` racine du monorepo :

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

---

## 8. Fichiers a creer/modifier

### Fichiers NOUVEAUX

| Fichier | Description |
|---------|-------------|
| `lefthook.yml` | Configuration git hooks |
| `.coderabbit.yaml` | Configuration CodeRabbit (review IA gratuite sur PR) |
| `.claude/skills/dev/SKILL.md` | Skill TDD workflow |
| `.claude/skills/review/SKILL.md` | Skill review local |

### Fichiers MODIFIES

| Fichier | Modification |
|---------|-------------|
| `.claude/settings.json` | Ajout hooks (PostToolUse + Stop) |
| `.claude/settings.local.json` | Nettoyage permissions (wildcards) |
| `.github/workflows/ci.yml` | paths-ignore, full run sur main, save-always |
| `.github/workflows/security.yml` | Ajout Semgrep SAST |
| `.github/actions/setup-monorepo/action.yml` | save-always sur cache |
| `CLAUDE.md` (monorepo) | Section workflow TDD + hooks + review |
| `.claude/rules/tdd.md` | Supprimer reference au plugin `dev-standards` inexistant, enrichir avec cycle TDD enforce via hooks + skill `/dev` |
| `package.json` (racine) | Ajout lefthook devDep + postinstall |
| `.gitignore` | Ajout `.claude/worktrees/` |

### Fichiers INCHANGES

| Fichier | Raison |
|---------|--------|
| `turbo.json` | Deja optimal |
| `.github/workflows/auto-merge.yml` | Deja optimal |
| `.gitleaks.toml` | Deja optimal |
| Structure apps/ et packages/ | Deja optimale |

---

## 9. Estimation du cout

| Element | Cout supplementaire | Setup time |
|---------|---------------------|------------|
| Claude Code (dev + hooks + skills) | $0 (abonnement Max existant) | - |
| CodeRabbit Free (PR review auto) | $0 (tier gratuit) | 10min |
| lefthook (git hooks) | $0 (open-source) | 20min |
| Semgrep (SAST) | $0 (tier open-source) | 15min |
| claude-code.yml (existant, opt-in) | ~$0.10/utilisation (cle API) | deja en place |
| **Total** | **$0/mois** | **~2h** |

**Note :** L'ensemble du workflow fonctionne sans cout supplementaire grace a :
- Claude Code Max (hooks, skills, dev quotidien)
- CodeRabbit Free (review IA sur PR)
- Outils open-source (lefthook, Semgrep, Gitleaks)

---

## 10. Sources

- [Claude Code Official Docs — Hooks](https://code.claude.com/docs/en/hooks)
- [Claude Code Official Docs — GitHub Actions](https://code.claude.com/docs/en/github-actions)
- [Claude Code Official Docs — Worktrees](https://code.claude.com/docs/en/common-workflows)
- [Addy Osmani — AI Coding Workflow Going Into 2026](https://addyosmani.com/blog/ai-coding-workflow/)
- [TDD: The Missing Protocol for Effective AI Collaboration — 8th Light](https://8thlight.com/insights/tdd-effective-ai-collaboration)
- [Nx Blog — Git Worktrees for AI Agents](https://nx.dev/blog/git-worktrees-ai-agents)
- [Turborepo — GitHub Actions Guide](https://turborepo.dev/docs/guides/ci-vendors/github-actions)
- [Turborepo — Constructing CI](https://turborepo.dev/docs/crafting-your-repository/constructing-ci)
- [Lefthook v2 Documentation](https://github.com/evilmartians/lefthook)
- [DORA Report 2025 — AI Impact on DevOps](https://dora.dev/research/)
- [Semgrep vs GitHub Advanced Security](https://semgrep.dev/resources/semgrep-vs-github/)
- [CodeRabbit — AI Code Reviews](https://www.coderabbit.ai/)
- [Claude Code Action — GitHub Marketplace](https://github.com/marketplace/actions/claude-code-action-official)

---

*Document genere le 12 mars 2026*
*Base sur audit complet du monorepo + recherches etat de l'art 2026*
