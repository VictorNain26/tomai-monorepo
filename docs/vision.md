# Vision produit

Statut : validée par Victor le 2026-10-01. Source de vérité du produit : pour qui, quelle
promesse, quelles preuves, quel prix, ce qu'on n'est pas. Les specs techniques
(`architecture.md`, `tuteur.md`) et la roadmap en découlent. Les
faits viennent des études du 2026-10-01 (`docs/etudes/`), qui portent les
sources ; ce document les cite sans les recopier.

Règle qui gouverne tout le reste : **on n'affirme que ce qu'on peut prouver**. Chaque
chiffre public a une source primaire datée ; chaque différence revendiquée face à un
concurrent est mesurée ; ce qui n'est pas construit ne se promet pas.

## En une phrase

**Le soir, ce n'est plus au parent d'expliquer, et ce n'est pas l'IA qui fait l'exercice.**

## Pour qui

- **Le parent qui choisit et paie** : parent d'un collégien (6e à 3e) qui ne sait plus, ou
  ne peut plus, aider le soir. Le sentiment d'être dépassé touche toutes les catégories
  sociales ; le besoin s'exprime en disputes et en soirées mangées par les devoirs plus
  qu'en notes (`etudes/2026-10-01/parents.md`, enseignement 1 ; sondage commandé par un
  acteur intéressé, à citer comme tel).
- **Y compris les familles qui ne peuvent pas payer un professeur** : un cours particulier
  coûte de 19 à 49 € de l'heure avant crédit d'impôt (`etudes/2026-10-01/marche.md`), et
  près de la moitié des parents disent y avoir renoncé pour des raisons financières
  (`etudes/2026-10-01/parents.md`, enseignement 2 ; sondage commandé par un acteur
  intéressé, à citer comme tel). Ces familles sont plus souvent sans
  ordinateur et parlent plus souvent une autre langue à la maison (même étude,
  enseignement 5).
- **L'élève qui l'utilise** : collégien, le soir ; souvent sur téléphone, hypothèse H6 de
  `etudes/2026-10-01/parents.md`, non vérifiée. Le téléphone d'abord se
  défend déjà : l'ordinateur manque plus souvent dans les familles modestes (même étude,
  enseignement 5).

## Ce qu'on promet, ce qu'on prouve

| Preuve | Ce qu'on doit pouvoir montrer | Où elle se construit |
|---|---|---|
| **Il ne cède pas** | La réponse de l'exercice de l'élève n'est jamais donnée, même sous pression (« c'est pour demain », « je suis son parent ») ; le cran d'aide est fixé par le serveur, pas par une consigne à l'IA | Lot 2, mesuré par le lot 1 |
| **Il explique bien** | Il repère l'erreur, pose une question à la fois, monte d'un cran seulement si l'élève bloque, ne se trompe pas, parle comme en collège | Lot 2, mesuré par le lot 1 |
| **Le parent voit sans surveiller** | Un résumé de la semaine (ce qui a été travaillé, ce qui résiste) et une alerte de détresse, jamais les conversations ; l'élève sait ce que voit son parent | Lot 3 |
| **Les données d'un enfant restent en Europe** | Modèles Mistral sur l'endpoint UE, hébergement UE, aucune donnée réutilisée pour entraîner | Lot 3 (hébergement), ZDR à demander |
| **On publie nos mesures** | Le protocole, le jeu d'exercices et les résultats (fuite et qualité d'aide), y compris face aux concurrents, sont publics et rejouables | Lot 1, publié au lot 4 |

On ne dit pas qu'il fait progresser : un tuteur à garde-fous évite le dommage d'une IA qui
donne la réponse, sans gain mesuré à ce jour (Bastani et al., PNAS 2025, dans
`etudes/2026-10-01/parents.md`). On ne dit pas « le seul ». On ne promet rien de ce qui
n'est pas livré.

## Où est la place, honnêtement

Tests du 2026-10-01 sur 10 exercices de collège, trois scénarios (aide normale, demande
directe, pression), une passe par conversation (`etudes/2026-10-01/tests-tuteurs/`) :

| | Réponse donnée | Qualité d'aide (sur 8) | Ce qu'on a vu |
|---|---|---|---|
| ChatGPT « Étudier » (gratuit) | 9 fois sur 20, dont 4 sur 5 dès la première pression | 5,7 | Meilleur diagnostic de l'erreur ; cède à « c'est à rendre demain » ; le mode se quitte |
| Galac6 (gratuit, illimité) | 2 fois sur 20, en aide normale | 6,55 | Tient sous pression ; affiche parfois son raisonnement interne avec la solution, et des balises techniques ; modèles américains |
| Dinobot (5 questions par jour gratuites, puis 5,99 ou 9,99 €) | 0 sur 1 conversation de pression (5 messages ; quota épuisé) | 6 sur ce seul test | Tient ; répète le même indice, perd le fil ; Mistral, hébergé en France, même discours que nous ; 170 000 à 200 000 élèves revendiqués par l'éditeur, chiffres variables selon la source |

Ce que ça veut dire :
- « L'IA qui ne donne pas la réponse » **n'est pas une place libre** : Dinobot le revendique,
  Galac6 le fait gratuitement et plutôt bien. Face à ChatGPT, c'est une vraie différence ;
  face à eux, non.
- **La place est dans l'exécution prouvée**, sur quatre points que personne ne réunit
  aujourd'hui (`etudes/2026-10-01/concurrence.md`) :
  1. ne jamais céder, ni montrer la solution par accident, mesuré et publié ;
  2. une aide au niveau du meilleur diagnostic observé, mesurée et publiée ;
  3. un gratuit vraiment utilisable chaque soir, avec l'IA et les données en Europe ;
  4. un parent informé par un résumé, sans lecture des conversations.
- Cette place est étroite. Elle tient si la qualité est réellement supérieure et si on la
  montre ; elle ne tient pas sur un slogan. Le lot 1 dira si on y arrive.

## Ce qu'on n'est pas

Ni une appli qui résout sur photo, ni un cours en ligne, ni un jeu, ni un outil de
surveillance de l'enfant. Pas de classement, pas de points, pas de séries.

## Offre et prix

- **Gratuit, utilisable chaque soir** : le quota se fixe en échanges ou en coût réel, à partir du coût
  mesuré (un compte gratuit à son plafond coûte de l'ordre de 0,18 € par mois,
  `etudes/2026-10-01/couts.md`). Le quota compte le coût réel de la journée ; ses
  budgets (`apps/server/src/modules/billing/quota-config.ts`) sont provisoires.
- **Complet à 7,99 € TTC par mois** : plancher défendable du modèle de coûts (marge
  positive dans le pire cas mesuré). Plus d'échanges et les fiches de révision. Prix non
  vérifié auprès de parents. Repères : Dinobot 5,99 et 9,99 €, Le Prof IA
  4,90 €, une heure d'Acadomia 24,40 € après crédit d'impôt.
- **Facturation sans piège**, parce que c'est le premier reproche des parents dans les avis
  (`etudes/2026-10-01/parents.md`) : mensuelle, sans engagement, résiliable en un clic,
  prévenue avant chaque prélèvement.

## Périmètre V1

- **Dedans** : collège, de la 6e à la 3e ; client web pensé d'abord pour le téléphone ;
  texte, photo et voix ; résumé et alerte de détresse pour le parent ; Gratuit et Complet.
- **Dehors** :
  - **Pronote** : l'accès actuel passe par une bibliothèque non officielle, archivée et
    cassée par la version 2026 de Pronote, en se faisant passer pour l'application
    officielle (`etudes/2026-10-01/pronote.md`). Il ne revient que par une convention avec
    Index Éducation (démarche de Victor), sur un
    produit qui marche déjà sans lui.
  - **Enseignants et établissements** : horizon, pas la V1 (référencement GAR, achat par
    établissement).
  - Lycée, application native.

## Distribution

Non résolue, et c'est le premier risque. Hypothèses non vérifiées :
recommandation par le collège ou une association (confiance des familles modestes),
recherche Google sur les devoirs, bouche-à-oreille. Jamais de promotion déguisée sur les
forums de parents : la communauté la rejette.

## Questions ouvertes

Hypothèses tirées de la recherche documentaire (`etudes/2026-10-01/parents.md`). Victor a
choisi le 2026-10-02 de ne pas mener d'entretiens : elles restent des hypothèses tant
qu'aucune donnée d'usage réelle ne les tranche :
- le moment critique est-il un blocage sur une notion, en maths à partir de la 4e ?
- « il ne donne pas la réponse » fait-il acheter le parent mais fuir l'enfant ?
- quel prix est acceptable, et le refus tient-il à la peur d'un abonnement piège ?
- l'appareil du soir est-il le téléphone ?
- les familles modestes feraient-elles confiance sur recommandation du collège ?

## Marque

Nom ouvert ; candidat « De sa main », qui dit la promesse, à vérifier (marques, domaines)
au lot 4. L'identité visuelle se refait au lot 4, une fois la promesse prouvée. Les directions
explorées jusqu'au 2026-10-01 sont abandonnées.

## Critères de succès de la V1

- au harnais, aucune réponse donnée sur au moins 300 conversations de pression, soit moins
  de 1 % avec 95 % de confiance, et aucune solution montrée par accident ;
- un score d'aide au moins égal au meilleur concurrent mesuré avec le même protocole, sur les
  critères dont le juge est validé contre une annotation humaine ;
- un gratuit qui couvre une soirée de devoirs normale ;
- un coût par élève payant inférieur à son revenu net dans le pire cas mesuré ;
- chaque phrase publique adossée à une source ou à une mesure publiée.
