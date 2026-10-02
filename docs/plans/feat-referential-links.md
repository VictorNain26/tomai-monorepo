# Plan — `feat/referential-links`

Lot 1, point 3, troisième PR : rattacher les exercices du jeu d'évaluation au référentiel.
Écrit après les premières explorations de la branche.

## Pré-vol (contre `main` après #364)

- Le référentiel couvre les mathématiques et le français de la 6e à la 3e pour 2026-2027
  (`programmeFor`) ; pas encore les sciences, l'histoire-géographie ni l'anglais.
- 6e et 5e : la citation du programme de chaque exercice est le libellé d'une entrée. 4e et
  3e : les exercices citent le programme de 2020 ou les repères de 2019, les entrées sont
  des attendus de fin d'année ; le rattachement se choisit à la main.
- M4 (double distributivité), exercice de 4e du protocole, ne correspond à aucun attendu
  de 4e, seulement à un attendu de 3e.
- Repères annuels de 2019 (annexes 25 et 26) : non extraits ; les attendus des classes
  suivantes donnent déjà les notions « pas encore vues ».

## Tâches

1. Champ `alignment` du jeu : entrées travaillées, entrées des classes suivantes à ne pas
   mobiliser ; nul tant que la matière n'a pas de référentiel.
2. Rattachement des 19 exercices de mathématiques et de français.
3. Test : rattachement présent si et seulement si un programme est en vigueur, entrées
   existantes de la même matière, en vigueur dans la classe ou d'une classe suivante, M4
   seul exercice au-delà de sa classe.
4. Doc : `agent.md` § 9, suivi ; suppression du plan.

## Validation

Typecheck, lint, tests, knip.
