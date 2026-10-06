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

## Revue

`/code-review` : 10 constats, tous corrigés.

- Page en serif sur fond blanc : les tokens supposaient `--font-nunito`, que seul `next/font` pose.
  `theme.css` donne le nom de la fonte en repli de `var()` ; `apps/web` charge Nunito par Fontsource
  (`@fontsource-variable/nunito` 5.3.0 : release 2026-07-19, dépôt actif, 183 k téléchargements
  par semaine). La couche de base (fond, texte, fonte, focus) passe dans `@repo/tokens/base.css`,
  importée par les deux apps ; la landing passe ses 79 tests Playwright.
- Un test vérifie désormais le fond crème et Nunito chargée, que l'ancien laissait passer.
- TypeScript séparé comme dans le gabarit Vite : navigateur (`src`), Node (configs), e2e (DOM et
  Node) ; `@types/node` déclaré.
- `lint-web` en pre-commit, `--strictPort`, `.prettierignore` pour l'arbre de routes,
  `dev:web` et `build:web`, `clean`, `CLAUDE.md` racine à jour, favicon, icône d'écran d'accueil
  et `theme-color`.
