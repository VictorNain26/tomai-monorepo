---
description: Design system — chargé uniquement sur les fichiers d'interface
paths:
  - "apps/landing/**/*.{ts,tsx,css}"
  - "apps/mobile/**/*.{ts,tsx,css}"
  - "packages/ui/**/*.{ts,tsx,css}"
  - "packages/tokens/**/*.{ts,css}"
---

# Design system — règles d'application

Contrat complet : `docs/design/design-system.md`. Ici : ce qui s'applique à
chaque PR touchant de l'UI.

- **Tokens uniquement** : aucune couleur, durée, rayon ou taille littérale
  dans composants et écrans — classes utilitaires issues de `@repo/tokens`
  (`bg-primary`, `duration-base`, `rounded-lg`…). Nouveau token = ajout dans
  `@repo/tokens` (CSS + miroir TS testé si consommé hors CSS).
- **Parité des homonymes** : un composant présent dans `packages/ui` (DOM) ET
  `apps/mobile/src/components/ui` (RN) expose le même noyau de
  variants/sizes. Modifier un côté = vérifier l'autre. Noyau Button :
  `default | destructive | outline | secondary | ghost` (DOM-only : `link`,
  `premium`). Jamais de composant partagé DOM/RN (ADR 0001).
- **États complets** sur tout interactif : disabled, loading, pressed (RN) /
  hover + active (DOM), focus visible, error. Pas de happy-path only.
- **A11y AA** : cibles ≥ 44 px tactile, labels (`accessibilityLabel` /
  `aria-*` / `<label>`), contraste 4.5:1.
- **Patterns UX** : skeletons (pas de spinner pleine page), empty state avec
  action, validation formulaire au blur, toast = info / dialog = irréversible,
  reduced-motion respecté.
- **Registres** : landing/parent = sobre ; élève = vivant (violet,
  micro-motion, haptics) sans infantiliser.
- **Typo** : Poppins titres, Nunito Sans corps, JetBrains Mono code.
