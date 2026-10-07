# Plan — la mémoire d'apprentissage, les écrans (PR M2)

Pré-vol (2026-10-07) : le serveur est fait sur la branche `feat/learner-memory` (M1, en cascade) :
l'accord sur le profil, `PATCH /api/household/students/:id { memoryProposed }`, `/api/memory` pour
l'élève. Le web a le foyer, le jumelage et le chat (#439, #441).

## Critères d'acceptation

- [ ] Le parent propose la mémoire à l'ajout de l'enfant (une case), la propose ou la retire ensuite
      sur la page de l'enfant, et y voit son état ; à partir de 15 ans, la page dit que l'enfant
      décide seul.
- [ ] L'élève à qui elle est proposée voit sur son accueil ce que Tom retiendrait, et répond oui ou
      non ; `/memoire` montre ce que Tom retient, notion par notion, « J'ai compris » par notion,
      « Tout effacer » et « Arrêter ».
- [ ] Une case native dans `@repo/ui` (aucune dépendance) : jamais une primitive refaite dans le web.
- [ ] Prouvé à largeur de téléphone, WebKit et Chromium.

## Vérification de bout en bout

`bun run typecheck && bun run lint && bun run test`, la suite Playwright du web.

## Décision humaine

Les quatre décisions de l'étude : Victor, 2026-10-07.
