---
description: Interdits marketing de la landing — affirmations, preuve sociale, RGPD des mineurs
paths:
  - "apps/landing/**"
---

# Marketing — ce qu'on ne dit pas, ce qu'on ne fait pas

Cadre edtech FR (familles, élèves mineurs, RGPD strict). Les défauts SEO, conversion et mesure d'audience de la réécriture du lot 4 : skill `landing-rewrite`.

## Règle qui prime : on n'affirme que ce qu'on peut prouver

Source : `docs/vision.md`, qui fixe aussi la promesse, la cible et le prix.

- **Chaque chiffre public a une source primaire datée** ; chaque différence revendiquée face à un concurrent est **mesurée** (harnais du lot 1, protocole publié) ; ce qui n'est pas construit ne se promet pas.
- **Pas de promesse de progrès scolaire ni de meilleures notes** : rien ne la mesure aujourd'hui. Pas de « le seul ».
- **Preuve sociale réelle uniquement** : témoignages de vraies familles, avec leur accord, et chiffres sourcés ou mesures publiées. Jamais de témoignage, d'avis, de logo ni de compteur d'utilisateurs inventé ou anticipé.
- Jamais une phrase de la landing qu'on ne peut adosser à une source ou à une mesure : elle se retire.
- **Jamais** : « conforme au cadre d'usage de l'IA du ministère », « agréé » ou « recommandé par l'Éducation nationale », « aligné sur les programmes » sans la métrique publiée, « fait les devoirs » (`docs/etudes/2026-10-01/education-nationale.md`, c).

## RGPD / consentement (EU, mineurs)

- **Jamais de dark pattern sur un bandeau cookies** : « Refuser » jamais moins visible que « Accepter » (même taille, même graisse), jamais un cookie non essentiel avant le consentement ni après son retrait. ([CNIL — dark patterns, déc. 2024](https://www.cnil.fr/en/dark-patterns-cookie-banners-cnil-issues-formal-notice-website-publishers))
- **Jamais, sous 15 ans, un traitement fondé sur le consentement sans le double consentement conjoint de l'enfant et du parent** (majorité numérique française à 15 ans). ([CNIL — recommandation 4](https://www.cnil.fr/fr/recommandation-4-rechercher-le-consentement-dun-parent-pour-les-mineurs-de-moins-de-15-ans))
- **Jamais un compte élève public ni partagé avec un tiers par défaut**, et **jamais de publicité comportementale ciblant un mineur**, même avec l'accord du parent. ([CNIL — droits numériques des mineurs](https://www.cnil.fr/fr/enjeux-numeriques/les-droits-numeriques-des-mineurs))
- **Jamais le même pavé juridique pour un parent et pour un élève de 12 ans** : l'information s'adapte à l'âge. ([CNIL — recommandation 6](https://www.cnil.fr/fr/recommandation-6-renforcer-linformation-et-les-droits-des-mineurs-par-le-design))
