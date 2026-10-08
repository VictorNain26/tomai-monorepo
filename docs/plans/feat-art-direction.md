# Plan — La direction artistique « Cahier du soir »

## Problème

L'identité actuelle est rejetée (`decisions.md`) ; les écrans de séance, d'accueil et de résumé du
lot 3 attendent leurs fondations pour ne pas être refaits deux fois. Trois directions ont été
essayées sur les vrais écrans le 2026-10-08 ; Victor a délégué le choix (« je te laisse faire les
choix d'après tes analyses »).

## Choix

- **A, « Cahier du soir »** : un écran de lecture calme, un seul accent (le bleu du pull de Tom),
  un sombre qui suit le réglage du téléphone. Sert un élève de 6e comme de 3e, et le parent.
  B jouait la relation (« ta loutre des devoirs »), contre l'étude sur l'accompagnement à l'IA ;
  C imposait le sombre à tous et un jaune qui se lit comme un avertissement.
- **Fonte Andika** (SIL, conçue pour l'apprentissage de la lecture) au lieu d'Atkinson Hyperlegible
  Next, qui barre son zéro sans variante (« 2Ø » en maths) : zéro plein, 1, l et I distincts, « a »
  de l'écriture scolaire.
- **Tom** : sa tête à côté de chacun de ses messages, une ligne « Tom est une IA » en tête de
  séance ; il ne se dit jamais ami (décision du 2026-10-08).
- **La landing garde son identité jusqu'au lot 4** : ses tokens actuels passent dans
  `@repo/tokens/landing.css`, testés comme les autres, supprimés au lot 4. La tête de Tom passe
  dans `@repo/ui`, partagée.

## Critères d'acceptation

- [ ] `contrast.test.mjs` vérifie le clair, le sombre et la landing, anneau de focus compris.
- [ ] Le web en Andika, clair et sombre ; la landing inchangée à l'œil (e2e landing vert).
- [ ] `decisions.md`, `.claude/rules/design-system.md`, `suivi.md` et `roadmap.md` à jour.

## Hors périmètre

La structure de la séance (champ fixé en bas, rendu des maths, attente, marque IA près du
champ) : étape 2. Le bouton désactivé à 50 % d'opacité. Le nom et le logo (lot 4).

## Vérification de bout en bout

Typecheck, lint, tests ; la séance et l'accueil élève vus dans Chrome à 390 px, clair et sombre.

## Décision humaine

Choix délégué par Victor le 2026-10-08.
