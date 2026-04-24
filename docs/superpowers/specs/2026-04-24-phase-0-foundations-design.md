# Phase 0 — Fondations workflow agents IA

> Spec design
> Date : 2026-04-24
> Auteur : Victor Lenain + Claude (brainstorming)
> Statut : En attente de review utilisateur
> Prérequis Phase 1 : approbation de ce spec + plan d'implémentation généré

---

## 1. Contexte

### 1.1 Pourquoi maintenant

Tom est un monorepo solo-dev (landing Next.js 16 + server Bun/Elysia + mobile Expo SDK 55) avec un outillage IA déjà installé mais partiel : Claude Code local avec superpowers skills, Claude Code GitHub Action (sur API key), CodeRabbit Free, Dependabot, Semgrep, Gitleaks, lefthook, hooks PreToolUse/Stop basiques.

L'ambition est de passer d'un **outillage IA ponctuel** à un **workflow d'agents IA end-to-end** couvrant dev, QA, observabilité, produit, design, marketing, support, legal et finance ("full company-in-a-box"). Cela se fait en **6 phases** (0 → 5), dont la présente spec cadre la Phase 0.

### 1.2 Scope complet visé (phases ultérieures, non couvertes ici)

| Phase | Portée | Statut |
|---|---|---|
| **0** | Fondations (sécurité, observabilité, hub, staging) | **Objet de ce spec** |
| 1 | Dev core (orchestration multi-agent, PR review avancé, skills custom monorepo) | Différé |
| 2 | QA + observabilité + incident response | Différé |
| 3 | Product / delivery (PM agent, feedback loops, roadmap) | Différé |
| 4 | Design + content + marketing | Différé |
| 5 | Support + legal + finance + user research | Différé |

Chaque phase suit le cycle spec → plan → implémentation → validation avant de démarrer la suivante.

### 1.3 Audit de l'existant

**Outillage IA déjà en place :**
- `.claude/settings.json` : hooks PreToolUse (bloque `rm -rf /`, `DROP DATABASE`, `db:push *prod|staging`) + Stop hook (force validation avant exit)
- `.claude/commands/review.md` : commande custom de review branche
- `.github/workflows/claude-code.yml` : claude-code-action v1 sur Sonnet 4.6, trigger label `claude` ou `@claude`, 25 tours max, tools allowlistés. **Auth via `ANTHROPIC_API_KEY`** (à migrer).
- `.github/workflows/ci.yml` : typecheck / lint / test / build avec Turborepo `--affected` + remote cache
- `.github/workflows/security.yml` : Gitleaks + Semgrep SAST
- `.github/workflows/auto-merge.yml` : auto-merge Dependabot patch/minor
- `.coderabbit.yaml` : reviews automatiques sur PR main/staging
- `.github/dependabot.yml` : updates npm + actions + docker hebdomadaires

**Manques identifiés :**
- Observabilité applicative (Sentry + PostHog "en cours" dans CLAUDE.md)
- Environnement staging cassé (Supabase DB dropped, Koyeb `tomai-staging` déployé mais non fiable)
- Pas de hub de coordination pour agents (Issues GitHub utilisées ad-hoc, pas de convention)
- Pas de baseline métriques pour mesurer l'impact des phases suivantes
- Auth GitHub Action sur API key (coût inutile vu abonnement Max 5x)
- Hooks Claude Code limités (ne couvrent pas push main, force push, prod deploys, exfil via curl|bash)
- Pas d'Environment `production` GitHub avec required reviewer
- Branch protection `main` à migrer vers Ruleset (bypass list vide impossible avec classic)

---

## 2. Objectifs

### 2.1 Objectifs

1. **Sécuriser** l'autonomie maximale des agents en garantissant qu'aucun agent ne puisse atteindre la production sans approbation explicite de Victor
2. **Migrer auth** du workflow Claude Code vers OAuth subscription Max 5x (zéro coût API)
3. **Instrumenter** les 3 apps avec Sentry + PostHog (free tier) pour fournir aux agents de Phase 2 des données actionnables
4. **Restaurer** un environnement staging fiable sur free tier (migration Supabase → Neon)
5. **Codifier** les conventions monorepo (constitution + specs + labels + templates) pour que les agents travaillent de manière prévisible
6. **Poser la baseline métriques** (time-to-ship, MTTR, bug rate) avant que les phases 1-5 introduisent du changement mesurable

### 2.2 Non-objectifs (différés aux phases suivantes)

- Agents d'incident response / triage Sentry (Phase 2)
- Agent product manager / PM (Phase 3)
- Orchestration multi-agent locale avancée (Phase 1)
- Seer ($40/contributor/mois — trop cher pour le stade actuel)
- Linear / Notion payant (GitHub suffit)
- Devin / cloud agents payants (Claude Code Routines suffit)

---

## 3. Contraintes

| Contrainte | Valeur | Source |
|---|---|---|
| Plan Claude | Max 5x (quota partagé CLI + Action + claude.ai + Desktop) | Utilisateur |
| Budget outils tiers | 0€/mois — free tiers exclusivement | Utilisateur |
| Autonomie agents | Maximale, sauf merge `main` et déploiement prod | Utilisateur |
| OS dev local | Windows 11 + bash (Git Bash) | Environnement |
| Monorepo | Turborepo + pnpm workspaces | Existant |
| Conventions TS | TS strict, zéro `any`, 400 lignes max, zéro ESLint warnings | CLAUDE.md |
| Deploy | Vercel (landing), Koyeb (server), EAS (mobile) | Existant |
| Git workflow | `staging` → PR → `main` (merge commit uniquement) | CLAUDE.md |

---

## 4. Policy matrix agents

### 4.1 Actions AUTORISÉES (sans approbation humaine)

- Créer branches, commits, PRs
- Merger vers `staging` après succès CI + review (auto-review Claude + CodeRabbit)
- Déployer en preview : Vercel preview, Koyeb staging, EAS preview Android/iOS
- Lancer tests, lints, typecheck, E2E Maestro
- `db:generate`, `db:push` dev local uniquement
- Ouvrir/commenter/triager issues GitHub
- Poster commentaires sur PRs, demander changements

### 4.2 Actions INTERDITES (garde-fous déterministes)

| Action | Garde-fou |
|---|---|
| `git push origin main` | Hook PreToolUse Claude Code + branch protection Ruleset |
| Merger PR vers `main` | CODEOWNERS required review + pas d'auto-approve + Ruleset bypass vide |
| `git push --force` n'importe où | Ruleset "Block force pushes" |
| Delete branch remote | Ruleset "Restrict deletions" |
| Deploy prod (Koyeb / Vercel / EAS submit) | Environment `production` avec required reviewer Victor |
| `pnpm workflow:prod:android|ios` | Hook PreToolUse + Environment `production` |
| `db:push` contre DATABASE_URL prod/staging | Hook existant (déjà en place) |
| Lecture `.env`, secrets | Permission deny existante (déjà en place) |
| `curl ... | bash/sh` | Nouveau hook PreToolUse (anti-exfil) |
| Raw dump `env`/`printenv` | Nouveau hook PreToolUse (anti-exfil) |

### 4.3 Actions nécessitant approbation humaine explicite

- Merge PR vers `main` (clic "Merge" par Victor dans UI GitHub)
- Workflows `workflow:prod:*` (required reviewer Environment `production`)
- Modification de `.github/workflows/` ou `.github/settings` (workflow perms `actions: write` et `workflows: write` retirées)
- Publication paquet, release tag

---

## 5. Architecture

Phase 0 est organisée en **4 couches** livrées en séquence partielle :

### 5.1 Couche Sécurité (prérequis bloquant)

Ruleset `main` avec bypass list vide + CODEOWNERS required + GitHub Environment `production` avec required reviewer. Hooks Claude Code étendus. `harden-runner` avec egress allowlist sur tous les workflows qui invoquent claude-code-action.

**Rationale :** tout ce qui suit ne peut être confié à un agent sans ces garde-fous. En particulier, la classe d'attaque "Comment and Control" divulguée en avril 2026 (prompt injection via commentaires PR/issue → exfiltration de credentials via réponse agent) impose l'egress allowlist + prompt boundary dès cette phase.

### 5.2 Couche Auth & économie

Migration `ANTHROPIC_API_KEY` → `CLAUDE_CODE_OAUTH_TOKEN` pour claude-code-action. Pin tous les actions GitHub par SHA (au lieu de tag). Audit workflows : retirer permissions superflues (`actions: write`, `workflows: write` hors cas justifiés).

**Rationale :** zéro coût API (Max 5x couvre). Défense supply chain via pinning SHA (vulnérabilité documentée sur `@v1`).

### 5.3 Couche Observabilité & coordination

- **Sentry** : RN SDK v8 (mobile) + Node/Bun SDK (server) + Next.js SDK (landing), source maps uploadés. Config fail-safe (env secrets en CI).
- **PostHog** : React Native SDK 3.2+ (mobile dev build requis), Web JS (landing). Autocapture activé + session replay. Feature flags config.
- **MCP Sentry** + **MCP PostHog** connectés dans Claude Code via OAuth (config `~/.claude.json` ou per-project).
- **GitHub hub** : issue templates (`bug.yml`, `feature.yml`, `agent-task.yml`), labels (`agent:safe`, `agent:review-needed`, `blocked:human`, `area:server|mobile|landing|db|ci`), Project v2 "Tom Agents" avec custom fields `Agent` / `Risk` / `Context-budget` / `Spec-link`.
- **Spec Kit convention** : `constitution.md` à la racine (codifie les contraintes CLAUDE.md) + `specs/NNN-feature-slug/` (remplace `docs/plans/` à terme, mais on garde `docs/plans/` pour l'existant).

**Rationale :** Sentry + PostHog posent les données que Phase 2 consommera. Le hub GitHub natif évite Linear/Notion payants et colle à l'écosystème déjà utilisé par l'agent (MCP GitHub déjà opérationnel dans la session courante).

### 5.4 Couche Infrastructure & métriques

- **Staging** : migration Supabase → Neon (free tier offre 100 CU-h, branches illimitées, 10 projets, 5GB). Schema pushé via `drizzle-kit push`. Koyeb `tomai-staging` reconfiguré sur Neon connstring. Cron keepalive GitHub Actions pour éviter scale-to-zero pendant les heures de travail (~30 min/mois).
- **EAS preview** wired sur staging URL via profile `preview` (15 builds/plateforme/mois suffisent).
- **Claude Code Routines** (lancé 14 avril 2026, Max 5x = 15 runs/jour, tourne dans cloud Anthropic, consomme pas les minutes GH Actions) : 3 routines initiales (daily triage 09h Paris, weekly dep audit lundi 09h, weekly unused flag sweep lundi 09h).
- **Quotas & alertes** : seuils doc dans `docs/metrics/quotas.md` : GH Actions minutes (80% de 2000), Claude Max weekly (notifier), Sentry errors (80% de 5K), PostHog events (80% de 1M).
- **Baseline métriques** : fichier `docs/metrics/baseline-2026-04.md` avec valeurs actuelles de time-to-ship, MTTR, bug rate, agent PR merge rate, tests coverage.

**Rationale :** Neon > Supabase Free pour l'agentique (pas de pause 1 semaine, branching gratuit). Routines cloud Anthropic débarrassent les tâches scheduled de la contrainte minutes GH Actions. Baseline métriques permet d'évaluer l'impact des phases 1-5.

---

## 6. Livrables

Les livrables sont ordonnés par dépendance. Chaque ligne est atomique (peut être implémentée + validée + committée séparément).

| ID | Livrable | Dépendance | Validation |
|---|---|---|---|
| **0.1** | Migration auth GH Action `ANTHROPIC_API_KEY` → `CLAUDE_CODE_OAUTH_TOKEN` + pin actions par SHA | — | Test `@claude` sur issue mock → réponse 200 |
| **0.2** | Ruleset `main` (bypass list vide, CODEOWNERS required, status checks required, block force push, restrict deletions) + Ruleset `staging` (status checks uniquement) + Environment `production` avec required reviewer Victor | — | Tentative de push direct sur main refusée, PR avec auto-approve refusée |
| **0.3** | Extension `.claude/settings.json` PreToolUse hooks (patterns : push main, force push, reset --hard main, gh pr merge --admin, prod deploys Vercel/Koyeb/EAS, curl\|bash, env dumps) + suffix anti-prompt-injection dans `.github/workflows/claude-code.yml` + `step-security/harden-runner` egress allowlist sur workflows agent | — | Chaque pattern testé via commande bash déclenchant le hook, exit code 2 vérifié |
| **0.4** | Sentry install (3 SDKs) + PostHog install (2 SDKs) + MCP Sentry config + MCP PostHog config + smoke event envoyé depuis chaque app | 0.1, 0.2, 0.3 | Event test visible dans dashboards Sentry et PostHog, MCP accessible dans Claude Code (`sentry list issues`) |
| **0.5** | `constitution.md` racine repo + structure `specs/` + issue templates YAML + labels créés via `gh label create` + Project v2 "Tom Agents" avec 4 custom fields | — | Ouvrir issue test via template agent-task → apparaît dans Project avec champs remplis |
| **0.6** | Neon project `tomai-staging` créé + schema pushé + Koyeb `tomai-staging` reconfigure sur Neon connstring + EAS profile `preview` pointant URL Koyeb + cron keepalive GH Actions | 0.1, 0.2 | `curl https://<koyeb-staging>/health` retourne 200 après 2h idle |
| **0.7** | 3 Claude Code Routines configurées (daily triage, weekly dep audit, weekly flag sweep) | 0.1, 0.3, 0.5 | Chaque routine tourne une fois manuellement + poste résultat en commentaire GitHub |
| **0.8** | `docs/metrics/quotas.md` avec seuils + script `scripts/check-quotas.sh` qui inspecte via API (GH, Sentry, PostHog) et sort un rapport markdown | 0.4 | Script exécuté localement produit rapport sans erreur |
| **0.9** | `docs/metrics/baseline-2026-04.md` avec valeurs : time-to-ship (median merge→deploy sur 30j), MTTR (dernières 3 incidents), bug rate (issues `bug` / semaine), test coverage (server + mobile), agent PR merge rate (0 à ce stade, baseline) | 0.4, 0.5 | Fichier committé, chiffres sourcés (lien commits / issues / workflow runs) |

**Ordre d'implémentation recommandé :** 0.2 → 0.3 → 0.1 → 0.5 → 0.4 → 0.6 → 0.7 → 0.8 → 0.9

Rationale : sécurité avant autonomie (0.2/0.3 d'abord), auth pour éviter coût API (0.1 rapide), hub avant observabilité (conventions avant données), staging après auth (agents pourront déployer), routines en dernier car consomment les fondations, quotas/baseline en toute fin (mesure l'état de sortie).

---

## 7. Critères d'acceptation Phase 0

Phase 0 est considérée **terminée** quand tous les éléments suivants sont vérifiables :

- [ ] Un PR créé par Claude Code GH Action (auteur = `github-actions[bot]` ou un PAT agent) ne peut **pas** être mergé vers `main` sans approval de Victor (test : tentative dry-run, vérifier blocage Ruleset)
- [ ] `git push origin main` en local déclenche le hook PreToolUse et bloque avec exit 2
- [ ] `.github/workflows/claude-code.yml` n'utilise plus `ANTHROPIC_API_KEY` ; Secret `CLAUDE_CODE_OAUTH_TOKEN` configuré au niveau repo
- [ ] Toutes les actions GitHub (4 workflows × ~6 steps = ~24 uses) sont pinnées par SHA
- [ ] Sentry capture des events des 3 apps (vérifié dans dashboard : mobile + server + landing)
- [ ] PostHog capture des events des apps clients (mobile + landing)
- [ ] MCP Sentry + MCP PostHog accessibles dans Claude Code (test : `search_issues`, `list_dashboards`)
- [ ] `tomai-staging` Koyeb répond 200 sur `/health` (après 2h d'idle — cron keepalive efficace)
- [ ] Au moins 1 Routine tourne sur schedule et poste un résultat en commentaire GitHub
- [ ] `constitution.md` existe à la racine, référencé depuis CLAUDE.md
- [ ] 3 issue templates + 5 labels agent + Project v2 créés ; test agent-task visible dans Project
- [ ] `docs/metrics/baseline-2026-04.md` committé avec 5 métriques sourcées

---

## 8. Risques & mitigations

| Risque | Impact | Mitigation |
|---|---|---|
| Claude Code Routines lancé très récemment (14 avril 2026), API/setup instables | Moyen — Routines sont "bonus", pas critiques | Livrable 0.7 isolé en fin d'ordre, fallback cron GitHub Actions si Routines cassent |
| Migration staging Supabase → Neon casse des données existantes | Faible (staging déjà cassé, DB dropped) | Schema pushé via Drizzle = source de vérité, pas de migration de données |
| "Comment and Control" prompt injection attack sur workflows agent | Élevé (exfil credentials) | Egress allowlist `step-security/harden-runner` + prompt boundary + retrait permissions `actions: write`/`workflows: write` (livrable 0.3) |
| Quota Max 5x dépassé par Routines + Action + usage local | Moyen | Quota monitoring livrable 0.8 + offload vers models moins chers (Sonnet 4.6) pour bulk work dans Action |
| CODEOWNERS + self-approve permet quand même merge (edge case si agent tourne en PAT Victor) | Élevé (contourne garde-fou) | GitHub bloque natifement self-approve si auteur = reviewer. Ruleset "Require review from Code Owners" + "Dismiss stale reviews" double le verrou |
| Hooks Windows-specific syntax différente de Linux (regex, quoting) | Faible (hooks tournent local Windows uniquement) | Tester chaque hook en Git Bash Windows avant commit, documenter syntaxe bash utilisée |

---

## 9. Décisions différées (à revisiter Phase 1+)

- **Linear vs Notion vs GitHub Issues** : on reste sur GitHub Issues pour Phase 0. Re-évaluer à Phase 3 (Product / Delivery) quand le volume de tickets justifie potentiellement un outil dédié.
- **Seer Sentry** : skip pour l'instant (40$/contributor). Re-évaluer si >5 incidents/mois en Phase 2.
- **Devin / cloud agents payants** : skip pour l'instant. Claude Code Routines + Claude Code GH Action devraient couvrir. Re-évaluer Phase 3 si besoin de longue autonomie async.
- **GitHub App custom vs PAT fine-grained** : PAT fine-grained pour Phase 0 (plus simple solo), migrer vers GitHub App si besoin cross-repo.
- **Migration `docs/plans/` vers `specs/`** : garder `docs/plans/` pour l'existant, utiliser `specs/` pour les nouveaux. Pas de migration rétroactive.

---

## 10. Références

### 10.1 Recherche avril 2026 (sources vérifiées lors du brainstorming)

**Auth & sécurité :**
- Anthropic : [Claude Code GitHub Actions docs](https://code.claude.com/docs/en/github-actions)
- [claude-code-action setup.md](https://github.com/anthropics/claude-code-action/blob/main/docs/setup.md)
- [Claude Code Hooks reference](https://code.claude.com/docs/en/hooks)
- Trail of Bits : [claude-code-config settings.json](https://github.com/trailofbits/claude-code-config/blob/main/settings.json)
- GitHub : [About rulesets](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets)
- [GH Changelog : GitHub Actions early April 2026](https://github.blog/changelog/2026-04-02-github-actions-early-april-2026-updates/)
- SecurityWeek : [Claude Code / Gemini CLI / Copilot Agents prompt injection](https://www.securityweek.com/claude-code-gemini-cli-github-copilot-agents-vulnerable-to-prompt-injection-via-comments/)
- Aonan Guan : [Comment and Control disclosure](https://oddguan.com/blog/comment-and-control-prompt-injection-credential-theft-claude-code-gemini-cli-github-copilot/)

**Observabilité :**
- [Sentry Pricing](https://sentry.io/pricing/)
- [Seer pricing Jan 2026](https://sentry.zendesk.com/hc/en-us/articles/45551407771931-What-is-the-pricing-for-Seer-January-21-2026)
- [Sentry MCP docs](https://docs.sentry.io/product/sentry-mcp/)
- [PostHog Pricing](https://posthog.com/pricing)
- [PostHog MCP docs](https://posthog.com/docs/model-context-protocol)

**Hub & staging :**
- GH Changelog : [Agent activity in Issues/Projects (March 2026)](https://github.blog/changelog/2026-03-26-agent-activity-in-github-issues-and-projects/)
- GH : [github-mcp-server](https://github.com/github/github-mcp-server)
- [GitHub Spec Kit](https://github.com/github/spec-kit)
- [Claude Code Routines (April 2026)](https://blog.laozhang.ai/en/posts/routines-in-claude-code)
- [Neon plans (April 2026)](https://neon.com/docs/introduction/plans)
- [Neon + Koyeb integration](https://neon.com/docs/guides/koyeb)
- [Koyeb scale-to-zero](https://www.koyeb.com/docs/run-and-scale/scale-to-zero)

### 10.2 Documents internes

- `CLAUDE.md` (racine, monorepo, server, mobile)
- `.claude/rules/testing-and-commits.md`
- `.claude/rules/database-migrations.md`
- `docs/AGENT-IA-ROADMAP.md` (Tom-as-agent, pas ce spec)
- `docs/plans/` (plans historiques, conservés)

---

## 11. Prochaines étapes

1. **Review utilisateur** du présent spec (Victor relit, demande ajustements)
2. **Après approval** : invocation du skill `writing-plans` pour générer le plan d'implémentation détaillé (`docs/superpowers/plans/2026-04-24-phase-0-foundations-plan.md`)
3. **Après approval plan** : exécution livrable par livrable (0.2 → 0.3 → … → 0.9), validation individuelle
4. **Après completion Phase 0** : brainstorming Phase 1 (Dev core)
