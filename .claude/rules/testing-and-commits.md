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

La suite e2e de la landing est locale uniquement : ni en CI, ni dans la validation avant commit.
Prérequis unique : `pnpm --filter landing exec playwright install chromium`. Elle construit le
site, le sert sur le port 3011 et couvre la mise en page (hiérarchie des titres, aucun
défilement horizontal, cibles de 44 px, lignes légales, liens soulignés), le rendu sans
JavaScript et sous mouvement réduit, l'absence de formulaire et de liste d'attente, le menu
mobile et la page 404. D'autres tests gardent des choix de l'identité rejetée (échange
d'exemple et place de Tom dans le hero, signes d'école, graisse et taille des titres) : ils
tiennent tant que la landing est gelée et se revoient au lot 4.

Piège connu de `bun run test:integration` : `src/integration-tests/api-endpoints.test.ts`
mocke `drizzle-orm` partiellement — tout nouveau module importé par la chaîne
`app.ts`/`server-lifecycle.ts` qui tire les schémas Drizzle doit être mocké dans ce fichier
(pattern : voir le mock de `retention-purge.service`).
