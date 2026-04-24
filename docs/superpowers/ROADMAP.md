# Workflow agents IA — Roadmap globale

> Master index des 6 phases. Statut transverse, liens specs + plans, décisions différées entre phases.
> **Dernière mise à jour** : 2026-04-24
> **Scope global** : "Full company-in-a-box" pour solo founder (dev + QA + ops + produit + design + marketing + support + legal + finance).
> **Contraintes transverses** : Claude Max 5x, 0€ outils tiers, autonomie maximale sauf merge `main` / deploy prod.

---

## Vue d'ensemble

| # | Phase | Portée | Statut | Spec | Plan |
|---|---|---|---|---|---|
| **0** | Fondations | Sécurité + observabilité + hub GitHub + staging + routines + baseline | 🟡 Spec commité, plan à écrire | [2026-04-24](specs/2026-04-24-phase-0-foundations-design.md) | _pending_ |
| **1** | Dev core | Orchestration multi-agent, PR review avancé, skills monorepo custom | ⚪ Non démarré | — | — |
| **2** | QA + observabilité + incident response | Agents triage Sentry / PostHog / E2E Maestro / on-call / perf regressions | ⚪ Non démarré | — | — |
| **3** | Product / delivery | Agent PM, feedback loops, RICE scoring, release notes | ⚪ Non démarré | — | — |
| **4** | Design + content + marketing | Agents design system, blog SEO, social, veille concurrentielle | ⚪ Non démarré | — | — |
| **5** | Support + legal + finance + research | Agents support L1, RGPD/CGU, finance, user research | ⚪ Non démarré | — | — |

Légende : 🟢 completed · 🟡 in progress · ⚪ not started · 🔴 blocked

---

## Phase 0 — Fondations

**Objectif** : poser les garde-fous, l'observabilité, le hub de coordination et le staging fiable qui rendent possibles les phases suivantes.

**Livrables clés** (détail dans le spec) :
- 0.1 Migration GitHub Action `ANTHROPIC_API_KEY` → `CLAUDE_CODE_OAUTH_TOKEN` + pin actions SHA
- 0.2 Ruleset `main` avec bypass list vide + Environment `production` required reviewer
- 0.3 Extension hooks Claude Code (push main, force push, prod deploys, exfil) + egress allowlist workflows
- 0.4 Sentry + PostHog free tier + MCP OAuth configuré
- 0.5 GitHub hub : constitution.md + issue templates + labels + Project v2
- 0.6 Staging Supabase recréé + Koyeb reconfigure + cron keepalive
- 0.7 3 Claude Code Routines (daily triage, weekly dep audit, weekly flag sweep)
- 0.8 Quotas + script monitoring
- 0.9 Baseline métriques (time-to-ship, MTTR, bug rate, coverage)

**Bloque** : toutes les phases suivantes (sécurité avant autonomie).
**Effort estimé** : ~8h implémentation (2-3 sessions).

---

## Phase 1 — Dev core

**Objectif** : démultiplier la vitesse de dev interne via orchestration d'agents spécialisés. Tirer parti de la couche sécurité Phase 0 pour donner aux agents plus d'autonomie safe.

**Livrables prévisionnels** (à détailler en brainstorming Phase 1) :
- Skills Claude Code custom monorepo : RAG codebase, enforcement patterns (Elysia handlers → services → repositories), Drizzle migrations, JSDoc Better Auth plugins
- Sub-agents définitions dans `.claude/agents/` : planner, coder, reviewer, security, perf, accessibility
- Cloud agent async handoff pattern (Claude Code Routines + GitHub Issue triage + PR creation)
- Ultra-review pre-merge workflow (sur top de CodeRabbit)
- `/feature-dev` enhanced avec contexte Tom (stack, patterns, migrations)
- MCP servers repo-specific : Eduscol RAG, Pronote helpers, Qdrant

**Bloque** : Phase 2 (agent QA veut un cycle dev prévisible avec PR structurés).
**Effort estimé** : 12-16h.

---

## Phase 2 — QA + observabilité + incident response

**Objectif** : maintenir la confiance en prod pendant la montée en vitesse de Phase 1. Les données Sentry + PostHog instrumentées en Phase 0 deviennent actionnables.

**Livrables prévisionnels** :
- Agent Sentry triage : MCP Sentry → Claude Code Routine → GitHub Issue structuré (cause probable, files touchés, repro steps)
- Agent PostHog insights : analyses hebdo (conversion funnel, rétention, sessions problématiques) → issue ou discussion
- Agent maintainer Maestro E2E : détection de feature nouvelle → proposition de tests E2E
- Agent on-call diagnostic : détection d'anomalie prod → investigation (logs Koyeb, traces Sentry) → proposition rollback ou hotfix
- Agent performance regressions : Vercel Analytics + EAS Insights deltas → alerte si régression détectée

**Bloque** : Phase 3 (PM agent veut un signal produit fiable, pas du bruit).
**Effort estimé** : 10-14h.

---

## Phase 3 — Product / delivery

**Objectif** : scaler le throughput produit sans que l'input utilisateur-solo devienne bottleneck.

**Livrables prévisionnels** :
- Agent PM : transforme idée (texte / conversation) → spec structuré (user story, critères acceptance, risques) → GitHub Issue + labels + Project + Figma mockup link
- Agent feedback loops : scrape reviews stores + support Intercom/email → cluster insights → issues (bug, feature request, UX pain)
- Agent RICE scoring : score auto du backlog Phase 0 hub
- Agent release notes : PRs mergées → GitHub release notes + changelog Linear-style + drafts social media (repris en Phase 4)

**Bloque** : Phase 4 (marketing agents ont besoin de contenu produit structuré).
**Effort estimé** : 10-12h.

---

## Phase 4 — Design + content + marketing

**Objectif** : produire contenu externe (design system cohérent, blog SEO, landing refresh, social).

**Livrables prévisionnels** :
- Agent design system keeper : Figma MCP + codebase parity checks (composants shadcn/ui landing + RNR mobile)
- Agent blog SEO writer : briefs → drafts → review humain → publication
- Agent landing copy refresh (périodique)
- Agent social media : release notes + milestones → posts drafts (LinkedIn, X/Bluesky, tech newsletter)
- Agent veille concurrentielle : Perplexity / Exa / HN monitoring sur "AI tutoring", "socratique", "Eduscol", etc.

**Bloque** : Phase 5 (support agent veut un ton éditorial consolidé).
**Effort estimé** : 8-10h.

---

## Phase 5 — Support + legal + finance + user research

**Objectif** : déléguer les fonctions support + conformité + finance + recherche utilisateur.

**Livrables prévisionnels** :
- Agent support L1 : répond aux questions simples utilisateurs (free tier Intercom Fin ou équivalent custom MCP)
- Agent RGPD/CGU : review DPA RevenueCat/Google/etc, compliance sweeps, alerte sur privacy changes détectées dans PRs
- Agent finance : reconciliation RevenueCat ↔ banque, invoicing basique, rapports mensuels
- Agent user research : synthèse interviews, analyse surveys, thématiques émergentes

**Effort estimé** : 10-15h.

---

## Décisions différées (transverses, à revisiter)

| Décision | Statut actuel | À revisiter quand |
|---|---|---|
| Seer Sentry ($40/contributor/mo) | Skip | >5 incidents/mois réels en Phase 2 |
| Linear / Notion payant | Skip (GitHub Issues suffit) | Volume tickets > capacité GitHub Projects en Phase 3 |
| Devin / cloud agents payants (≥100$/mo) | Skip | Besoin longue autonomie async non couvert par Routines en Phase 3 |
| GitHub App custom vs PAT fine-grained | PAT fine-grained | Besoin cross-repo en Phase 1+ |
| Migration `docs/plans/` → `specs/` | Garder existant | Jamais (pas de migration rétroactive) |
| Ephemeral PR envs (Supabase branching Pro ou Neon) | Skip (staging canonique suffit) | Agent QA Phase 2 en a vraiment besoin |
| CodeRabbit Free → Pro (12$/user) | Skip (Free suffit) | Review Free trop limité sur gros PRs en Phase 1 |
| Sentry Team plan (26$/mo, 50K errors) | Skip | >5K errors/mois en Phase 2 |
| GitHub Free → Pro (4$/mo) pour `required reviewers` sur Environment | Skip | Si Phase 2 agent déploie en prod et veut double verrou. Alt : rendre repo public (non souhaitable pour code pré-launch) |

---

## Prochaines actions (ordre)

1. ✅ Spec Phase 0 commité (`specs/2026-04-24-phase-0-foundations-design.md`)
2. ✅ ROADMAP global commité (ce document)
3. 🟡 **Review utilisateur du spec Phase 0** (en cours)
4. ⚪ Génération plan implémentation Phase 0 via `writing-plans` skill
5. ⚪ Exécution livrables 0.1 → 0.9 (voir ordre recommandé dans le spec)
6. ⚪ Validation Phase 0 (checklist §7 du spec)
7. ⚪ Brainstorming Phase 1 (Dev core)

---

## Changelog du roadmap

- **2026-04-24** — Création du ROADMAP. Spec Phase 0 rédigé. Décision de garder Supabase pour staging (parité prod + code déjà tuné).
