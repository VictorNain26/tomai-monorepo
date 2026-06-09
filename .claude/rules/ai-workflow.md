# Workflow IA — modèle par rôle (équilibre coût/perf)

Comment répartir le travail entre l'orchestrateur et les sous-agents, et **quel modèle + quel effort** pour chaque rôle. Complète (ne remplace pas) le workflow superpowers et `.claude/rules/testing-and-commits.md`.

## Principe

Le coût d'une **erreur de jugement** (mauvaise archi, bug raté en revue) écrase les tokens économisés. Donc : downgrader agressivement l'**exécution** et la **recherche** ; garder le premium sur le **jugement** (design, revue adversariale, décisions irréversibles).

## Modèle par rôle

| Rôle | Agent | Modèle | Effort |
|------|-------|--------|--------|
| Orchestration en **conception** (brainstorm, design, plan, décisions) | session | **opus** | xhigh |
| Orchestration en **exécution** (plan figé) | session | **sonnet** (via `/model`) | high (via `/effort`) |
| Planification | `planner` (user-level) | opus | high |
| Implémentation cadrée | `implementer` (projet) | **sonnet** ; `haiku` (trivial) | medium ; low (trivial) |
| Revue de conformité spec | `spec-reviewer` (projet) | sonnet | medium |
| Revue de qualité de code | `code-reviewer` (user-level) | sonnet | medium |
| Revue archi / sécu / contrats | `architecture-reviewer` (user-level) | opus | xhigh |
| Exploration / recherche read-only | `Explore` (built-in) | inherit ; `haiku` (gros volume) | low |

`model:` et `effort:` vivent dans le frontmatter de chaque agent (source de vérité) ; sans `effort:`, l'agent hérite de l'effort de la session. La convention générale est au user-level (`~/.claude/CLAUDE.md` + `~/.claude/agents/`) — ce tableau ne garde que les valeurs résolues côté projet. Réutilise les agents user-level et le built-in **tels quels** — ne pas les recréer dans le projet.

## Le levier (non-évident)

Ce qui *permet* l'exécution économe (sonnet/haiku), c'est la **qualité du cadrage amont**. Un agent peu coûteux sur une tâche floue invente, et l'orchestrateur brûle plus à rattraper qu'il n'a économisé. **Investir dans le plan** (`writing-plans`, en opus) est le multiplicateur : un plan tâche-par-tâche rend le travail exécutable par des agents sonnet/haiku sans supervision lourde.

## Quand déléguer vs faire soi-même

- **Déléguer** quand la tâche est isolable **et** substantielle (préserve le contexte de l'orchestrateur, isole le bruit).
- **Faire en direct** les micro-tâches (≤ quelques lignes) : l'overhead de briefer un sous-agent dépasse le gain.
- **Paralléliser** les tâches indépendantes (gain de wall-clock, même coût en tokens).

## Cycle d'exécution d'un plan

`plan (opus) → implementer (sonnet) → spec-reviewer (sonnet) → code-reviewer (sonnet) → checkpoint archi/sécu (architecture-reviewer, opus) sur les points chauds uniquement`.
