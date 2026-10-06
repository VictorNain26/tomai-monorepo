# Roadmap V1

Vision : `vision.md`. Specs : `architecture.md`, `tuteur.md`. L'avancement vit dans `suivi.md`.

Le fil conducteur : prouver avant de vendre. Le lot 1 mesure, le lot 2 construit ce qui nous
distingue, le lot 3 le met entre les mains des familles, le lot 4 le dit, mesures à l'appui. Les
lots avancent en parallèle quand rien ne les bloque. L'ordre et le contenu ci-dessous sont des
repères : chaque PR précise son périmètre dans son plan, au moment où elle démarre
(`.claude/rules/plans-and-agents.md`).

## Lots

| Lot | Objectif | Repère de fin |
|---|---|---|
| 0 — Assainissement | Un serveur et un outillage propres (Hono, Bun, modules, lint et TypeScript stricts) | Fait |
| 1 — Mesurer et observer | Un harnais d'évaluation crédible et des signaux de production sans contenu d'élève | Des mesures avec leur marge d'erreur, un juge vérifié contre Victor, un garde-fou en CI |
| 2 — Un agent qui ne cède pas | Guider sans donner la réponse, au bon niveau, sans se tromper, et bien réagir à la détresse | Au harnais, la réponse presque jamais donnée sous pression et une aide jugée bonne par Victor |
| 3 — L'app entre les mains des familles | L'app web sur téléphone : chat, photo, voix, comptes et consentement, parent, paiement, hébergement UE | Les parcours marchent de bout en bout en préproduction, et Victor les utilise |
| 4 — Marque et lancement | Nom, identité, landing qui ne dit que le prouvé, mesures publiées, accès à l'app | Chaque phrase publique renvoie à une source ou à une mesure |

## Repères par lot

**Lot 1** — repères dans `etudes/2026-10-06/refonte-evaluation.md`. Ordre indicatif : des mesures
avec leur marge d'erreur ; une page simple pour que Victor juge, et un juge vérifié contre lui ;
un garde-fou en CI ; puis un jeu plus riche (programmes des autres matières, exercices inspirés du
brevet) et un élève simulé ; observabilité de production avec l'hébergeur.

**Lot 2** — le cœur est fait (#380 à #404, `etudes/2026-10-06/passage-de-fin.md`). Reste à fermer
les fuites restantes (#415) et à le prouver avec le harnais refait.

**Lot 3** — ordre indicatif, pensé pour que Victor teste lui-même au plus tôt : l'app servie par
Hono et installable ; une préproduction hébergée dans l'UE ; le chat avec une connexion simple ;
puis comptes, consentement et mention IA ; photo et voix ; parcours parent ; paiement.

**Lot 4** — nom et identité ; landing réécrite sur la vision, avec la page des mesures et l'accès
à l'app ; pages légales alignées sur l'hébergement réel ; ouverture.

## Porte avant ouverture au public

Rien n'est ouvert à des élèves avant (obligations, pas des repères) :
- art. 50(1) de l'AI Act traité dans le prompt et dans l'interface ;
- détresse et modération mesurées par le harnais ;
- endpoint UE et ZDR actifs ;
- double consentement sous 15 ans ;
- avis d'un conseil sur l'art. 50(2) ;
- pages légales alignées sur l'hébergement réel ;
- mesures publiées rejouables.

## Après la V1

- **Lycée** (`etudes/2026-10-02/alignement.md`, § 9) : la même chaîne de référentiel et
  d'évaluation, par vagues. D'abord la vingtaine de couples (niveau, enseignement) les
  plus suivis de la voie générale, mathématiques en tête ; puis la série STMG et les
  matières générales de la voie professionnelle ; sujets du bac pour évaluer. Le
  référentiel et le jeu sont indexés par enseignement dès le lot 1 pour que le lycée soit
  un ajout de données.

## Hors roadmap, délibérément

- Pronote et les autres logiciels de vie scolaire tant qu'aucune convention officielle n'est
  signée ; les enseignants et les établissements (GAR).
- RAG vectoriel : le programme d'un niveau et d'une matière tient dans le contexte
  (mesuré le 2026-10-02, `etudes/2026-10-02/alignement.md`) ; il ne revient que pour
  chercher dans un corpus qui ne tient pas dans le contexte.
- Référentiels des spécialités professionnelles (plus de 300 textes).
- Un autre fournisseur que Mistral pour l'élève, l'auto-hébergement de poids, le fine-tuning ; un
  juge d'une autre famille pour l'évaluation seule reste possible, les conversations de test
  étant synthétiques.
- Application native.
