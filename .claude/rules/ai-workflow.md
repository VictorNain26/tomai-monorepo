# Workflow IA — ce que ce projet change

La convention générale (modèle et effort par rôle, quand déléguer, cycle
plan → implémentation → revue) vit dans `~/.claude/CLAUDE.md` et le frontmatter
de `~/.claude/agents/`. Ce fichier ne garde que les **écarts propres au monorepo**.

## Agents définis ici

| Agent | Modèle | Effort | Pourquoi il existe |
|-------|--------|--------|--------------------|
| `implementer` | sonnet | medium | Surcharge le `haiku` de l'agent user-level. Les tâches du dépôt touchent des routes Elysia typées, le schéma Drizzle, les types Eden Treaty : il y faut du jugement d'intégration. Pour un vrai travail mécanique (renommage, formatage), l'orchestrateur peut repasser `model: haiku` à l'appel. |
| `spec-reviewer` | sonnet | medium | Premier étage de revue : conformité à la spec, avant la revue de qualité. N'existe pas au niveau user. |

## Agents réutilisés tels quels

`planner` (opus/high), `code-reviewer` (opus/high), `Explore` (built-in) — définis
au niveau user, **ne pas les redéfinir ici**.

La revue d'architecture n'a pas d'agent dédié : ses critères vivent dans
`~/.claude/rules/architecture-review.md`, règle path-scopée qui se charge d'elle-même
sur tout fichier de code. Pour un checkpoint archi explicite, lancer `code-reviewer`
en lui donnant ces critères comme cadrage.

## Le levier

Ce qui rend l'exécution en sonnet fiable, c'est le **cadrage amont**. Un agent peu
coûteux sur une tâche floue invente, et le rattrapage coûte plus que l'économie.
Investir dans le plan est le multiplicateur, pas le choix de modèle.

## Déléguer ou faire soi-même

- **Déléguer** si la tâche est isolable *et* substantielle : ça préserve le contexte
  de l'orchestrateur et isole le bruit.
- **En direct** pour les micro-tâches (quelques lignes) : briefer coûte plus que faire.
- **Paralléliser** les tâches indépendantes : même coût en tokens, moins de temps.
