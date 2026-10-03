# Plan — feat/eval-error-analysis

Lot 1, point 4. Analyse d'erreurs sur les conversations réelles avant tout nouveau
vérificateur, selon le guide de Langfuse
(https://langfuse.com/guides/cookbook/error-analysis-llm-applications) : lecture ouverte,
regroupement en catégories, comptage, décision de ce qu'on corrige. Victor confie la
relecture à Claude (2026-10-03) : elle est donnée comme telle, une relecture humaine reste
due avant toute publication.

## Données

Les 38 conversations de l'échantillon d'accord (`etudes/2026-10-03/donnees/results.json`,
passage `aad5bba`). L'agent n'a pas changé depuis (aucun commit sur `modules/`, seuls
des commits du harnais) : ce sont les conversations du Tom actuel, sans rejouer ni coût
de tuteur.

## Tâches

1. Rejuger les 38 conversations avec le juge actuel (`eval:agreement --labels
   labels.claude.json`) : verdicts, accord avec l'annotation, coût par conversation.
2. Lecture ouverte des 38 conversations : ce que fait Tom, réussi ou raté, sans
   diagnostic.
3. Regroupement en catégories nommées et définies, comptées sur les 38.
4. Le juge face à la lecture : défauts manqués, fausses alarmes du code (calculs, double
   question), calculs laissés de côté par la règle prudente.
5. Unanimité des cinq tirages par question : base du nombre de tirages.
6. Rapport `etudes/2026-10-03/analyse-erreurs.md` et décision par catégorie : correctif
   de prompt (lot 2), vérificateur, question du juge à garder, simplifier ou retirer.
7. `docs/suivi.md`.

## Renvoyé

Les changements de code que le rapport décide (questions retirées, tirages, nouveaux
vérificateurs) : PR suivante.

## Validation

Rapport relu contre les données ; `bun run typecheck`, `bun run lint` si du code bouge.
