---
description: Runners et emplacement des tests du monorepo — chargé en ouvrant un test
paths:
  - "apps/server/src/tests/**"
  - "apps/server/src/integration-tests/**"
  - "apps/server/src/live/**"
  - "apps/landing/tests/**"
  - "apps/landing/playwright.config.*"
---

# Tests — conventions monorepo

| App | Runner | Commande | Emplacement |
|-----|--------|----------|-------------|
| Server | Bun | `cd apps/server && bun run test` | `src/tests/<service>.test.ts` |
| Landing | Playwright | `pnpm --filter landing test:e2e` | `apps/landing/tests/<name>.spec.ts` |

La suite e2e de la landing est locale uniquement : ni en CI, ni dans la validation avant commit.
Prérequis unique : `pnpm --filter landing exec playwright install chromium`. Elle construit le
site, le sert sur le port 3011 et couvre la mise en page (aucun défilement horizontal, cibles
de 44 px, lignes légales), le rendu sans JavaScript et sous mouvement réduit, le formulaire et
le menu mobile, ainsi que trois garde-fous propres à la page d'accueil : la place réservée à
Tom, les signes d'école (un surlignage par titre, une note par section), la graisse des titres.

Piège connu de `bun run test:integration` : `src/integration-tests/api-endpoints.test.ts`
mocke `drizzle-orm` partiellement — tout nouveau module importé par la chaîne
`app.ts`/`server-lifecycle.ts` qui tire les schémas Drizzle doit être mocké dans ce fichier
(pattern : voir le mock de `retention-purge.service`).
