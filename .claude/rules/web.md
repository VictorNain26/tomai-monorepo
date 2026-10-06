---
description: Client web apps/web — chargé uniquement sur ses fichiers
paths:
  - "apps/web/**"
---

# Client web (`apps/web`)

Seul client produit. Cible et choix : `docs/architecture.md`, « Client web » ; options
comparées : `docs/etudes/2026-10-06/client-web.md`.

- **Téléphone d'abord** : chaque parcours se conçoit et se prouve à largeur de téléphone, le
  bureau s'en déduit. Playwright joue deux projets, `iphone` (WebKit) et `android`
  (Chromium) ; prérequis : `cd apps/web && bunx playwright install chromium webkit`, puis les
  bibliothèques système de WebKit, `bunx playwright install-deps webkit`.
- **Frontière** : le serveur s'appelle par le client typé `@repo/api`, dont les types viennent
  du serveur, initialisé avec `window.location.origin` ; les primitives interactives viennent de
  `@repo/ui`. Aujourd'hui `apps/web` ne dépend que de `@repo/tokens` et n'appelle pas encore le
  serveur.
- Port 3002 en dev ; le proxy de Vite (`vite.config.ts`) envoie `/api/` et `/health` au serveur
  sur 3000, pour une seule origine comme en production, où Hono sert le build. Cette origine est
  la base de better-auth en dev (`BETTER_AUTH_URL`), pour que ses redirections reviennent au web.
- `preview` et l'e2e servent le build par `serve-web` de `@repo/web-host`, le code même du
  serveur : ses en-têtes, sa CSP, son fallback, sans l'API.
- Le build pose un `.gz` à côté de chaque fichier compressible (script `build`), que le serveur
  sert à un navigateur qui l'accepte.
- **CSP du serveur** (`packages/web-host/src/security-headers.ts`) :
  `default-src 'self'`, vérifiée par `tests/server.spec.ts` ; le dev (Vite) tourne sans elle.
  Pas de script ni de style en ligne, pas d'asset en `data:` (`assetsInlineLimit: 0`), aucune
  origine tierce sans l'ajouter à la CSP dans la même PR.
- **PWA** (`vite-plugin-pwa`, `tests/pwa.spec.ts`) : le service worker ne met en cache que le
  build ; jamais de `runtimeCaching` sur `/api` (données d'élève), et les navigations `/api`
  restent hors de son fallback.
- `src/routeTree.gen.ts` est généré par le plugin TanStack Router (`vite.config.ts`) à partir
  de `src/routes/` : on ne l'édite pas, ESLint l'ignore.
- TypeScript en trois projets sous `tsc -b` : `tsconfig.app.json` (`src`),
  `tsconfig.node.json` (configs Vite et Playwright), `tsconfig.e2e.json` (`tests`). Un fichier
  hors de ces `include` n'est pas vérifié.
