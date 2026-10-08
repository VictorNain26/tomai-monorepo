# Roadmap V1

Le fil : prouver avant de vendre (`vision.md`). Les lots sont des résultats à atteindre, pas des
dates ; ils avancent en parallèle quand rien ne les bloque. Chaque PR précise son périmètre dans
son plan, au moment où elle démarre (`.claude/rules/plans-and-agents.md`). L'état du jour :
`suivi.md`.

## Lots

| Lot | Résultat | Repère de fin |
|---|---|---|
| 0 — Refonte | Une codebase reconstruite sur des pratiques publiées | Fait : étapes 1 à 7 (`etudes/2026-10-06/refonte-architecture.md`) |
| 1 — Mesurer | Un harnais crédible et rejouable | Des mesures avec leur marge d'erreur, un juge vérifié contre Victor, un garde-fou en CI |
| 2 — Un tuteur qui ne cède pas | Guider sans donner la réponse, sans se tromper, bien réagir à la détresse | Au harnais, la réponse presque jamais donnée sous pression, une aide jugée bonne par Victor, la mémoire mesurée |
| 3 — L'app entre les mains des familles | L'app sur téléphone, de la direction artistique au paiement | Les parcours marchent de bout en bout au staging, Victor les utilise, puis la bêta fermée |
| 4 — Marque et lancement | Nom, logo, site qui ne dit que le prouvé, mesures publiées | Chaque phrase publique renvoie à une source ou à une mesure |

## Maintenant

**Lot 3**, dans cet ordre (`etudes/2026-10-08/interfaces.md` pour les constats) :
1. **La séance** : l'accueil de Tom qui dit qu'il est une IA (AI Act, art. 50(1)) et une marque
   « IA » près du champ ; dans le prompt, Tom le redit quand l'élève parle de lui, sans
   sentiment ni amitié (`decisions.md`) ; le champ fixé en bas, le rendu des maths, une attente
   qui dit ce qui se passe ; sur la direction « Cahier du soir ».
2. **Le mode accompagné en 6e et 5e** (`decisions.md`) : « Faire les devoirs avec … » dans
   l'espace du parent, qui passe l'appareil au profil de l'enfant, « Je reste à côté » ou « Il
   travaille seul ce soir », les pistes au parent tenues par le serveur et vérifiées au harnais,
   l'accueil de l'enfant qui dit ce que son parent peut voir ; le jumelage réservé à la 4e et à la
   3e.
3. **L'accueil élève** : les séances d'abord, la mémoire dans les mots de l'élève, un choix de
   profil.
4. **L'accueil parent et le résumé** : une carte par enfant, l'étape suivante après l'ajout, « Mon compte » pour les clés d'accès.
5. **Le jumelage** par QR code, et les petits textes.
6. **Le consentement** : double consentement sous 15 ans, second parent ; **photo et voix** ;
   **revue humaine de la détresse** ; **paiement**.

**Lot 1**, dès que le paiement à l'usage de Mistral est actif : le passage unique du harnais sur
le code actuel, puis le rapport et la comparaison cas par cas (McNemar), le juge, sa vérification
par Victor sur une page de jugement, le garde-fou en CI.

## Ensuite

- **Lot 2** : fermer les fuites que le passage a listées, mesurées sur au moins 150 conversations
  de pression ; mesurer la mémoire avec et sans elle, sur des scénarios à plusieurs séances.
- **La bêta fermée** : Victor d'abord, puis quelques familles invitées, une fois la porte
  ci-dessous franchie. Elle tranche les questions ouvertes de la vision, dont le mode accompagné :
  qui s'en sert, avec ou sans parent, selon les familles.

## Plus tard

- **Lot 4** : nom et logo, site réécrit sur la vision et la direction artistique, avec la page des
  mesures et l'accès à l'app ; ouverture.

## Porte avant le premier élève réel

Obligations, pas des repères :
- Mistral en paiement à l'usage, Zero Data Retention accordé, clause des mineurs clarifiée par
  écrit (`etudes/2026-10-07/foyer-eleve-age.md`, § 1) ;
- art. 50(1) de l'AI Act tenu dans le prompt et dans l'interface (applicable depuis le
  2026-08-02) ;
- détresse et modération mesurées au harnais ; la détresse relue par un humain, avec un délai
  tenu, avant tout message au parent ;
- double consentement sous 15 ans, mémoire comprise, et son analyse d'impact (AIPD) ;
- pages légales alignées sur l'app réelle (mémoire, résumé, consentement) ;
- réponse de la CNIL sur l'hébergement de données de santé ; base dans un réseau privé ; erreurs
  remontées dans Bugsink ; la production, avec l'approbation de Victor.

## Porte avant l'ouverture publique

- Mesures publiées et rejouables, après un regard pédagogique humain sur un échantillon des
  exercices du jeu ;
- avis d'un conseil sur l'art. 50(2) (marquage des sorties) et sur la détresse comme donnée de
  santé (RGPD art. 9) ;
- statut juridique tranché avec un expert-comptable, avant le paiement.

## Après la V1

- **Primaire**, en mode accompagné (`etudes/2026-10-07/foyer-eleve-age.md`) : après une mesure de
  la reconnaissance vocale sur des voix d'enfants français, et une position face au cadre d'usage
  de l'IA du ministère.
- **Lycée** (`etudes/2026-10-02/alignement.md`, § 9), en mode autonome : la même chaîne de
  référentiel et d'évaluation, par vagues, mathématiques en tête ; le référentiel et le jeu sont
  indexés par enseignement pour que le lycée soit un ajout de données.

## Hors roadmap, délibérément

- Pronote et les logiciels de vie scolaire sans convention officielle ; les établissements (GAR).
- Les fiches de révision.
- RAG vectoriel : le programme d'un niveau et d'une matière tient dans le contexte (mesuré le
  2026-10-02, `etudes/2026-10-02/alignement.md`).
- Un autre fournisseur que Mistral pour l'élève, l'auto-hébergement de poids, le fine-tuning.
- Application native.
