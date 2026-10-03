# Roadmap V1

Vision : `vision.md`. Specs techniques :
`architecture.md`, `agent.md`.

Le fil conducteur de la vision : prouver avant de vendre. Le lot 1 mesure et observe, le lot 2
construit ce qui nous distingue, le lot 3 le met entre les mains des familles, le lot 4
le dit, mesures publiées à l'appui. Chaque lot se livre en PR courtes, en merge commit.
Le plan d'une PR s'écrit à son démarrage, contre `main` à jour
(`.claude/rules/plans-and-agents.md`).

| Lot | Objectif | Prérequis | Critère de fin |
|---|---|---|---|
| 0 — Assainissement (fin) | **Nettoyage de la vision** : Pronote retiré du code (module, `pawnote`, tables et migration, routes, tests, contexte de l'agent), route et table de la liste d'attente retirées ; **serveur sur Hono et outillage sur Bun** : code mort, rate limit, `bun install`, scripts, logger ; **refonte du serveur** par module ; **lint strict** : plus aucun `eslint-disable` (listes dans `suivi.md`, « Reporté ») ; textes de la landing en ligne alignés sur ce qui est vrai (#338) | — | `bun run typecheck && bun run lint && bun run test && bunx knip` à exit 0 ; `rg -i pronote apps packages scripts .github docker-compose.yml -g '!apps/server/drizzle/**'` vide (les migrations appliquées ne se modifient pas) ; `rg eslint-disable apps packages` vide |
| 1 — Harnais d'évaluation et observabilité | Jeu d'exercices de collège (6e à 3e, plusieurs matières) avec réponses vérifiées ; scénarios aide normale, demande directe, pression, fuite accidentelle, détresse, injection ; **référentiel des programmes du collège** extrait des annexes du BO et relu, exercices rattachés à leur objectif ; métriques de fuite, de qualité d'aide (grille de `etudes/2026-10-01/tests-tuteurs/protocole.md`), d'alignement au programme et de niveau de langue ; juge daté avec relecture humaine d'un échantillon et accord mesuré ; comparaison appariée (McNemar) ; baseline de Tom tel qu'il est, approuvée et commitée ; transcriptions des concurrents re-notées par le même juge sur le même jeu ; Mistral Small 4 seul pour tout le texte, juge compris (décision du 2026-10-03) ; garde-fou de non-régression en CI ; traces de production sans contenu d'élève (`etudes/2026-10-02/alignement.md`) | Lot 0 | `bun run eval` produit le rapport ; baseline de Tom et notes des concurrents commitées ; une PR qui dégrade l'agent échoue en CI ; protocole, référentiel et jeu rejouables par un tiers |
| 2 — Agent qui ne cède pas | Échelle d'indices tenue par le serveur ; aucune solution montrée par accident ; détresse et modération ; programme du niveau dans le contexte et adaptation par niveau réécrite à partir du référentiel ; outil de calcul qui vérifie les réponses de l'élève ; outils revus ; quotas et coûts justes (le quota compte en échanges ou en coût réel, cache compris au bon prix ; TTS sous quota ; fiches réservées au Complet ; résumé de conversation incrémental ; chaque appel IA tracé en coût) ; quota gratuit fixé sur le coût mesuré | Lot 1 | Au harnais : zéro fuite en pression, score d'aide au moins égal au meilleur concurrent noté par le même juge sur le même jeu, 100 % des scénarios de détresse traités, alignement au programme mesuré ; chaque changement comparé à la baseline sans régression |
| 3 — Client web | `apps/web`, pensé d'abord pour le téléphone : parcours élève (chat texte, photo, voix ; révisions), parcours parent (résumé de la semaine et alerte de détresse, **jamais les conversations**), comptes et double consentement sous 15 ans, mention IA, paiement Gratuit / Complet à facturation sans piège, hébergement UE ; décisions ouvertes de la cible tranchées | Lot 2 pour le chat ; le reste peut démarrer après le lot 0 | Parcours prouvés de bout en bout en préproduction, sur téléphone |
| 4 — Marque et lancement | Nom vérifié et choisi ; identité visuelle ; landing qui ne dit que ce qui est prouvé et publie les mesures du lot 1 ; bouton « Commencer gratuitement » ; pages légales alignées sur l'hébergement réel | Lots 2 et 3 | Chaque phrase de la landing renvoie à une source ou à une mesure publiée |

## Découpage en PR

Une PR = un changement qui se relit seul. Le périmètre exact, les tâches et les tests
s'écrivent dans le plan de la PR à son démarrage ; l'ordre ci-dessous est la seule chose
fixée d'avance.

**Lot 0**
1. `fix/landing-honest-claims` (#338) : textes de la landing en ligne. Mergée.
2. `chore/remove-pronote-waitlist` (#341) : Pronote et la liste d'attente retirés du code
   (schéma et migration, dépendances, variables, tests, contexte de l'agent). Mergée.
3. `refactor/server-cleanup` (#342) : code mort, validation des routes enfant, rate limit.
   Mergée.
4. `refactor/server-hono` (#343) : Elysia remplacé par Hono, sur Bun. Mergée.
5. Outillage Bun, en deux PR : `build/bun-package-manager` (#344, `bun install` à la place
   de pnpm, CI, Docker, Vercel) et `build/bun-scripts` (#346, scripts et tests de scripts
   sous Bun, liste « outillage » soldée). Mergées.
6. `refactor/server-logger` (#347) : pino et codemod du motif `_error`. Mergée.
7. Refonte du serveur, une PR par module de `architecture.md` (`auth` et parent, `chat`,
   `learning`, `documents`, `billing`, `voice`, `platform`) : un dossier par module, un
   routeur Hono par ressource, services et dépôts revus, fichiers sous 400 lignes.
8. Lint strict : chaque `eslint-disable` remplacé par une forme de code qui ne déclenche
   pas la règle, puis `noInlineConfig`. En dernier, sur le code refondu. Mergée (#355).
9. TypeScript strict (demandé le 2026-10-02) : `exactOptionalPropertyTypes` et
   `noPropertyAccessFromIndexSignature` dans `tsconfig.base.json`. Mergée (#356).

**Lot 1**
1. Jeu d'exercices et scénarios (données versionnées, réponses vérifiées) (#358). Mergée.
2. Exécuteur et métriques de fuite dans Langfuse (rejoue un scénario contre l'agent,
   détecte la réponse et la solution montrée par accident).
3. Référentiel des programmes du collège : extraction de l'arbre de structure des annexes
   par pdf.js, relecture humaine ; mathématiques et français d'abord, puis sciences,
   histoire-géographie, anglais ; exercices du jeu rattachés à leur objectif, avec leurs
   notions interdites. Exercices inspirés des sujets du DNB, jamais copiés.
4. Juge daté sur Small 4 : qualité d'aide, alignement au programme, niveau de langue, en
   contrôles oui/non avec référence et tirages multiples ; cas construits ; relecture
   humaine d'un échantillon, accord mesuré (`etudes/2026-10-03/refonte-harnais.md`).
5. Jeu d'évaluation en dataset Langfuse hébergé et versionné, un run par répétition ;
   rapport, comparaison appariée, baseline de Tom approuvée, re-notation des concurrents.
6. Garde-fou en CI sur les PR de l'agent, contre la baseline ; traces de production sans
   contenu exportées vers Langfuse UE.

**Lot 2**
1. Échelle d'indices tenue par le serveur et anti-fuite ; le verdict du contrôle en ligne
   devient la métrique de fuite de production.
2. Détresse et modération.
3. Quotas et coûts justes (les défauts listés dans `suivi.md`, « Lot 2 »), avant tout ajout
   au prompt.
4. Programme du niveau et de la matière dans le contexte ; adaptation par niveau réécrite
   à partir du référentiel ; gardé seulement si le harnais le justifie.
5. Outil de calcul côté serveur, après vérification de sa documentation.
6. Outils, prompt et mémoire revus, chaque changement passé au harnais.

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

## En parallèle, côté Victor

- **Zero Data Retention** à demander à Mistral avant tout utilisateur réel.

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
