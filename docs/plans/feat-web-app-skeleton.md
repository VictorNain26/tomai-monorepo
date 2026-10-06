# Squelette de `apps/web`

Lot 3, point 1 (`docs/etudes/2026-10-06/client-web.md`) : l'application, sans encore d'appel au
serveur.

## Pré-vol

- Base générée par l'outil officiel (`@tanstack/cli create --router-only`) puis adaptée : versions
  du monorepo (sherif), `tsconfig.base.json`, ESLint `react-internal`, sans les devtools.
- Vite 8.3.3 a moins d'un jour : `minimum-release-age` du dépôt, Vite 8.3.2 retenu.
- `@repo/ui` n'entre qu'avec le premier composant qui l'utilise (knip).
- Vitest attend les premiers composants ; Playwright prouve le rendu à largeur de téléphone.

## Tâches

1. `apps/web` : Vite, TanStack Router (routes par fichier, `routeTree.gen.ts` commité pour le
   typecheck), Tailwind 4 et `@repo/tokens`, page d'accueil en français.
2. Playwright : iPhone (WebKit) et Android (Chromium).
3. README, `scripts/dev.mjs` (port 3002), suivi.
