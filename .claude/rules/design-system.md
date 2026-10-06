---
description: Design system — chargé uniquement sur les fichiers d'interface
paths:
  - "apps/landing/**/*.{ts,tsx,css}"
  - "apps/web/**/*.{ts,tsx,css}"
  - "packages/ui/**/*.{ts,tsx,css}"
  - "packages/tokens/**/*.css"
---

# Design system — règles d'application

L'identité visuelle actuelle (palette, polices, signes d'école de la landing) est rejetée :
elle se refait au lot 4 (`docs/roadmap.md`). D'ici là, aucune
nouvelle direction visuelle ; le client web du lot 3 se construit sur les tokens actuels, que
le lot 4 remplacera sans toucher aux composants. Les règles ci-dessous sont techniques et
survivent au changement d'identité.

- **Tokens uniquement** : aucune couleur, durée, rayon ou taille littérale
  dans composants et écrans — classes utilitaires issues de `@repo/tokens`
  (`bg-primary`, `duration-base`, `rounded-lg`…). Nouveau token = ajout dans
  `theme.css`.
- **Exceptions au « tokens uniquement »** : les valeurs que `motion` anime
  lui-même dans `style`, et les images `next/og` (`ImageResponse` ne lit que
  `style`, sans variables CSS). Rien d'autre.
- **Primitives interactives via `@repo/ui`** (bouton, champ, dialog, menu) : leur
  accessibilité y vit, on ne la refait pas dans une app.
- **Accessibilité** : contraste WCAG AA, 4,5:1 pour le texte courant
  ([WCAG 2.2, 1.4.3](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)),
  vérifié sur chaque paire de tokens qu'on associe (`packages/tokens/contrast.test.mjs`, une
  nouvelle paire s'ajoute à `PAIRS`) ; cibles tactiles d'au moins 44 px ; aucun défilement
  horizontal à largeur de téléphone ; mouvement réduit respecté ; contenu lisible sans
  JavaScript sur la landing. La suite e2e de la landing garde le reste
  (`.claude/rules/testing.md`).
