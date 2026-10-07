# Plan — l'appareil partagé de la famille (étape 6)

Pré-vol (2026-10-07) : le premier test complet dans Chrome a montré qu'un appareil relié à un
élève refuse la connexion du parent (`studentAuthGuard` ne laisse à un élève que quelques routes de
better-auth), que l'écran n'en dit qu'un message générique, et que l'élève n'a aucun moyen de se
déconnecter. Or un collégien partage souvent l'appareil familial (`etudes/2026-10-07/foyer-eleve-age.md`).

## Critères d'acceptation

- [ ] `/connexion` sur un appareil relié à un élève dit à qui il est relié, et propose de l'en
      déconnecter avant de se connecter en parent ; le garde du serveur reste tel quel.
- [ ] L'accueil de l'élève a « Me déconnecter de cet appareil », qui prévient qu'il faudra un
      nouveau code ; l'appareil disparaît alors de la liste du parent.
- [ ] Prouvé à largeur de téléphone, WebKit et Chromium.

## Vérification de bout en bout

`bun run typecheck && bun run lint && bun run test`, la suite Playwright du web.

## Décision humaine

Étape 6 sur les composants de base, sans travail de style : Victor, 2026-10-07.
