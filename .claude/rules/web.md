---
description: Client web apps/web — chargé uniquement sur ses fichiers
paths:
  - "apps/web/**"
---

# Client web (`apps/web`)

Seul client produit. Cible et choix : `docs/architecture.md`, « Client web » ; options
comparées : `docs/etudes/2026-10-06/client-web.md`.

- **Téléphone d'abord** : chaque parcours se conçoit et se prouve à largeur de téléphone, le
  bureau s'en déduit. La suite de bout en bout (`tooling/playwright-web`, voir
  `.claude/rules/testing.md`) joue deux projets, `iphone` (WebKit) et `android` (Chromium).
- **Frontière** : le client typé du serveur arrive avec l'étape 6 de la refonte, quand le web
  l'appelle ; les primitives interactives viennent de `@repo/ui`. Aujourd'hui `apps/web` ne
  dépend que de `@repo/tokens` et n'appelle pas encore le serveur.
- Port 3002 en dev ; le proxy de Vite (`vite.config.ts`) envoie `/api/` et `/health` au serveur
  sur 3000, pour une seule origine comme en production, où Hono sert le build. Cette origine est
  la base de better-auth en dev (`BETTER_AUTH_URL`), pour que ses redirections reviennent au web.
- L'e2e tourne sur le serveur construit, qui sert le web construit : ses en-têtes, sa CSP, son
  fallback. `preview` est celui de Vite, sans les en-têtes du serveur.
- Le build pose un `.gz` à côté de chaque fichier compressible (script `build`), que le serveur
  sert à un navigateur qui l'accepte.
- **CSP du serveur** (`apps/server/src/platform/http/security-headers.ts`) :
  `default-src 'self'`, vérifiée par `tooling/playwright-web/tests/server.spec.ts` ; le dev
  (Vite) tourne sans elle.
  Pas de script ni de style en ligne, pas d'asset en `data:` (`assetsInlineLimit: 0`), aucune
  origine tierce sans l'ajouter à la CSP dans la même PR.
- **PWA** (`vite-plugin-pwa`, `tooling/playwright-web/tests/pwa.spec.ts`) : le service worker ne met en cache que le
  build ; jamais de `runtimeCaching` sur `/api` (données d'élève), et les navigations `/api`
  restent hors de son fallback.
- `src/routeTree.gen.ts` est généré par le plugin TanStack Router (`vite.config.ts`) à partir
  de `src/routes/` : on ne l'édite pas, ESLint l'ignore.
- TypeScript en deux projets sous `tsc -b` : `tsconfig.app.json` (`src`) et
  `tsconfig.node.json` (config Vite). Un fichier hors de ces `include` n'est pas vérifié.
