# Roadmap V1

Vision : `vision.md`. Specs techniques :
`architecture.md`, `agent.md`.

Le fil conducteur de la vision : prouver avant de vendre. Le lot 1 mesure, le lot 2
construit ce qui nous distingue, le lot 3 le met entre les mains des familles, le lot 4
le dit, mesures publiées à l'appui. Chaque lot se livre en PR courtes, en merge commit.
Le plan d'une PR s'écrit à son démarrage, contre `main` à jour
(`.claude/rules/plans-and-agents.md`).

| Lot | Objectif | Prérequis | Critère de fin |
|---|---|---|---|
| 0 — Assainissement (fin) | **Nettoyage de la vision** : Pronote retiré du code (module, `pawnote`, tables et migration, routes, tests, contexte de l'agent), route et table de la liste d'attente retirées ; **E2** : infra serveur et outillage ; **lint strict** : plus aucun `eslint-disable` (listes dans `suivi.md`, « Reporté ») ; textes de la landing en ligne alignés sur ce qui est vrai (#338) | — | `pnpm typecheck && pnpm lint && pnpm test && pnpm exec knip` à exit 0 ; `rg -i pronote apps packages scripts .github docker-compose.yml -g '!apps/server/drizzle/**'` vide (les migrations appliquées ne se modifient pas) ; `rg eslint-disable apps packages` vide |
| 1 — Harnais d'évaluation | Jeu d'exercices de collège (6e à 3e, plusieurs matières) avec réponses vérifiées ; scénarios aide normale, demande directe, pression et fuite accidentelle (solution visible dans un raisonnement) ; métriques de fuite et de qualité d'aide (grille de `etudes/2026-10-01/tests-tuteurs/protocole.md`) ; juge daté avec relecture humaine d'un échantillon ; comparaison appariée (McNemar) ; baseline de Tom tel qu'il est ; transcriptions des concurrents re-notées par le même juge sur le même jeu ; règle Small 4 seul ou escalade vers Medium tranchée par la mesure ; format de rapport publiable | Lot 0 | `bun run eval` produit le rapport ; baseline de Tom et notes des concurrents commitées ; protocole et jeu d'exercices rejouables par un tiers |
| 2 — Agent qui ne cède pas | Échelle d'indices tenue par le serveur ; aucune solution montrée par accident ; détresse et modération ; outils revus ; quotas et coûts justes (le quota compte en échanges ou en coût réel, cache compris au bon prix ; TTS sous quota ; fiches réservées au Complet ; résumé de conversation incrémental ; chaque appel IA tracé en coût) ; quota gratuit fixé sur le coût mesuré | Lot 1 | Au harnais : zéro fuite en pression, score d'aide au moins égal au meilleur concurrent noté par le même juge sur le même jeu, 100 % des scénarios de détresse traités ; chaque changement comparé à la baseline sans régression |
| 3 — Client web | `apps/web`, pensé d'abord pour le téléphone : parcours élève (chat texte, photo, voix ; révisions), parcours parent (résumé de la semaine et alerte de détresse, **jamais les conversations**), comptes et double consentement sous 15 ans, mention IA, paiement Gratuit / Complet à facturation sans piège, hébergement UE ; décisions ouvertes de la cible tranchées | Lot 2 pour le chat ; le reste peut démarrer après le lot 0 | Parcours prouvés de bout en bout en préproduction, sur téléphone |
| 4 — Marque et lancement | Nom vérifié et choisi ; identité visuelle ; landing qui ne dit que ce qui est prouvé et publie les mesures du lot 1 ; bouton « Commencer gratuitement » ; pages légales alignées sur l'hébergement réel | Lots 2 et 3 ; entretiens parents faits | Chaque phrase de la landing renvoie à une source ou à une mesure publiée |

## Découpage en PR

Une PR = un changement qui se relit seul. Le périmètre exact, les tâches et les tests
s'écrivent dans le plan de la PR à son démarrage ; l'ordre ci-dessous est la seule chose
fixée d'avance.

**Lot 0**
1. `fix/landing-honest-claims` (#338) : textes de la landing en ligne. Mergée.
2. `chore/remove-pronote-waitlist` (#341) : Pronote et la liste d'attente retirés du code
   (schéma et migration, dépendances, variables, tests, contexte de l'agent). Mergée.
3. E2 — infra serveur et outillage : la liste « Lot 0 — E2 » de `suivi.md`.
4. Lint strict : chaque `eslint-disable` remplacé par une forme de code qui ne déclenche
   pas la règle, puis `noInlineConfig`.

**Lot 1**
1. Jeu d'exercices et scénarios (données versionnées, réponses vérifiées).
2. Exécuteur et métriques de fuite (rejoue un scénario contre l'agent, détecte la
   réponse et la solution montrée par accident).
3. Juge de qualité d'aide daté, relecture humaine d'un échantillon, accord mesuré.
4. Rapport, comparaison appariée, baseline de Tom, re-notation des concurrents, décision
   Small 4 ou Medium.

**Lot 2**
1. Échelle d'indices tenue par le serveur et anti-fuite.
2. Détresse et modération.
3. Quotas et coûts justes (les défauts listés dans `suivi.md`, « Lot 2 »).
4. Outils, prompt et mémoire revus, chaque changement passé au harnais.

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

- **Entretiens parents** (8 à 10, dont des familles modestes), dès maintenant : guide dans
  `etudes/2026-10-01/parents.md`. Ils tranchent le prix, l'appareil du soir et les canaux
  avant le lot 4.
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

## Hors roadmap, délibérément

- Pronote et les autres logiciels de vie scolaire tant qu'aucune convention officielle n'est
  signée ; les enseignants et les établissements (GAR).
- Retour d'un RAG vectoriel : supprimé en août 2026 (#294) faute de gain démontré ; il ne revient que si le lot 2 en montre le besoin.
- Fournisseur hors Mistral, auto-hébergement de poids, fine-tuning.
- Application native.
- TypeScript 7, tant que `typescript-eslint` exige `typescript <6.1.0`.
