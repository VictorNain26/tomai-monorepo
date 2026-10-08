# Vision

Ce qu'on construit, pour qui, et ce qui tranche un arbitrage. Le pourquoi de chaque choix daté :
`decisions.md` ; l'ordre : `roadmap.md` ; où on en est : `suivi.md`. Les faits viennent des
études (`etudes/`), qui portent leurs sources.

## En une phrase

**Le soir, ce n'est plus au parent d'expliquer, et ce n'est pas l'IA qui fait l'exercice.**

## Le problème

Le soir, un collégien bloque sur un exercice. Le parent ne sait plus, ou ne peut plus, l'aider :
le besoin s'exprime en disputes et en soirées mangées par les devoirs plus qu'en notes
(`etudes/2026-10-01/parents.md`, enseignement 1 ; sondage commandé par un acteur intéressé). Un
cours particulier coûte de 19 à 49 € de l'heure (`etudes/2026-10-01/marche.md`). Les IA
gratuites donnent la réponse : l'exercice est rendu, rien n'est compris, et la perte se voit au
contrôle (Bastani et al., PNAS 2025, dans `etudes/2026-10-01/parents.md`).

## Pour qui

- **Le parent qui choisit et paie** : parent d'un collégien, de la 6e à la 3e, qui ne peut plus
  aider le soir.
- **Y compris les familles qui ne peuvent pas payer un professeur** : près de la moitié des
  parents disent avoir renoncé au soutien scolaire pour des raisons financières ; ces familles
  sont plus souvent sans ordinateur (`etudes/2026-10-01/parents.md`, enseignements 2 et 5).
- **L'élève qui l'utilise** : le soir, souvent sur téléphone (hypothèse à vérifier en bêta).

## Principes

Ils tranchent quand deux choix se valent.

1. **Tom ne cède pas, et c'est le code qui le garantit.** La réponse de l'exercice de l'élève
   n'est jamais donnée, même sous pression ; le cran d'aide, le contrôle avant l'élève et la
   détresse sont tenus par le serveur, pas par une consigne au modèle.
2. **On n'affirme que ce qu'on peut prouver.** Chaque chiffre public a une source primaire
   datée, chaque différence revendiquée est mesurée, ce qui n'est pas construit ne se promet pas.
   On ne dit pas qu'il fait progresser : aucune mesure ne le montre à ce jour.
3. **Le parent voit sans surveiller.** Un résumé, jamais les conversations à distance ; l'élève
   voit ce que voit son parent. En 6e et 5e, le parent peut être à côté pendant la séance : Tom
   l'aide à accompagner sans faire à la place, et l'enfant le sait.
4. **Les données d'un enfant restent en Europe, et au minimum.** Mistral sur son endpoint UE,
   hébergement en France ; aucune donnée réutilisée pour entraîner ; ni nom de famille ni
   identifiant pour l'enfant.
5. **Ni jeu, ni compagnon.** Pas de séries, de points, de classement ni de notification de
   rétention ; Tom ne retient rien de la vie de l'enfant, seulement ce qui a résisté dans ses
   exercices, et seulement si le parent et l'enfant l'acceptent.
6. **Pensé depuis la soirée réelle.** Chaque parcours se conçoit à la place de l'enfant et du
   parent, sur le téléphone de la famille, avant les choix techniques.
7. **Un budget serré.** Mistral Small 4 pour tout ; la fiabilité vient des garde-fous du code,
   pas d'un modèle plus cher.

## Ce qu'on promet, ce qu'on prouve

| Promesse | Ce qu'on doit pouvoir montrer |
|---|---|
| **Il ne cède pas** | Au harnais, sous pression (« c'est pour demain », « je suis son parent »), la réponse n'est presque jamais donnée, et aucune solution n'est montrée par accident |
| **Il explique bien** | Il repère l'erreur, pose une question à la fois, monte d'un cran seulement si l'élève bloque, ne se trompe pas, parle comme au collège ; jugé par Victor |
| **Il reprend là où ça a résisté** | D'une séance à l'autre, son aide s'appuie sur les notions qui ont résisté ; mesuré avec et sans mémoire, annoncé seulement après |
| **Le parent accompagne sans faire à la place** | En 6e et 5e, les pistes de Tom au parent ne donnent jamais plus que le cran de l'enfant, au harnais ; en bêta, la part des séances avec et sans parent, selon les familles |
| **Le parent voit sans surveiller** | Un résumé de la semaine : matières, temps passé, ce qui résiste ; une détresse relue par un humain avant tout message au parent, qui n'en reçoit que le motif |
| **Les données restent en Europe** | Endpoint UE, hébergement à Paris, Zero Data Retention accordé par Mistral |
| **On publie nos mesures** | Protocole, jeu d'exercices et résultats, y compris face aux concurrents, publics et rejouables, avec leur marge d'erreur et le nom de qui a jugé |

## Où est la place

« L'IA qui ne donne pas la réponse » n'est pas une place libre, et le suivi parent non plus :
Galac6 (gratuit), Le Prof IA (4,90 € par mois) et Kartable Alfa (inclus dans un abonnement à
9,99 € par mois sur l'année) revendiquent les deux ; Dinobot (5,99 et 9,99 €) le premier, son
module famille annoncé. Vérifié le 2026-10-08 sur les sites des éditeurs
(`etudes/2026-10-01/concurrence.md` pour l'analyse d'origine). Face à ChatGPT, qui donnait la
réponse 9 fois sur 20 en mode « Étudier » le 2026-10-01 (`etudes/2026-10-01/tests-tuteurs/`),
c'est une vraie différence ; face à eux, non.

Le pari : **l'exécution prouvée et publiée**, que personne ne montre aujourd'hui.
- Une mesure de fuite publiée et rejouable, sous pression.
- Une aide au niveau du meilleur diagnostic observé chez les concurrents.
- Un gratuit utilisable chaque soir, avec l'IA et les données en Europe.
- Un résumé qui ne lit pas les conversations, et que l'élève voit aussi.

La place est étroite : elle tient si la qualité est réellement meilleure et si on le montre,
pas sur un slogan. Le harnais dira si on y est.

## Offre

- **Gratuit, utilisable chaque soir** : un budget du jour par élève, au coût réel, qui couvre une
  soirée normale avec photo et voix. C'est lui qui décide de la rentabilité.
- **Complet** : plus d'échanges par jour, à 7,99 € TTC par mois (prix non vérifié auprès de
  parents), ou une année scolaire payée d'avance.
- **Facturation sans piège**, premier reproche des parents dans les avis : sans engagement,
  résiliable en un clic, prévenue avant chaque prélèvement, sans renouvellement automatique de
  l'année.

Chiffres et modèle : `etudes/2026-10-07/rentabilite.md`.

## Périmètre V1

- **Dedans** : le collège, en mode accompagné en 6e et 5e (la séance s'ouvre depuis l'espace du
  parent, qui peut rester à côté) et guidé en 4e et 3e (l'élève relie son appareil par un code du
  parent) ; un client web pensé d'abord pour le téléphone ; texte, photo et voix ; la mémoire
  d'apprentissage, si elle est acceptée ; le résumé parent ; le second parent ; la détresse
  relue par un humain ; Gratuit et Complet ; une direction artistique construite autour de Tom.
- **Dehors** : les fiches de révision ; Pronote, tant qu'aucune convention avec Index Éducation
  n'existe ; les enseignants et les établissements ; le primaire et le lycée, après la V1 ;
  l'application native.

## Risques

| Risque | Ce qui le lèverait |
|---|---|
| **Mistral interdit les données d'enfants sous 15 ans** dans ses conditions commerciales (clause 2.2(c)), et c'est notre seul fournisseur | Sa réponse écrite, demandée avec le Zero Data Retention ; sans elle, aucun vrai élève |
| **La qualité n'est pas encore prouvée** : 11 fuites sur 106 conversations au dernier passage (`etudes/2026-10-06/passage-de-fin.md`) | La fermeture des fuites, mesurée au harnais |
| **La distribution** : aucun canal vérifié | Hypothèses à tester : recommandation par le collège ou une association, recherche sur les devoirs, bouche-à-oreille ; jamais de promotion déguisée sur les forums de parents |
| **L'enfant fuit** un tuteur qui ne donne pas la réponse, alors que c'est ce qui fait acheter le parent | La bêta fermée : l'enfant revient-il de lui-même ? |
| **Le débit et l'attente** : la première réponse prend 12 à 15 s | Le paiement à l'usage chez Mistral, et une attente conçue dans l'écran de séance |

## Questions que la bêta tranchera

Victor a choisi de ne pas mener d'entretiens (`decisions.md`) : ces hypothèses
(`etudes/2026-10-01/parents.md`) se tranchent par l'usage réel de la bêta fermée.
- Le moment critique est-il un blocage sur une notion, en maths à partir de la 4e ?
- Quel prix est acceptable, et le refus tient-il à la peur d'un abonnement piège ?
- L'appareil du soir est-il le téléphone ?
- Les familles modestes feraient-elles confiance sur recommandation du collège ?

## Marque

Tom est la loutre, le tuteur ; le nom du produit est ouvert (candidat « De sa main »), vérifié et
choisi au lot 4. La direction artistique se fonde au lot 3, autour de Tom ; le nom, le logo et
le site suivent au lot 4.

## Critères de succès de la V1

Des repères, pas des seuils figés :
- au harnais, sous pression, la réponse n'est presque jamais donnée, mesure publiée avec sa marge
  d'erreur, et aucune solution n'est montrée par accident ;
- une aide au moins aussi bonne que celle du meilleur concurrent, jugée par Victor ;
- en bêta, l'enfant revient de lui-même plusieurs semaines, et le parent lit le résumé ;
- un gratuit qui couvre une soirée de devoirs normale, et un élève payant qui coûte moins qu'il
  ne rapporte ;
- chaque phrase publique adossée à une source ou à une mesure publiée.
