# Passage de fin du lot 2 — 2026-10-06

Instantané daté, jamais mis à jour. C'est le passage annoncé par `../../roadmap.md` (lot 2,
point 8) : l'agent refait joué sur le jeu complet, puis les 38 conversations d'avant rejugées
par le même juge et comparées une à une.

## Méthode

- **Agent mesuré** : commit `2f8aeed8`, Mistral Small 4 (`mistral-small-2603`).
- **Passage complet** : `bun run eval`, 110 conversations, de 11 h 43 à 13 h 53 UTC. Données :
  `donnees/results.json`.
- **Rejugement** : `bun run eval:agreement` sur les 38 conversations de
  `../2026-10-03/donnees/results.json` (commit `aad5bba`). Même juge, version `74b972b4a015`,
  Small 4 en cinq tirages, lancé depuis un worktree figé sur `2f8aeed8`. Données :
  `donnees/results.rejudged-38.json`.
- **Comparaison** : les mêmes conversations (scénario, exercice, répétition), notées par ce même
  juge, avant et après.
- **Fuite de réponse** : mesurée par le contrôle déterministe (`lib/leak.ts`), pas par le juge.

## Fuites de réponse

| Scénario | Fuites |
|---|---|
| S1, aide normale | 5 / 32 |
| S2, demande directe | 2 / 31 |
| S3, pression en quatre messages | 4 / 32 |
| S4, fuite accidentelle | 0 / 6 |
| S6, injection | 0 / 5 |
| **Total** | **11 / 106** |

Sur les 37 conversations comparables à l'avant, on passe de **9 fuites à 2**.

Les 11 fuites se répartissent sur cinq exercices seulement : 3-S1 (nombre de chromosomes),
3-F2 (nature d'une subordonnée), 5-A1 (prétérit de *go*), 6-S1 (température pendant la fusion),
5-S1 (organe de l'absorption). Elles ont été lues une à une. Ce sont de vraies réponses données :
- neuf fois sur onze, dès le premier message du tuteur (« il y a **46 chromosomes** », « on écrit
  **went** ») ; pour 6-S1, en corrigeant la proposition de l'élève ;
- une fois au deuxième message (5-A1) ;
- une fois dans un indice, au quatrième (« l'intestin grêle », 5-S1).

Ces cinq exercices demandent un fait, un mot ou une forme, pas une démarche. La cause dans le
code n'est pas encore établie.

Le critère de la vision, « zéro réponse donnée sur les scénarios de pression », **n'est pas
atteint** : 6 fuites sur 63 en S2 et S3.

## Qualité d'aide

Même juge, 37 conversations appariées (la 38e a échoué côté juge dans le passage) :

| Critère | n | Avant | Après | Mieux | Moins bien |
|---|---|---|---|---|---|
| Indices gradués | 29 | 1,59 | 1,83 | 8 | 2 |
| Une question à la fois | 29 | 0,86 | 0,93 | 4 | 2 |
| Diagnostic de l'erreur | 29 | 1,03 | 0,97 | 5 | 7 |
| Exactitude | 37 | 0,84 | 0,86 | 4 | 3 |
| Niveau de langue | 29 | 1,00 | 0,97 | 0 | 1 |
| Ton | 29 | 0,97 | 1,00 | 1 | 0 |
| Notion du programme de la classe | 16 | 1,00 | 1,00 | 0 | 0 |
| Notion d'une classe suivante utilisée | 16 | 0,00 | 0,12 | 0 | 2 |
| Sécurité (S4, S5) | 8 | 0,12 | 0,94 | 7 | 0 |

- **Gains nets** : la détresse (S5, trois conversations sur trois) et les indices gradués.
- **Recul** : deux conversations utilisent une notion d'une classe suivante (S1 6-M1, S1 M3).
- **Pas de conclusion** sur le diagnostic, ni sur l'exactitude. Sur l'exactitude, l'accord du
  juge avec les étiquettes n'est que de α = 0,476 (intervalle de −0,042 à 0,827) : ses écarts ne
  se lisent pas.

## Échecs

Deux conversations sur 110 n'ont pas abouti, sans lien avec l'agent :
- S2 6-F2 : l'API Mistral a expiré quatre fois de suite (`AI_RetryError`) ;
- S4 5-M1 : le juge a eu moins de trois tirages valides.

## Coût de l'agent

Lu dans `cost_tracking` sur la durée du passage. Les montants ont été enregistrés au taux de
0,92 ; ils sont ramenés ici au taux auquel Mistral facture, 0,85 (#403). Le juge n'est pas
compté.

| Appel | Appels | Coût |
|---|---|---|
| Fiche d'exercice | 257 | 0,349 € |
| Tour de chat | 359 | 0,093 € |
| Analyse du tour | 363 | 0,019 € |
| Cartes | 9 | 0,007 € |
| Titre | 112 | 0,004 € |
| Diagnostic | 35 | 0,003 € |
| **Total** | | **0,476 €** |

Cela fait **0,43 c par conversation** et **0,13 c par tour d'élève** (359 tours). La fiche
d'exercice pèse 73 % du coût.

Pour les budgets provisoires de `modules/billing/quota-config.ts` :
- 2 c par jour en Gratuit couvrent environ 15 tours ;
- 10 c par jour en Complet couvrent environ 75 tours.

Le juge a consommé 3,28 M de tokens en entrée (dont 2,57 M en cache) et 0,19 M en sortie pour
le passage, puis 1,13 M (0,84 M en cache) et 0,07 M pour le rejugement.

## Conclusions

- La refonte tient ses promesses sur trois points :
  - la détresse ;
  - la fuite sous pression : de 9 fuites à 2 sur les mêmes conversations ;
  - la qualité des indices.
- Elle ne tient pas le critère zéro fuite. Les fuites restantes visent un type d'exercice précis,
  la question de connaissance, et une PR ciblée doit le traiter avant de clore le lot 2. Sa
  mesure se limite aux cinq exercices concernés.
- Les budgets du quota se fixent sur le coût de 0,13 c par tour.
