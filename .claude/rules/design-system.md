---
description: Design system — chargé uniquement sur les fichiers d'interface
paths:
  - "apps/landing/**/*.{ts,tsx,css}"
  - "packages/ui/**/*.{ts,tsx,css}"
  - "packages/tokens/**/*.css"
---

# Design system — règles d'application

- **Tokens uniquement** : aucune couleur, durée, rayon ou taille littérale
  dans composants et écrans — classes utilitaires issues de `@repo/tokens`
  (`bg-primary`, `duration-base`, `rounded-lg`…). Nouveau token = ajout dans
  `theme.css`.
- **Thème clair seul** : pas de mode sombre ni de bascule de thème.
- **Papier** : fond `background` crème, objets posés en `card` ; pas de bande de
  fond pleine largeur. Jamais `annotation` sur `highlight` (4,48:1).
- **Registres** : landing/parent = sobre ; élève = vivant (micro-motion) sans
  infantiliser.
- **Typo** : Nunito titres et corps, Caveat notes manuscrites ; pas de police à chasse
  fixe en V1.
- **Exceptions au « tokens uniquement »** : les valeurs que `motion` anime
  lui-même dans `style`, et les images `next/og` (`ImageResponse` ne lit que
  `style`, sans variables CSS). Rien d'autre.
