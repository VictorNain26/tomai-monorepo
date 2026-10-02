# Plan — `chore/strict-typescript`

Lot 0, point 9 de `roadmap.md` (demandé par Victor le 2026-10-02) : configuration
TypeScript stricte. Après #355, `tsconfig.base.json` porte `strict` et toutes les options
du profil `@tsconfig/strictest` sauf deux : `exactOptionalPropertyTypes` et
`noPropertyAccessFromIndexSignature`. Comportement inchangé.

## Pré-vol (contre `main` après #355)

- Erreurs avec les deux options, par espace : serveur 223, landing 12, `@repo/api` 11,
  `@repo/ui` 0. Dont 197 TS4111 (`noPropertyAccessFromIndexSignature`) : propriété lue par
  point sur une signature d'index, à lire par crochets (`process.env['X']`,
  `Record<string, …>`). Les autres viennent d'`exactOptionalPropertyTypes` : `undefined`
  passé explicitement à une propriété optionnelle.
- `dot-notation` de typescript-eslint laisse les crochets sur une signature d'index quand
  `noPropertyAccessFromIndexSignature` est actif : pas de conflit avec le lint strict.
- Sources : https://www.typescriptlang.org/tsconfig/#exactOptionalPropertyTypes,
  https://www.typescriptlang.org/tsconfig/#noPropertyAccessFromIndexSignature,
  typescript-eslint, règle `dot-notation`.

## Tâches

1. Activer les deux options dans `tsconfig.base.json`.
2. TS4111 : réécriture mécanique `obj.cle` → `obj['cle']` aux positions données par `tsc`,
   par script, relue.
3. `exactOptionalPropertyTypes`, au cas par cas : quand `undefined` est une valeur voulue,
   la propriété le déclare (`?: T | undefined`) ; sinon on n'écrit pas la clé (spread
   conditionnel). Aucun cast.
4. Validation : typecheck, lint, tests unitaires et d'intégration, knip, `build`,
   `build:types`, build de la landing et de l'image Docker.
5. Doc : suivi (lot 0 terminé), roadmap, suppression du plan.
