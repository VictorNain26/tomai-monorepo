---
description: Design system — chargé uniquement sur les fichiers d'interface
paths:
  - "apps/landing/**/*.{ts,astro,css}"
  - "apps/web/**/*.{ts,tsx,css}"
  - "packages/ui/**/*.{ts,tsx}"
  - "packages/tokens/**/*.css"
---

# Design system

La direction « Cahier du soir » (`docs/decisions.md`) : `packages/tokens/theme.css`, clair et
sombre, fonte Andika. La landing garde l'identité rejetée (`packages/tokens/landing.css`) jusqu'au
lot 4, qui lui donne `theme.css` et supprime `landing.css` ; le nom et le logo attendent aussi le
lot 4. Les composants ne dépendent de l'identité que par les tokens.

## Interdits

- Aucune nouvelle direction visuelle que Victor n'a pas validée.
- Aucun token ajouté au clair sans sa valeur sombre, ni à `landing.css`, gelé.
- Aucun « ami », sentiment ou souvenir personnel prêté à Tom dans un texte de l'interface.
- Aucune couleur, durée, rayon ou taille littérale dans un composant : une classe issue de
  `@repo/tokens`, ou un token ajouté à `theme.css`. Seule exception : les valeurs que Motion
  anime (`animate()` dans la landing), et l'état d'entrée qui les attend.
- Aucune paire de tokens associée sans son test de contraste
  (`packages/tokens/contrast.test.mjs`) : texte dans `PAIRS` à 4,5:1
  ([WCAG 2.2, 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)),
  bordure ou anneau de focus dans `CONTROL_PAIRS` à 3:1, dans chaque mode
  ([1.4.11](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html)).
- Aucune cible tactile sous 44 px, aucun défilement horizontal à largeur de téléphone, aucune
  animation qui ignore le mouvement réduit.
