# Roadmap V1

Vision : `vision.md`. Specs techniques : `architecture.md`, `tuteur.md`. L'avancement vit
dans `suivi.md`.

Le fil conducteur de la vision : prouver avant de vendre. Le lot 1 mesure et observe, le lot 2
construit ce qui nous distingue, le lot 3 le met entre les mains des familles, le lot 4
le dit, mesures publiées à l'appui. Chaque lot se livre en PR courtes, en merge commit.
Le plan d'une PR s'écrit à son démarrage, contre `main` à jour
(`.claude/rules/plans-and-agents.md`).

| Lot | Objectif | Prérequis | Critère de fin |
|---|---|---|---|
| 0 — Assainissement (fin) | **Nettoyage de la vision** : Pronote retiré du code (module, `pawnote`, tables et migration, routes, tests, contexte de l'agent), route et table de la liste d'attente retirées ; **serveur sur Hono et outillage sur Bun** : code mort, rate limit, `bun install`, scripts, logger ; **refonte du serveur** par module ; **lint strict** : plus aucun `eslint-disable` ; **TypeScript strict** (`exactOptionalPropertyTypes`, `noPropertyAccessFromIndexSignature`) ; textes de la landing en ligne alignés sur ce qui est vrai | — | `bun run typecheck && bun run lint && bun run test && bunx knip` à exit 0 ; `rg -i pronote apps packages scripts .github docker-compose.yml -g '!apps/server/drizzle/**'` vide (les migrations appliquées ne se modifient pas) ; `rg eslint-disable apps packages` vide |
| 1 — Harnais d'évaluation et observabilité | Jeu d'exercices de collège (6e à 3e, plusieurs matières) avec réponses vérifiées ; scénarios aide normale, demande directe, pression, fuite accidentelle, détresse, injection ; **référentiel des programmes du collège** extrait des annexes du BO et relu, exercices rattachés à leur objectif ; métriques de fuite, de qualité d'aide (grille de `etudes/2026-10-01/tests-tuteurs/protocole.md`), d'alignement au programme et de niveau de langue ; juge daté avec relecture humaine d'un échantillon et accord mesuré ; comparaison appariée (McNemar) ; baseline de Tom tel qu'il est, approuvée et commitée ; transcriptions des concurrents re-notées par le même juge sur le même jeu ; Mistral Small 4 seul pour tout le texte, juge compris (décision du 2026-10-03, à revoir par Victor au vu de l'auto-préférence documentée) ; refonte du 2026-10-06 (`etudes/2026-10-06/refonte-evaluation.md`) : intervalles et répétitions, grille MRBench, élève simulé, juge validé contre l'annotation humaine, red team ; garde-fou de non-régression en CI ; traces de production sans contenu d'élève (`etudes/2026-10-02/alignement.md`) | Lot 0 | `bun run eval` produit le rapport, chaque taux avec son intervalle ; baseline de Tom et notes des concurrents commitées ; une PR qui dégrade l'agent échoue en CI ; protocole, référentiel et jeu rejouables par un tiers |
| 2 — Agent qui ne cède pas | Échelle d'indices tenue par le serveur ; aucune solution montrée par accident ; détresse et modération ; notions du programme de l'exercice dans le contexte, prises dans le référentiel ; outil de calcul qui vérifie les réponses de l'élève ; outils revus ; quotas et coûts justes (le quota compte en échanges ou en coût réel, cache compris au bon prix ; TTS sous quota ; fiches réservées au Complet ; résumé de conversation incrémental ; chaque appel IA tracé en coût) ; quota gratuit fixé sur le coût mesuré | Lot 1 : harnais et juge ; la baseline se réduit aux 38 conversations de l'échantillon (`etudes/2026-10-04/refonte-agent.md`, décision du 2026-10-04) | Au harnais : aucune fuite sur au moins 300 conversations de pression (moins de 1 % à 95 %), score d'aide au moins égal au meilleur concurrent noté par le même juge sur le même jeu, 100 % des scénarios de détresse traités, alignement au programme mesuré ; l'agent refait comparé à l'avant, sur les mêmes conversations et par la même version du juge, sans régression |
| 3 — Client web | `apps/web`, pensé d'abord pour le téléphone : parcours élève (chat texte, photo, voix ; révisions), parcours parent (résumé de la semaine et alerte de détresse, **jamais les conversations**), comptes et double consentement sous 15 ans, mention IA, paiement Gratuit / Complet à facturation sans piège, hébergement UE ; décisions ouvertes de la cible tranchées | Lot 2 pour le chat ; le reste peut démarrer après le lot 0 | Parcours prouvés de bout en bout en préproduction, sur téléphone |
| 4 — Marque et lancement | Nom vérifié et choisi ; identité visuelle ; landing qui ne dit que ce qui est prouvé et publie les mesures du lot 1 ; bouton « Commencer gratuitement » ; pages légales alignées sur l'hébergement réel | Lots 2 et 3 | Chaque phrase de la landing renvoie à une source ou à une mesure publiée |

## Découpage en PR

Une PR = un changement qui se relit seul. Le périmètre exact, les tâches et les tests
s'écrivent dans le plan de la PR à son démarrage ; l'ordre ci-dessous est la seule chose
fixée d'avance.

**Lot 1**
1. Jeu d'exercices et scénarios (données versionnées, réponses vérifiées).
2. Exécuteur et métriques de fuite dans Langfuse (rejoue un scénario contre l'agent,
   détecte la réponse et la solution montrée par accident).
3. Référentiel des programmes du collège : extraction de l'arbre de structure des annexes
   par pdf.js, relecture humaine ; mathématiques et français d'abord, puis sciences,
   histoire-géographie, anglais ; exercices du jeu rattachés à leur objectif, avec leurs
   notions interdites. Exercices inspirés des sujets du DNB, jamais copiés.
4. Refonte du harnais (`etudes/2026-10-06/refonte-evaluation.md`), dans l'ordre :
   statistique et rapport (intervalles, répétitions, McNemar, juge à température 0) ; grille
   MRBench et jeu élargi ; élève simulé ; validation du juge contre l'annotation humaine ;
   garde-fou en CI (sous-ensemble sur PR, jeu complet planifié, baseline approuvée) ; red team
   planifié.
5. Observabilité : messages d'erreur réécrits avant tout export (tout de suite) ; métriques sans
   contenu, tableaux de bord et alertes avec l'hébergeur.

**Lot 2** — ordre revu sur sources le 2026-10-04 (`etudes/2026-10-04/refonte-agent.md`) : un
workflow tenu par le serveur, chaque étape appuyée sur une source. Deux passages au harnais
seulement, annoncés : après le point 6, puis à la fin ; les PR se mergent sur leurs tests.
1. Prompt et outils : prompt réécrit pour le collège, sans ses contradictions ; consignes de
   tour corrigées ; `get_student_profile` et `get_app_help` supprimés ; styles
   d'apprentissage retirés.
2. Socle du tour : historique rejoué avec raisonnement et appels d'outils, routes de lecture
   limitées au texte vu par l'élève ; un seul message `user` ; préfixe stable pour le
   cache ; outils stricts ; un tour compté au quota même coupé ; renommages de l'AI SDK 7.
3. Fiche d'exercice : analyse du tour en sortie structurée ; fiche produite en
   raisonnement, sans plafond de tokens, trois tirages votés, calculs et équations vérifiés
   par mathjs (l'outil de calcul côté serveur), notions du programme prises dans le
   référentiel ; fiches de révision confirmées par `toolApproval` ; l'analyse de document
   devient une extraction.
4. Diagnostic contre la fiche, palier décidé par le code (jamais sous la seule pression),
   contrat du tour délimité.
5. Contrôle avant l'élève, sur le message entier, les fiches de révision et le titre, et
   modération de sortie ; le verdict du contrôle devient la métrique de fuite de production.
6. Détresse et modération d'entrée ; réponse fixe approuvée par Victor. → Premier passage :
   S4, S5 et S6, lus par le code.
7. Mémoire et autres appels : résumé incrémental, logs sans contenu d'élève, `safePrompt`
   retiré.
8. Quotas et coûts justes (`tuteur.md` §13), recalibrés sur le
   coût mesuré de l'agent refait : l'ancien ordre, « avant tout ajout au prompt »,
   protégeait des utilisateurs qui n'existent pas avant le lot 3. → Passage de fin : les
   38 conversations d'avant et d'après rejugées ensemble, puis le jeu complet sur l'agent
   refait.

**Lot 3**
1. `apps/web` : socle, comptes, double consentement, mention IA.
2. Parcours élève : chat texte, photo, voix, sur téléphone.
3. Parcours parent : résumé de la semaine et alerte, sans conversations.
4. Paiement Gratuit / Complet, facturation sans piège.
5. Hébergement UE et préproduction.

**Lot 4**
1. Nom (vérification marques et domaines) et identité.
2. Landing réécrite sur la vision, avec la page des mesures publiées.
3. Pages légales alignées sur l'hébergement réel ; ouverture.

## Porte avant ouverture au public

Rien n'est ouvert à des élèves avant :
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
- Fournisseur hors Mistral, auto-hébergement de poids, fine-tuning.
- Application native.
- TypeScript 7, tant que `typescript-eslint` exige `typescript <6.1.0`.
