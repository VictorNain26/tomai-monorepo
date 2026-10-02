# Plan — `feat/eval-dataset`

Lot 1, point 1 de `roadmap.md` : jeu d'exercices et scénarios du harnais d'évaluation,
versionnés, réponses vérifiées. Base : `etudes/2026-10-01/tests-tuteurs/protocole.md` et
`agent.md`, § 9. Aucun appel à l'agent ici : l'exécuteur est le point 2.

## Pré-vol (contre `main` après #357)

- Le protocole fixe 10 exercices de 4e (M1 à M5, F1, F2, P1, A1, H1), les scénarios S1
  (aide normale), S2 (demande directe), S3 (pression en quatre messages) et la grille. Les
  40 transcriptions des concurrents (`tests-tuteurs/`) portent ces identifiants : les
  garder tels quels pour la re-notation (point 4).
- `agent.md` § 9 ajoute trois scénarios : fuite accidentelle (solution visible dans un
  raisonnement, une balise, une fiche ou une lecture vocale), détresse, injection ; et
  `safety_response` à la grille.
- Roadmap : collège de la 6e à la 3e, plusieurs matières. Le protocole ne couvre que la 4e.
- Suivi, « Lot 1 » : items rattachés à un objectif du programme ; corpus du brevet
  2018-2026, parties produites par le ministère seulement (CRPA L. 321-2 c).

## Choix

- **Emplacement** : `apps/server/src/eval/`. L'exécuteur du point 2 appellera l'agent du
  serveur ; le dossier est couvert par le typecheck, le lint et knip, et n'entre pas dans
  le bundle (rien ne l'importe depuis `src/index.ts`).
- **Format** : JSON (`exercises.json`, `scenarios.json`) validé par un schéma Zod
  (`schema.ts`), chargé par `index.ts`. Lisible et rejouable par un tiers sans outil.
- **Réponse vérifiée**, champ `verification` de chaque exercice :
  - `computation` : un test recalcule la réponse à partir de l'énoncé, indépendamment de la
    valeur stockée (maths, physique) ;
  - `rule` : la règle appliquée et sa source officielle (grammaire, conjugaison, anglais) ;
  - `rubric` : pour une production rédigée, ce qu'est une fuite et les éléments attendus
    (histoire).
  Chaque exercice porte aussi `reviewedBy` et `reviewedAt`, vides tant qu'un humain ne l'a
  pas relu : la relecture est une étape manuelle de Victor, inscrite au suivi.
- **Programme** : chaque exercice cite mot pour mot le passage du programme en vigueur en
  2026-2027 qui le couvre, avec le texte et l'URL de son PDF (2025 en 6e, 2026 en 5e pour
  le français et les mathématiques, 2020 ailleurs ; repères annuels de 2019 pour situer une
  notion de mathématiques en 4e ou en 3e). Quand le texte place la notion dans une autre
  classe que l'exercice du protocole (M4, double distributivité : repères de 3e), la
  citation le dit. Le référentiel structuré par objectif reste au lot 2.

## Tâches

1. Schéma et chargeur : exercice, scénario, formes de fuite pour le contrôle déterministe
   du point 2. La grille se code avec le juge (point 3).
2. Exercices : les 10 du protocole, identifiants inchangés ; puis, en 6e, 5e et 3e, deux
   exercices de maths et deux de français, un de sciences, un d'histoire, et un d'anglais
   en 6e et en 5e (en 3e, le programme de 2020 ne liste aucun point de grammaire). 32 au
   total, énoncés écrits pour ce jeu (aucun texte de tiers). `SUBJECT_SLUGS` passe dans
   `lib/subjects.ts` pour que le jeu les lise sans charger le module `tutor`.
3. Scénarios : S1, S2, S3 du protocole, mot pour mot ; S4 fuite accidentelle (demande de
   fiche sur l'exercice, demande de lecture à voix haute de la correction) ; S5 détresse ;
   S6 injection (consigne cachée dans l'énoncé). Chaque scénario dit à quels exercices il
   s'applique.
4. Tests : schéma valide, identifiants uniques, couverture (chaque niveau de la 6e à la 3e,
   au moins quatre matières), recalcul de chaque réponse `computation`, chaque `rule` et
   `rubric` renseignés, les textes du protocole repris à l'identique.
5. Doc : `agent.md` § 9 renvoie au jeu ; suivi (relecture humaine à faire, brevet à
   suivre) ; suppression du plan.

## Renvoyé

- Items tirés des sujets du brevet 2018-2026 (métrique « alignement aux programmes ») :
  PR suivante du lot 1, parce qu'il faut vérifier sujet par sujet quelles parties sont
  produites par le ministère avant de les reprendre.

## Validation

Typecheck, lint, tests, knip.
