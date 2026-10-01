# Plan — `build/bun-scripts`

Seconde PR « outillage Bun » du lot 0 (`roadmap.md`, point 5) : les scripts et leurs tests
passent sous Bun, et la liste « Lot 0 — outillage » de `suivi.md` est soldée.

## Pré-vol (2026-10-01, contre `main` à `372a41f`)

- `bun test` exécute tels quels les tests écrits pour `node:test` : 20 tests de
  `scripts/doctor-checks.test.mjs`, 27 de `packages/tokens/contrast.test.mjs`. Aucune
  réécriture n'est nécessaire.
- Bun expose `util.parseEnv` (`node:util`), qui remplace le parseur maison du doctor.
- `apps/server/src/db/migrate.ts` crée l'extension `vector` sous verrou consultatif avant
  les migrations. `scripts/setup.mjs` et `ci.yml` la recréent pour rien.
- `bun.lock` ne résout qu'un `react` (19.3.0) et un `next` (16.3.7) : le doublon constaté
  avec pnpm le 2026-09-23 a disparu, le point est clos sans changement.
- `appleWebApp` : `capable` et `statusBarStyle` sont typés (`AppleWebApp` dans
  `next/dist/lib/metadata/types`), et la doc locale
  (`next/dist/docs/01-app/03-api-reference/04-functions/generate-metadata.md`) montre la
  sortie HTML.

## Tâches

1. **Scripts sous Bun** : `scripts/*.mjs` lancés par `bun` (racine `package.json`,
   shebangs) ; `test:scripts` et le test des tokens passent sur `bun test`. Le doctor lit
   le `.env` avec `util.parseEnv`, qui gère les commentaires en fin de ligne.
2. **Attentes et extension** : `scripts/dev.mjs` fait une seule attente
   (`docker compose up -d --wait`) avant les checks ; `CREATE EXTENSION` quitte
   `setup.mjs` et `ci.yml` ; le check « vector absente » renvoie au migrateur.
3. **CI** : boucle `pg_isready` retirée (le runner attend le service `healthy`), variables
   `TURBO_TOKEN` et `TURBO_TEAM` retirées (aucun secret, cache distant désactivé), étape
   `bun run test:scripts` ajoutée.
4. **Déclarations mortes** : `ignoreBinaries` et `scripts/**/*.ts` de `apps/server` dans
   `knip.json` ; montage `./apps/server/scripts` de `docker-compose.yml`.
5. **Landing** : `appleWebApp` typé à la place du bloc `other`.
6. **Doc** : skill `dev-bootstrap` (plus de `CREATE EXTENSION` à la main), suivi,
   roadmap, puis suppression de ce plan.

## Validation

`bun run typecheck && bun run lint && bun run test && bun run test:scripts && bunx --no-install knip` ;
`bun run setup` puis `bun run doctor` sur une base neuve ; build de la landing et lecture du
`<head>` produit ; CI au vert.
