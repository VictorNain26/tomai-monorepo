---
description: Design system — chargé uniquement sur les fichiers d'interface
paths:
  - "apps/landing/**/*.{ts,astro,css}"
  - "apps/web/**/*.{ts,tsx,css}"
  - "packages/ui/**/*.{ts,tsx}"
  - "packages/tokens/**/*.css"
---

# Design system

L'identité actuelle est rejetée. Ses fondations (couleurs, typographie, place de Tom, ton) se
refont au lot 3, avec Victor, avant les écrans des familles (`docs/decisions.md`) ; le nom et le
logo attendent le lot 4. Les composants ne dépendent de l'identité que par les tokens.

## Interdits

- Aucune direction visuelle que Victor n'a pas validée ; jusque-là, les tokens actuels.
- Aucune couleur, durée, rayon ou taille littérale dans un composant : une classe issue de
  `@repo/tokens`, ou un token ajouté à `theme.css`. Seule exception : les valeurs que Motion
  anime (`animate()` dans la landing), et l'état d'entrée qui les attend.
- Aucune paire de tokens associée sans son test de contraste
  (`packages/tokens/contrast.test.mjs`) : texte dans `PAIRS` à 4,5:1
  ([WCAG 2.2, 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)),
  bordure ou anneau de focus dans `CONTROL_PAIRS` à 3:1
  ([1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)).
- Aucune cible tactile sous 44 px, aucun défilement horizontal à largeur de téléphone, aucune
  animation qui ignore le mouvement réduit.
