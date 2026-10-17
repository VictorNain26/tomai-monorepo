# Roadmap V1

Le fil : prouver avant de vendre (`vision.md`). L'ordre (`decisions.md`, 2026-10-11 et
2026-10-12) : le produit d'abord, le site et l'app ensemble, Tom ensuite ; aucun élève réel avant
que Tom soit mesuré. Les anciens lots 1 à 3 (identité, app, site) forment le lot 1 ; les lots 4
et 5 gardent leur numéro. Les lots sont des
résultats à atteindre, pas des dates ; ils avancent en parallèle quand rien ne les bloque.
Chaque PR précise son périmètre dans son plan, au moment où elle démarre
(`.claude/rules/plans-and-agents.md`). L'état du jour : `suivi.md`.

## Lots

| Lot | Résultat | Repère de fin |
|---|---|---|
| 0 — Refonte | Une codebase reconstruite sur des pratiques publiées | Fait : étapes 1 à 7 (`etudes/2026-10-06/refonte-architecture.md`) |
| 1 — Le produit | Une identité, le site et l'app refaits ensemble comme décrits dans `experience.md`, du premier écran au paiement | Le site en production sous le nouveau nom, menant à l'app ; les espaces du parent et de l'élève marchent de bout en bout au staging, au téléphone et à l'ordinateur, et Victor les utilise ; chaque phrase publique renvoie à une source ou à ce que l'app fait déjà |
| 4 — Tom | Un tuteur mesuré qui ne cède pas, avec la voix | Au harnais, la réponse presque jamais donnée sous pression, une aide jugée bonne par Victor, la mémoire mesurée |
| 5 — Bêta et ouverture | Des familles réelles, puis le public | Les deux portes ci-dessous franchies ; mesures publiées |

## Maintenant

En pause depuis le 2026-10-17, le temps que la direction se retranche
(`etudes/2026-10-17/direction.md`, `decisions.md`).

**Lot 1, le produit** (`etudes/2026-10-12/refonte-produit.md`), dans cet ordre ; chaque ligne
est une PR, ses pratiques dans `etudes/2026-10-12/bonnes-pratiques.md` :
1. **La direction** : « Rive », choisie le 2026-10-12 (`decisions.md`, `charte.md`). Fait.
2. **Les fondations**, avant tout écran :
   1. Les tokens Rive : une échelle de douze pas par couleur, interpolée en OKLCH par Leonardo,
      clair et sombre, les rôles, la palette des graphiques, le mouvement ; Bricolage Grotesque
      (axe de graisse seul) et Atkinson Hyperlegible Next, chargées par les mêmes variables dans le
      site et l'app ; le site prend `theme.css`, `landing.css` et ses fontes partent ; les tests
      de contraste couvrent les graphiques (3:1) et le jonc. Fait.
   2. La qualité : la définition de « fini » d'un écran (`.claude/rules/design-system.md`),
      vérifiée dans Chrome avant chaque merge, sans suite de bout en bout (`decisions.md`,
      2026-10-16). Fait.
   3. Les composants de `@repo/ui`, sur Base UI, toasts compris : la coquille de l'app (en-tête,
      onglets en bas, navigation sur le côté à l'ordinateur), section, liste, carte, état vide,
      squelette, bandeau, dialogue et tiroir, toast, graphique en barres en SVG accessible ; une page de
      catalogue. Fait.
   4. L'identité : le logo de Catiche et ses icônes (favicon, PWA) ; Tom en 2D au trait, tiré de
      `tom.blend` par le Line Art de Blender, et sa planche de référence.
3. **Le site et l'entrée** : la landing refaite sur la charte, « Se connecter » vers l'app, l'app en
   `noindex` ; la connexion, la première entrée du parent, « Qui utilise Catiche ? », « Relier cet
   appareil ».
4. **Les deux espaces** : côté serveur, le temps jour par jour, les semaines précédentes, les
   notions du programme et le point hebdomadaire par e-mail ; le tableau de bord du parent et la
   fiche d'un enfant, avec la classe redemandée à la rentrée (`decisions.md`) ; l'espace de l'élève (accueil, séances, « Mon programme », semaine, ce que
   Tom retient, appareils).
5. **Le reste** : la séance ; le compte et les données (résiliation en ligne comprise) ; le second
   parent et le double consentement ; le paiement, son fournisseur et le statut juridique tranchés
   avant.

Ce qui est construit depuis le 2026-10-11 (ajout d'un enfant, fiche, profils, jumelage) garde ses
flux, ses tests et sa sécurité ; son habillage se refait aux étapes 3 et 4. Le comportement de Tom
dans la séance reste au lot 4. Le dépôt de la marque et les domaines sont des gestes de Victor ;
le domaine des clés d'accès (`catiche.fr` ou `app.catiche.fr`) se choisit avant la production.

**Hors IA, sans attendre** : la clause 2.2(c) des mineurs et la recevabilité du Zero Data
Retention sont demandées à Mistral (2026-10-11) ; la réponse décide du lot 4.

## Ensuite

- **Lot 4**, dès Mistral en paiement à l'usage : le passage unique du harnais sur le code actuel,
  le rapport et la comparaison cas par cas (McNemar), le juge et sa vérification par Victor, le
  garde-fou en CI ; les fuites fermées, mesurées sur au moins 150 conversations de pression ; la
  mémoire mesurée avec et sans elle ; la revue humaine de la détresse ; la voix (Voxtral) ; Tom
  qui se dit IA dès le premier message ; la première réponse plus rapide.
- **Lot 5** : Victor d'abord, puis quelques familles invitées, une fois la première porte
  franchie. La bêta tranche les questions ouvertes de la vision, dont le mode accompagné.

## Porte avant le premier élève réel

Obligations, pas des repères :
- Mistral en paiement à l'usage, Zero Data Retention accordé, clause des mineurs clarifiée par
  écrit (`etudes/2026-10-07/foyer-eleve-age.md`, § 1) ;
- art. 50(1) de l'AI Act tenu dans le prompt et dans l'interface (applicable depuis le
  2026-08-02) ;
- détresse et modération mesurées au harnais ; la détresse relue par un humain, avec un délai
  tenu, avant tout message au parent ;
- double consentement sous 15 ans, mémoire comprise, et son analyse d'impact (AIPD) ;
- pages légales alignées sur l'app réelle (mémoire, tableau de bord et point hebdomadaire du
  parent, consentement) ;
- réponse de la CNIL sur l'hébergement de données de santé ; base dans un réseau privé ; erreurs
  remontées dans Bugsink ; la production, avec l'approbation de Victor.

## Porte avant l'ouverture publique

- Mesures publiées et rejouables, après un regard pédagogique humain sur un échantillon des
  exercices du jeu ; la page des mesures sur le site ;
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
