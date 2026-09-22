---
description: Design system — chargé uniquement sur les fichiers d'interface
paths:
  - "apps/landing/**/*.{ts,tsx,css}"
  - "packages/ui/**/*.{ts,tsx,css}"
  - "packages/tokens/**/*.css"
---

# Design system — règles d'application

Ce qui s'applique à chaque PR touchant de l'UI.

- **Tokens uniquement** : aucune couleur, durée, rayon ou taille littérale
  dans composants et écrans — classes utilitaires issues de `@repo/tokens`
  (`bg-primary`, `duration-base`, `rounded-lg`…). Nouveau token = ajout dans
  `theme.css` (et `theme-dark.css` s'il change en dark).
- **États complets** sur tout interactif : disabled, loading, hover, active,
  focus visible, error. Pas de happy-path only.
- **A11y AA** : cibles ≥ 44 px, labels (`aria-*` / `<label>`), contraste 4.5:1.
- **Patterns UX** : skeletons (pas de spinner pleine page), empty state avec
  action, validation formulaire au blur, toast = info / dialog = irréversible,
  reduced-motion respecté.
- **Registres** : landing/parent = sobre ; élève = vivant (violet,
  micro-motion) sans infantiliser.
- **Typo** : Fraunces titres, Figtree corps, JetBrains Mono code.
- **Exceptions au « tokens uniquement »** : les valeurs que `motion` anime
  lui-même dans `style`, et les images `next/og` (`ImageResponse` ne lit que
  `style`, sans variables CSS). Rien d'autre.
