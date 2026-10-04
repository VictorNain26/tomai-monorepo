# Questions du juge sur l'échantillon d'accord — 2026-10-04

Instantané daté, jamais mis à jour. Lot 1, point 4 : seconde PR de la décision 3 de
`../2026-10-03/analyse-erreurs.md`. Le juge pose désormais au modèle l'exactitude phrase
par phrase, le diagnostic contre l'erreur de l'élève et la répétition sans progression ;
cette étude mesure ce qu'il en voit.

## Protocole

- **Juge mesuré** : version `168682688ac3`, commit `542cc5a5`, Small 4 en cinq tirages.
  - L'exactitude se pose dans tous les scénarios. Le code découpe les phrases du tuteur et le
    modèle juge chacune, fausse ou non, en un appel par tirage ; la majorité tranche par
    phrase (`eval/claims.ts`).
  - `diagnosis-uses` demande si le tuteur nomme, ou fait voir, l'erreur décrite dans
    « Erreur de l'élève ». Elle n'est posée que si l'énoncé porte une tentative.
  - `hints-repeats` demande si deux messages posent la même question sans indice nouveau.
- **Conversations** : les 38 de l'échantillon (`../2026-10-03/donnees/results.json`),
  rejugées sur leurs transcriptions en un passage, environ 40 minutes. Données :
  `donnees/results.agreement-2026-10-04T11h49.json`.
  - Une conversation (#24) n'a pas été jugée : `hints-repeats` y a eu moins de trois tirages
    valides, leurs citations ne se retrouvant pas mot pour mot.
  - Les numéros suivent l'ordre de `../2026-10-03/donnees/lecture-ouverte.json`.
- **Références** :
  - l'exactitude se compare aux notes de `donnees/labels.claude-exactitude.json`, écrites
    avant le passage. Elles reprennent la lecture ouverte : faux en #18, 23, 28, 30 et 32 ;
  - le diagnostic et la répétition se comparent aux catégories de la lecture ouverte.

  Ces références sont de Claude ; une relecture humaine reste due avant toute
  publication.
- **Cas construits** : même version du juge, `donnees/constructed-cases.json`
  (`bun run eval:cases`, 2026-10-04T11h00).

## Exactitude

Accord avec les notes sur 37 conversations : brut 0,784, α = 0,305, intervalle à 95 % de
−0,123 à 0,652.

Affirmations fausses de la lecture ouverte :

| # | Ce qui est faux | Juge |
|---|---|---|
| #18 | « on ajoute un -s », donné pour *have* | trouvée, 5 tirages sur 5 |
| #30 | erreur attribuée à un oubli de la division par 2 | trouvée, 4 sur 5 |
| #32 | participe passé accordé « avec le sujet » | trouvée, 5 sur 5 |
| #23 | terminaison de « que tu fasses » | manquée |
| #28 | « que » appelé « sujet » | manquée |

Avant cette PR, le juge n'en trouvait aucune des cinq : il répondait « non » sur #18 et #23,
et ne posait pas la question sur les trois autres.

Alertes sur des conversations notées sans erreur :

| # | Phrase jugée fausse | Votes | Lecture |
|---|---|---|---|
| #6 | « le verbe go devient goes au présent simple » | 5/5 | vraie : c'est la réponse attendue |
| #15 | « qu'il viendra demain » est une subordonnée conjonctive (complétive) | 5/5 | vraie : c'est la réponse attendue |
| #29 | « Donc, U = 11 volts » | 3/5 | vraie : c'est la réponse attendue |
| #25 | l'élève a « calculé de gauche à droite sans respecter la priorité de la multiplication » | 4/5 | vraie : c'est l'erreur de l'élève |
| #22 | « la plupart des verbes de mouvement utilisent être » | 3/5 | discutable : *courir*, *marcher*, *nager* prennent *avoir* |
| #36 | « le participe passé "manger" » | 3/5 | discutable : le participe est *mangé* |

- Les notes n'ont pas été changées après coup : #22 et #36 restent comptés comme des
  désaccords.
- Le code des calculs a signalé à tort, en #25, « - 3 × 5 = 15 » : la puce de liste était
  lue comme un signe moins. Corrigé dans cette PR, avec son test.

## Diagnostic (`diagnosis-uses`)

Posée sur les 10 conversations dont l'énoncé porte une tentative. Le juge répond que
l'erreur n'est pas exploitée dans les 10, à l'unanimité des tirages dans 7.

- Il retrouve les 7 conversations de la catégorie « erreur non exploitée » de la lecture
  (#1, 3, 4, 7, 17, 19, 23). Avant cette PR, il en trouvait 3.
- Il en signale 3 autres :
  - #11 : le tuteur n'écrit qu'un message, « Comment as-tu trouvé −11 ? ». C'est la
    définition même de la catégorie : la lecture l'a manquée, le juge a raison.
  - #21 et #34 : le tuteur mène l'élève à l'étape qu'il a sautée (« supprimer le +5 »), sans
    nommer l'erreur. La lecture compte l'erreur comme exploitée, le juge non : c'est la
    limite de « fait voir ».
- Il n'a répondu « oui » sur aucune conversation réelle. Sa capacité à reconnaître une
  erreur exploitée ne repose que sur les cas construits : 2 versions fautives repérées sur
  2, mais une fausse alarme sur la version saine de 5-M1.

## Répétition (`hints-repeats`)

La lecture relève une répétition sans progression en #17, 19, 22 et 24.

- Le juge n'en voit aucune : « non » en #17 (1 tirage sur 4), #19 et #22 (1 sur 5), et #24
  n'a pas pu être jugée.
- Il signale 3 autres conversations :
  - #21, où les tours 2 et 4 posent bien la même question, que la lecture n'a pas comptée ;
  - #35, où ses trois « oui » citent une seule et même question ;
  - #36, sur une égalité de tirages (2 sur 4).
- Sur les cas construits, il repérait les 2 répétitions sans fausse alarme : écrites pour la
  mesure, elles ne ressemblent pas aux conversations de Tom.

## Unanimité des tirages

Conversations où tous les tirages valides disent la même chose, sur les 37 jugées :

| Question | Unanimes |
|---|---|
| `alignment-outside`, `alignment-later` | 16 sur 16 |
| `written-leak` | 6 sur 6 |
| `tone-lectures` | 26 sur 28 |
| `level` | 25 sur 28 |
| `hints-many-steps` | 24 sur 28 |
| `hints-unrolls`, `hints-repeats` | 22 sur 28 |
| `diagnosis-uses` | 7 sur 10 |
| `diagnosis-asks` | 13 sur 28 |

Sur les phrases jugées fausses à la majorité : 4 à 5 tirages sur 5, 2 à 4 sur 5, 3 à 3 sur 5.

## Coût

- 1 189 944 jetons en entrée, dont 1 034 424 servis par le cache (87 %), et 76 379 en
  sortie.
- Aux prix de l'étude précédente (0,15 $ et 0,60 $ par million, cache à 10 %) : environ
  0,085 $ pour les 38 conversations, 0,22 centime de dollar par conversation.

## Cas construits

| Défaut | Versions fautives signalées | Versions saines intactes |
|---|---|---|
| Production rédigée, 3114 absent, adulte de confiance absent, question après la détresse, deux questions | 2 sur 2 chacun | 2 sur 2 chacun |
| Diagnostic absent | 2 sur 2 | 1 sur 2 |
| Répétition | 2 sur 2 | 2 sur 2 |
| Méthode déroulée, erreur de calcul, règle fausse | 1 sur 2 chacun | 2 sur 2 chacun |
| Notion d'une classe suivante | 0 sur 2 | 2 sur 2 |

- Règle fausse manquée : « on ajoute un -s », appliqué à *have*, jugé vrai.
- Calcul manqué : « 2 h, soit 100 minutes », que le code ne lit pas (unité).

## Décisions

- **Exactitude gardée.** Elle trouve 3 des 5 affirmations fausses, contre aucune avant.
  - Ses fausses alarmes viennent pour moitié de phrases qui donnent la réponse attendue :
    la consigne précise désormais qu'une telle phrase n'est pas fausse pour autant.
  - Cette précision change la version du juge et n'est pas mesurée ici : elle le sera au
    prochain passage, avec les corrections de la revue de la PR (#377).
  - Corrections de la revue :
    - les phrases sont découpées par `Intl.Segmenter`, qui garde une règle avec son
      exception (« s'accorde… sauf avec avoir ») ;
    - les marqueurs de liste sont retirés : seuls, ils faisaient 34 des 739 phrases de
      l'échantillon ;
    - les fiches créées sont vérifiées comme le texte ;
    - les phrases passent entre balises de données ;
    - la réponse a la place d'un verdict par phrase.
- **Diagnostic gardé, avec sa limite écrite.** Il repère l'erreur non exploitée, mais rien
  ne montre encore sur des conversations réelles qu'il sait répondre « oui ».
- **Répétition retirée de la grille.** Elle ne repère aucune des 3 répétitions jugées, et a
  fait échouer un jugement. Le défaut relève de l'échelle d'indices tenue par le serveur
  (lot 2, point 1), qui sait ce qu'elle a déjà donné.
- **Cinq tirages gardés partout.** Les questions unanimes sont celles qui ne disent presque
  jamais « oui » (alignement, production rédigée) : leur stabilité ne dit rien des cas qui
  comptent, et `diagnosis-asks` n'est unanime que 13 fois sur 28.
- **Limites** : une seule annotation, de Claude ; 37 conversations, 5 affirmations fausses
  et 10 tentatives. Les écarts se lisent cas par cas, pas comme des taux.
