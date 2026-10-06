---
description: Client web apps/web — chargé uniquement sur ses fichiers
paths:
  - "apps/web/**"
---

# Client web (`apps/web`)

Seul client produit, pensé d'abord pour le téléphone. Cible : `docs/architecture.md`,
« Client web » ; options comparées : `docs/etudes/2026-10-06/client-web.md`. Port 3002 en dev :
le proxy de Vite envoie `/api/` et `/health` au serveur sur 3000, pour une seule origine.

## Interdits

- Jamais un parcours qui ne tienne pas à largeur de téléphone, sur WebKit comme sur Chromium
  (suite `tooling/playwright-web`).
- Jamais de script ni de style en ligne, ni d'asset en `data:` (`assetsInlineLimit: 0`), ni
  d'origine tierce sans l'ajouter à la CSP du serveur dans la même PR
  (`apps/server/src/platform/http/security-headers.ts`, vérifiée par `tests/server.spec.ts`).
- Jamais de `runtimeCaching` sur `/api` dans le service worker : ce sont des données d'élève ;
  les navigations `/api` restent hors de son fallback.
- Jamais une primitive interactive refaite ici : elle vient de `@repo/ui`.
- Jamais éditer `src/routeTree.gen.ts`, généré par le plugin TanStack Router.
