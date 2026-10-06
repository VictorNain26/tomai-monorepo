---
description: Runners et emplacement des tests du monorepo — chargé en ouvrant un test
paths:
  - "apps/server/src/tests/**"
  - "apps/server/src/integration-tests/**"
  - "apps/server/src/live/**"
  - "apps/landing/tests/**"
  - "apps/landing/playwright.config.*"
  - "apps/web/tests/**"
  - "apps/web/playwright.config.*"
  - "packages/**/*.test.*"
---

# Tests — conventions monorepo

`bun run test` à la racine lance les tests unitaires du serveur et des paquets.

| Suite | Runner | Commande | Emplacement |
|-------|--------|----------|-------------|
| Server, unitaires | Bun | `cd apps/server && bun run test` | `src/tests/<sujet>.test.ts` |
| Server, intégration | Bun, postgres requis | `cd apps/server && bun run test:integration` (en CI) | `src/integration-tests/` |
| Server, appels réels | Bun, vraie clé Mistral | `cd apps/server && bun run test:live` (hors CI) | `src/live/` |
| Paquets | Bun | `bun run test` | `packages/api/tests/`, `packages/tokens/contrast.test.mjs` |
| Landing | Playwright | `bunx turbo run test:e2e --filter=landing` | `apps/landing/tests/<nom>.spec.ts` |
| Web | Playwright | `bunx turbo run test:e2e --filter=web` | `apps/web/tests/<nom>.spec.ts` |

Côté serveur, la couverture vise ce qui casse silencieusement : quotas, transactions
multi-tables. Le contraste des paires de tokens associées est testé par
`packages/tokens/contrast.test.mjs`.

Les suites Playwright tournent en CI (job `E2E (Playwright)`, tâche turbo `test:e2e`, sur les
paquets touchés), pas dans la validation avant commit. La tâche dépend du build : Playwright
sert l'app déjà construite (landing sur 3011, web sur 3012). En local, passer par turbo, qui
construit d'abord : `bunx turbo run test:e2e --filter=web` ; prérequis : `cd apps/web &&
bunx playwright install chromium webkit`. La suite de la landing couvre la mise en page
(hiérarchie des titres, aucun défilement horizontal, cibles de 44 px, lignes légales, liens
soulignés), le rendu sans JavaScript et sous mouvement réduit, l'absence de formulaire et de
liste d'attente, le menu mobile et la page 404. Projets et prérequis du web :
`.claude/rules/web.md`.

Piège connu de `bun run test:integration` : `src/integration-tests/api-endpoints.test.ts`
mocke `drizzle-orm` partiellement — tout nouveau module importé par la chaîne
`app.ts`/`platform/lifecycle/server-lifecycle.ts` qui tire les schémas Drizzle doit être mocké dans ce fichier
(pattern : voir le mock de `modules/learning/index`).
