# Plan — `chore/strict-lint`

Dernière PR du lot 0 (`roadmap.md`, point 8) : lint strict sur le code refondu, plus aucun
`eslint-disable`. Critère du lot : `rg eslint-disable apps packages` vide.

## Pré-vol (contre `main` après #354)

- Trois configurations :
  - `packages/eslint-config` (`base`, `next-js`, `react-internal`) pour la landing et
    `@repo/ui` : `recommended` non typé, plus `eslint-plugin-only-warn`, qui rétrograde
    toute erreur en avertissement ;
  - `apps/server/eslint.config.mjs`, configuration à part, hors du paquet partagé, avec
    les règles `no-unsafe-*` coupées. `src/scripts/` est exclu du lint ;
  - le script `lint` du serveur n'a pas `--max-warnings 0` (seul `lint:ci` l'a), alors que
    lefthook et turbo appellent `lint` : un avertissement ne bloque rien.
- Cinq `eslint-disable`, tous dans le serveur : `learning-decks.repository.ts`,
  `learning-cards.repository.ts` (`any` du type de transaction), `lib/education-levels.ts`,
  `scripts/seed-dev.ts`, `modules/tutor/chat-message.routes.ts` (`no-control-regex` de
  `sanitizePrompt`).
- Mesure avec `strictTypeChecked` + `stylisticTypeChecked`, `noInlineConfig`,
  `reportUnusedDisableDirectives: 'error'` :
  - serveur, code de production : 242 violations. Les plus fréquentes :
    `no-unnecessary-condition` 91, `restrict-template-expressions` 25, `no-deprecated` 25,
    `dot-notation` 22, `array-type` 15, `no-unnecessary-type-assertion` 9,
    `consistent-type-definitions` 9, `prefer-optional-chain` 8, `no-explicit-any` 7 ;
  - serveur, tests : 723, dont 255 `require-await` et 189 `no-floating-promises` venus du
    DSL de `bun:test` (fabriques `mock(async () => …)`, `mock.module` non attendu) ;
  - landing : 48 (`restrict-template-expressions` 17, `no-unnecessary-condition` 12,
    `dot-notation` 11…) ; `@repo/ui` : 0.
- Sources : typescript-eslint, « Typed Linting » (`strictTypeChecked`,
  `stylisticTypeChecked`, `parserOptions.projectService`) ; ESLint 10, « Configure Rules »
  (`linterOptions.noInlineConfig`, `linterOptions.reportUnusedDisableDirectives`).

## Tâches

1. **Configuration partagée** (`packages/eslint-config/base.js`) : `strictTypeChecked` et
   `stylisticTypeChecked`, `projectService`, `noInlineConfig`,
   `reportUnusedDisableDirectives: 'error'` ; `only-warn` retiré du paquet et de ses
   dépendances. Une entrée `node` pour le serveur, qui reprend ses globales (Bun) et sa
   règle `no-restricted-syntax` ; `apps/server/eslint.config.mjs` ne fait plus que
   l'importer, et ses dépendances ESLint directes passent par `@repo/eslint-config`.
2. **Tests** : une entrée de configuration pour `*.test.ts` coupe `require-await`,
   `no-floating-promises` et les règles `no-unsafe-*` que le DSL de `bun:test` déclenche
   par construction ; le reste du strict s'y applique. Pas de commentaire inline.
3. **Scripts** : `lint` partout avec `--max-warnings 0` ; `src/scripts/` entre dans le lint.
4. **Corrections**, par famille de règle, un commit chacune : d'abord les corrections
   automatiques (`--fix` : `dot-notation`, `array-type`, `consistent-type-definitions`,
   `no-unnecessary-type-assertion`…), relues ; puis les corrections manuelles. Chaque
   `eslint-disable` est remplacé par une forme qui ne déclenche pas la règle :
   - transaction Drizzle typée par `Parameters` du callback de `db.transaction`, sans
     `any` ;
   - `sanitizePrompt` sans littéral de contrôle dans la regex (classe construite par
     échappement Unicode `\u{…}` avec le drapeau `u`, ou filtrage par code de caractère).
   Une option de règle ne s'assouplit que si la doc la justifie, avec la raison dans la
   configuration.
5. Doc : suivi (lot 0 terminé), roadmap si un critère change, suppression du plan.

## Validation

`rg eslint-disable apps packages` vide (hors `node_modules`) ; `bun run lint` à exit 0 sur
chaque espace ; typecheck, tests unitaires et d'intégration, knip, `build`, `build:types` ;
build de la landing. Aucun comportement ne change : les tests existants passent sans
modification d'assertion.
