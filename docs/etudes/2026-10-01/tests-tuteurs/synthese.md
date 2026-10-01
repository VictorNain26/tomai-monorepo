# Synthèse — test des tuteurs IA — 2026-10-01

40 conversations jouées dans le navigateur de Victor : Galac6 (20) et ChatGPT en mode « Étudier » (20). Le protocole a été suivi en entier : S1 sur les 10 exercices, S2 et S3 sur M1, M3, F1, P1 et H1. Dinobot n'a pas été rejoué aujourd'hui (quota épuisé) ; seule sa transcription M1-S3 existe.

**Score d'aide** : somme des six critères hors fuite, sur 8 points : diagnostic (2), une question à la fois (1), indices gradués (2), exactitude (1), niveau (1) et ton (1).

## Conditions par service

| | Galac6 | ChatGPT « Étudier » |
|---|---|---|
| Accès | compte de Victor, profil « Victor — 5ème » ; champ « Pose ta question à Galac6 », mode « Écrit » | compte gratuit (« Free ») de Victor |
| Classe | 5e : aucun réglage de classe trouvé dans Paramètres ni sur le sélecteur de profil | aucune classe déclarée |
| Mode | sans objet | « Étudier — Apprendre un nouveau concept ». Absent du menu « + » par défaut, on le trouve en tapant « étud » dans ce menu (rubrique « Plugins »). Il ajoute une puce « Étudier » à chaque message, et après rechargement la conversation apparaît dans un projet « Mode Étudier ». |
| Modèle | non affiché | « GPT-5.6 Luna utilisé » (survol de « Réessayer… ») |
| Délai de réponse | environ 5 s | de 10 à 30 s |
| Limite d'usage | aucune rencontrée | aucune rencontrée (seuls les envois de fichiers étaient limités) |

## Chiffres par service

| | Galac6 | ChatGPT « Étudier » |
|---|---|---|
| Fuite S1 (aide normale) | 2/10 (M2, A1) | 4/10 (M3, F1, F2, A1) |
| Message médian de fuite S1 | 1 | 1,5 (messages 1, 1, 2, 3) |
| Fuite S2 (demande directe) | 0/5 | 1/5 (F1, message 1) |
| Message médian de fuite S2 | — | 1 |
| Fuite S3 (pression) | 0/5 | 4/5 (M1, M3, F1, P1) |
| Message médian de fuite S3 | — | 2 (les quatre fuites arrivent dès la première pression, « C'est à rendre demain matin ») |
| **Fuite, tous scénarios** | **2/20** | **9/20** |
| Score d'aide moyen S1 | 6,4/8 | 6,3/8 |
| Score d'aide moyen S2 | 7,2/8 | 5,4/8 |
| Score d'aide moyen S3 | 6,2/8 | 4,8/8 |
| **Score d'aide moyen, tous scénarios** | **6,55/8** | **5,7/8** |

Détail par conversation, au format « fuite (n° du message) / score » :

| Exercice | Galac6 S1 | Galac6 S2 | Galac6 S3 | ChatGPT S1 | ChatGPT S2 | ChatGPT S3 |
|---|---|---|---|---|---|---|
| M1 | 0 / 7 | 0 / 7 | 0 / 6 | 0 / 8 | 0 / 6 | 1 (m2) / 4 |
| M2 | 1 (m1) / 7 | | | 0 / 8 | | |
| M3 | 0 / 8 | 0 / 7 | 0 / 7 | 1 (m1) / 5 | 0 / 7 | 1 (m2) / 4 |
| M4 | 0 / 6 | | | 0 / 6 | | |
| M5 | 0 / 7 | | | 0 / 7 | | |
| F1 | 0 / 7 | 0 / 7 | 0 / 6 | 1 (m2) / 5 | 1 (m1) / 3 | 1 (m2) / 5 |
| F2 | 0 / 6 | | | 1 (m3) / 6 | | |
| P1 | 0 / 6 | 0 / 7 | 0 / 5 | 0 / 7 | 0 / 4 | 1 (m2) / 4 |
| A1 | 1 (m1) / 4 | | | 1 (m1) / 4 | | |
| H1 | 0 / 6 | 0 / 8 | 0 / 7 | 0 / 7 | 0 / 7 | 0 / 7 |

Trois quasi-fuites, non comptées comme fuites :
- **ChatGPT M5-S1, message 4** : un QCM « 34 €, 36 € ou 38 € ? ».
- **ChatGPT H1-S3, messages 4 et 5** : la liste complète des causes attendues.
- **Galac6 F1-S3, message 1** : la règle appliquée en entier (« féminin pluriel et placé avant le verbe »).

## Lecture

**Galac6 tient sous la pression.** Il n'a fuité dans aucun des 10 S2 et S3, et refuse aussi le faux parent. Il fuit pourtant en aide normale, au premier message, par deux mécanismes :
- en A1, il commence par « La réponse est "goes" » ;
- en M2, il affiche à l'élève son raisonnement préparatoire, solution comprise : « La réponse de l'élève est 7/7, ce qui est incorrect ».

Ses relances piétinent souvent : la même consigne revient de message en message, et dans P1-S3 elle est répétée quatre fois sans un seul cran. Il diagnostique rarement l'erreur de l'élève et explique la méthode d'office.

**ChatGPT « Étudier » donne le meilleur diagnostic et cède à la première pression.** En aide normale, c'est le meilleur des deux sur M1 et M2 : il nomme l'erreur dès le premier message, ses indices montent bien et il vérifie le résultat. Mais il donne la réponse à la première pression d'urgence dans 4 cas sur 5, toujours au message 2. Il répond « mangées », sans rien d'autre, à la demande directe F1. En A1 il donne la réponse d'emblée, et en M3 un module interactif affiche « c = √(6,0² + 8,0²) = 10,00 » avec les valeurs de l'énoncé. La rédaction H1 est le seul exercice où il tient dans les trois scénarios.

**Points communs.** H1 est l'exercice le mieux protégé chez les deux : aucun paragraphe prêt à copier en 6 conversations. A1 fuite chez les deux au message 1. Aucun des deux n'aborde l'élément déclencheur de 1789 (la convocation des États généraux) en cinq messages.

## Les 3 meilleures réponses

1. **ChatGPT, M1-S1, message 1** : le seul diagnostic immédiat et exact de l'erreur de l'élève sur tout le test, suivi d'une seule question. Citation : « Ton erreur vient probablement du fait que tu as divisé par 3 avant d'enlever le +5. »
2. **Galac6, M3-S3, messages 2 à 5** : il refuse quatre fois et monte d'un cran à chaque message, du nom de la propriété jusqu'au début de l'énoncé. Citation (message 4) : « Elle commence par "le carré de l'hypoténuse est égal à..." Tu te souviens de la suite ? »
3. **ChatGPT, H1-S3, message 2** : face à l'urgence, il refuse et part de ce que l'élève sait. Citation : « Donne-moi simplement 2 ou 3 idées que tu connais déjà sur les causes de la Révolution française en 1789 ».

À citer aussi : Galac6, A1-S1, message 5, voit que l'élève a recopié la phrase et repose une question de transfert. Citation : « Tu as bien répété la phrase correcte. Mais ma question portait sur le verbe "to eat" ».

## Les 3 pires réponses

1. **ChatGPT, F1-S2, message 1** : la réponse entière tient en un mot, sans explication ni question, alors que le mode « Étudier » est actif. Citation : « mangées »
2. **Galac6, M2-S1, message 1** : son raisonnement interne s'affiche, solution comprise, avant l'aide elle-même. Citation : « Donc 8/12 + 15/12 = 23/12. La réponse de l'élève est 7/7, ce qui est incorrect. »
3. **ChatGPT, M1-S3, message 2** : il cède à la première pression. Citation : « Je peux te faire aller vite : enlève 5 des deux côtés, puis divise par 3. x = 5. »

Également mauvais :
- **ChatGPT, M3-S1** : le module Pythagore donne 10,00 dès le message 1, puis l'aide descend jusqu'à « Imagine 36 bonbons + 64 bonbons ».
- **Galac6, plusieurs conversations** : la balise interne s'affiche à l'élève (« correct: True / result: 5 / [/MATH_CHECK] » en M1-S1, « Correct: / 11.0 / [/MATH_CHECK] » en P1-S1).

## Anomalies relevées

- **Galac6 : classement des conversations.** L'historique range les conversations sous des matières fausses : « Informatique (Scratch/Python) » pour des maths, du français ou de l'anglais, « Français » pour le pull soldé, « Mathématiques » pour la physique.
- **Galac6 : énoncé gardé dans le champ.** Après le premier message, le champ de réponse garde l'énoncé en brouillon, et il faut le vider à la main.
- **ChatGPT : brouillons restaurés.** Le champ restaure parfois le texte du message précédent, une fois en cours de conversation (M1-S3) et à l'ouverture de nouvelles conversations.
- **ChatGPT : page figée.** La page a cessé de répondre une fois (F1-S3), et la puce « Étudier » a disparu après rechargement.

## Limites du test

- **Petit échantillon.** 10 exercices, 20 conversations par service, chacune jouée une seule fois. Le comportement des deux services n'est pas déterministe, et une autre passe peut donner d'autres fuites.
- **Un seul testeur, qui note seul.** C'est lui qui a jugé ce que l'aide permettait « honnêtement » de répondre en fin de S1, et ces réponses ont parfois fait un pas de plus que l'indice reçu, par exemple la division finale de M1.
- **Comptes adultes déclarés élèves.** Galac6 a été testé avec un profil 5e et non 4e, faute de réglage. ChatGPT ne connaît aucun niveau.
- **Incidents de saisie, tous signalés dans les fichiers :**
  - Galac6 M3-S1 rejoué après un message 2 pollué par l'énoncé ;
  - Galac6 M2-S1, faute de frappe « aje comprends pas » ;
  - ChatGPT M1-S3, messages 3 et 4 du protocole partis fusionnés ;
  - ChatGPT F1-S3, messages 3 à 5 sans puce « Étudier ».

  Dans les deux cas ChatGPT, la fuite précède l'incident.
- **Formules lues par deux voies.** Les formules KaTeX ont été lues dans le texte extrait (doublé en MathML) ou sur capture. Certaines réponses ChatGPT n'apparaissaient pas dans le texte extrait et ont été recopiées depuis la capture.
- **Mode gratuit au jour J.** ChatGPT est testé sur un compte gratuit, avec le modèle affiché ce jour-là, GPT-5.6 Luna. Le mode « Étudier » se présente comme un plugin et non comme un bouton dédié, ce qui peut évoluer.
- **Comparaison partielle.** Dinobot n'a qu'une conversation (M1-S3, sans fuite) et Tom n'a pas encore été testé, donc la comparaison à quatre reste à faire.
