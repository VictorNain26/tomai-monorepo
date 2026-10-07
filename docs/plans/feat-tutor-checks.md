# Plan — les contrôles purs du tuteur (étape 5, PR 2a)

Pré-vol (2026-10-07) : source du portage, le code de #415 (`050d2a63`), relu, pas copié ; mathjs
15.2.0, vérifié le jour même (non archivé, dernier commit le 2026-09-13, 4,7 M de
téléchargements par semaine). Les tests de fuite qui rejouaient les tours du jeu
(`renderTurns`) reviennent avec le harnais, étape 8.

## Problème

Le tuteur ne doit jamais laisser passer la réponse ni un calcul faux, et la détresse se juge par
le code, jamais par le prompt. Ces décisions sont des fonctions pures : elles se portent d'abord,
testées sans modèle, avant les étapes du tour qui les appellent (PR 2b).

## Critères d'acceptation

- [ ] `domain/typography.ts`, `domain/leak.ts` : une forme de la réponse retrouvée en KaTeX, en
      typographie française ou dite à l'oral, jamais dans un mot ou un nombre plus long.
- [ ] `domain/written-equalities.ts` : les égalités numériques écrites, recalculées par mathjs ;
      celles de l'élève, citées, ne sont pas des erreurs.
- [ ] `domain/exercise-math.ts` : racines d'une équation de degré 3 au plus, égalité de deux
      réponses, contrôle d'une réponse contre l'équation ; `null` hors de portée, entrées bornées.
- [ ] `domain/distress.ts` : la réponse fixe validée par Victor et les règles françaises, avec
      leurs deux corpus de phrases.
- [ ] Les tests de #415 portés, cas nominaux et limites.

## Hors périmètre

Les étapes qui appellent Mistral, les crans, le contrôle de sortie : PR 2b.

## Vérification de bout en bout

`bun run typecheck && bun run lint && bun run test`, knip vert.

## Décision humaine

Étape 5 validée par Victor le 2026-10-06 ; découpage en PR délégué le 2026-10-07.
