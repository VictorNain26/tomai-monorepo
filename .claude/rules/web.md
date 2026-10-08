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
  (`apps/server/src/platform/http/security-headers.ts`, vérifiée par `tooling/playwright-web/tests/server.spec.ts`).
- Jamais de `runtimeCaching` sur `/api` dans le service worker : ce sont des données d'élève ;
  les navigations `/api` restent hors de son fallback.
- Jamais une primitive interactive refaite ici : elle vient de `@repo/ui`.
- Jamais éditer `src/routeTree.gen.ts`, généré par le plugin TanStack Router.

## Données d'un mineur

- Jamais, sous 15 ans, un traitement fondé sur le consentement sans le double consentement de
  l'enfant et du parent ([CNIL, recommandation 4](https://www.cnil.fr/fr/recommandation-4-rechercher-le-consentement-dun-parent-pour-les-mineurs-de-moins-de-15-ans)) ;
  la règle vit dans `apps/server/src/domain/memory-consent.ts`.
- Jamais le même texte pour un parent et pour un élève de 12 ans : l'information s'adapte à
  l'âge ([CNIL, recommandation 6](https://www.cnil.fr/fr/recommandation-6-renforcer-linformation-et-les-droits-des-mineurs-par-le-design)).
- Jamais un compte élève public ni partagé avec un tiers, jamais de publicité, jamais de
  mécanique d'engagement (séries, points, notifications de rétention).
