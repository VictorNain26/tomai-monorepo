---
description: Runners et emplacement des tests du monorepo — chargé en ouvrant un test
paths:
  - "**/*.test.ts"
  - "**/*.test.mjs"
  - "**/*.spec.ts"
  - "**/playwright.config.*"
  - "apps/server/src/testing/**"
---

# Tests — conventions monorepo

`bun run test` à la racine lance les tests du serveur et des paquets ; ceux du serveur
demandent le Postgres de `docker compose` (`DATABASE_URL`).

| Suite | Runner | Commande | Emplacement |
|-------|--------|----------|-------------|
| Serveur | Bun, Postgres | `cd apps/server && bun test` | à côté du code, `<fichier>.test.ts` |
| Tokens | Bun | `bun run test` | `packages/tokens/contrast.test.mjs` |
| Web, de bout en bout | Playwright | `bunx turbo run test:e2e --filter=@repo/playwright-web` | `tooling/playwright-web/tests/` |
| Landing | Playwright | `bunx turbo run test:e2e --filter=landing` | `apps/landing/tests/` |

- **Serveur** : un test exerce le vrai code sur une vraie base, jamais un module remplacé.
  `testDatabase()` (`apps/server/src/testing/database.ts`) donne au fichier sa base, copiée
  d'un modèle que le preload migre une fois par lancement (`CREATE DATABASE … TEMPLATE`) et
  supprimée après ; l'app se construit par `createApp` avec ses dépendances. Pas de
  `mock.module` : une dépendance se remplace en la passant.
- **Web, de bout en bout** : le paquet `@repo/playwright-web` dépend du web et du serveur, que
  turbo construit d'abord ; Playwright lance le serveur construit, qui sert le web construit, sur
  sa propre base recréée à chaque lancement (`E2E_DATABASE_URL`, par défaut `tom_e2e` du
  Postgres local). Projets `iphone` (WebKit) et `android` (Chromium) ; prérequis :
  `cd tooling/playwright-web && bunx playwright install chromium webkit`, puis les
  bibliothèques système de WebKit, `bunx playwright install-deps webkit`.
- **Landing** : mise en page (hiérarchie des titres, aucun défilement horizontal, cibles de
  44 px, lignes légales, liens soulignés), rendu sans JavaScript et sous mouvement réduit,
  absence de formulaire et de liste d'attente, menu mobile, page 404.

Les suites Playwright tournent en CI (job `E2E (Playwright)`, tâche turbo `test:e2e`, sur les
paquets touchés), pas avant un commit.
