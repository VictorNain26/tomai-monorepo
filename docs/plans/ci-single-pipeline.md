# Plan — étape 3 de la refonte : un pipeline, un check agrégé, l'image réécrite

Étude : `docs/etudes/2026-10-06/refonte-architecture.md`, « Web, tests et livraison » et point 3
de l'ordre des PR. Branche `ci/single-pipeline`, depuis `main` à `89c5cc34`.

## Problème

La CI est répartie sur cinq workflows (`ci`, `docker`, `security`, `actionlint`, et les filtres
`git diff` faits main dans `ci`), et le ruleset `Protect main` n'exige qu'une partie des checks :
une PR peut casser l'e2e, l'image, knip ou les contrôles de sécurité et être mergée ; c'est aussi
pourquoi Renovate a perdu sa fusion automatique (#419). L'image copie tout `node_modules`,
dépendances de dev comprises, refait typecheck et lint, et n'est jamais lancée ni publiée.

## Critères d'acceptation

- [ ] Un seul workflow `ci.yml` : vérifications, tests, build, e2e, migrations, image, secrets,
      SAST, audit et actionlint en jobs parallèles, sans filtre `git diff` fait main (turbo
      `--affected` choisit les tâches).
- [ ] Un job `ci-ok` dépend de tous les autres avec `if: always()` et échoue si l'un n'a pas
      réussi ([docs GitHub, `needs`](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-jobs)).
- [ ] L'image ne contient que Bun, les deux bundles, les migrations et le build du web : ni
      `node_modules`, ni lint, ni typecheck, ni curl. Elle est lancée en CI contre Postgres
      (migrations, `/health/ready`) et publiée sur GHCR au SHA sur `main`.
- [ ] La doc (règles, README, architecture, suivi) décrit le pipeline ; l'étape manuelle de
      Victor (rendre `ci-ok` requis, puis rétablir la fusion automatique de Renovate) est écrite.

## Hors périmètre

Le déploiement chez un hébergeur (étape 7), `turbo prune` (l'image finale n'a plus de
`node_modules`, l'élagage du lockfile n'a plus d'objet), le cache distant de turbo.

## Vérification de bout en bout

actionlint vert en local ; image construite et lancée en local contre Postgres ; CI verte sur la
PR, `ci-ok` compris ; un job volontairement cassé fait échouer `ci-ok` (vérifié sur un commit
jetable de la branche, retiré ensuite).

## Décision humaine

Validé par Victor le 2026-10-07 (« go » sur l'étape 3, ordre de l'étude validé le 2026-10-06).
