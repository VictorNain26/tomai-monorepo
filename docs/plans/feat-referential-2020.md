# Plan — `feat/referential-2020`

Lot 1, point 3, deuxième PR : mathématiques et français de 4e et de 3e en 2026-2027. Écrit
après les premières explorations de la branche, faute de l'avoir fait au démarrage.

## Pré-vol (contre `main` après #363)

- Le programme du cycle 4 de 2020 (PDF Éduscol, 139 pages) n'est balisé qu'en façade :
  l'arbre de structure ne couvre que la page 2. Il est écrit par cycle, sans répartition par
  classe. Il n'est pas extrait : injecté tel quel, il donnerait à un élève de 4e les notions
  de 5e et de 3e.
- La note de service n° 2019-072 (BOEN n° 22 du 29 mai 2019) répartit par classe :
  attendus de fin d'année (annexes 11 à 18) et repères annuels de progression (19 à 26),
  encore valables en 4e et 3e en français et mathématiques (`etudes/2026-10-01/education-nationale.md`).
  Tous balisés.
- Le jeu de données ouvert « Compléments aux programmes du second degré » associe ces
  annexes aux mauvaises classes (l'annexe 14, donnée pour la 4e, est intitulée « Attendus
  de fin d'année de 5e ») et ne liste pas l'annexe 25. La classe de chaque annexe est lue sur
  l'en-tête rendu de son PDF : 15 et 16 pour la 4e, 17 et 18 pour la 3e, 25 et 26 pour les
  repères du cycle 4.
- Attendus : chaque H1 est un attendu de fin de cycle ; « Ce que sait faire l'élève » ouvre
  la liste par classe ; « Exemples de réussite » sont des exercices, écartés. Les thèmes
  sont en H2 (4e) ou en H3 (3e).

## Tâches

1. Sources d'une seule classe (`level`), rubriques « Ce que sait faire l'élève » et
   « Exemples de réussite », niveau de thème fixé par le premier titre, phrase coupée après
   une virgule ; tests.
2. Extraction des attendus de 4e et de 3e (annexes 15 à 18), formules vérifiées à l'œil ;
   les textes de 2025 et 2026 inchangés.
3. `programmeFor` : attendus de 2019 en 4e jusqu'en 2026-2027, en 3e jusqu'en 2027-2028.
4. Doc : suivi (prochaine action, défaut du jeu de données) ; suppression du plan.

## Renvoyé

- Repères annuels de progression du cycle 4 (annexes 25 et 26), en tableaux par classe : PR
  suivante, avec le rattachement des exercices.

## Validation

Typecheck, lint, tests, knip ; extraction rejouée à l'identique.
