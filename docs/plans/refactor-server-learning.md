# Plan — `refactor/server-learning`

Refonte du serveur, module `learning` (lot 0, `roadmap.md`, point 7), selon le rangement
de `architecture.md` (« Monolithe modulaire »). Chemins relatifs à `apps/server/src/`.
Comportement et URL inchangés : le contrat `@repo/api` ne bouge pas.

## Pré-vol (contre `main` après #350)

- Code du module (≈ 3 400 lignes) :
  - routes : `routes/learning/` (six routeurs, `helpers.ts`, `index.ts`), montées sous
    `/api/learning` ;
  - services : `services/learning/` (service des decks, génération de cartes, validation,
    erreurs, types, `prompts/`), `services/fsrs.service.ts`, `services/fsrs-types.ts`,
    `config/learning-config.ts` (réglages par niveau) ;
  - schémas de génération : `lib/ai/schemas/` (`cards.schema.ts`, `cards-domain.schema.ts`
    et un barrel). `architecture.md` les range dans `tutor`, mais seule la génération de
    cartes s'en sert : ils vont dans `learning` ;
  - données : `learning_decks` et `learning_cards` dans
    `db/schema/learning-tools.schema.ts`, `db/repositories/learning-decks.repository.ts`,
    `learning-cards.repository.ts`.
- Le même fichier de schéma porte `student_cognitive_profiles`, qui relève de `tutor`
  (`cognitive-profile.service.ts`) : la table reste dans `db/schema/`, dans un fichier
  renommé `cognitive-profile.schema.ts`, jusqu'à la PR `tutor`.
- Consommateurs hors module :
  - `app.ts` monte les routes ;
  - `services/chat/tool-executor.ts` appelle `generateCards`, `learningService` et
    `getLevelConfig` ;
  - `services/chat/mistral-helpers.ts` (`getLearningContext`) interroge directement
    `learning_cards` et `learning_decks` ;
  - `db/schema.ts` et `db/schema/index.ts` (tables, relations) ;
  - `scripts/seed-dev.ts` (insère un deck).
- Code mort : `fsrsService.resetCard`, `learningCardsRepository.deleteByDeckId`,
  `services/learning/index.ts` et `lib/ai/schemas/index.ts` (barrels à lignes vides).
- `drizzle-kit generate` doit répondre sans changement.
- Tests dont un `mock.module` ou un import vise un chemin déplacé : `learning.service`,
  `fsrs`, `card-generator`, `route-guards`, `tool-executor`, `tool-executor-profile`,
  `chat-orchestration-finish-turn` (`mistral-helpers`), `integration-tests/api-endpoints`,
  `live/structured-output`.

## Tâches

1. `git mv` vers `modules/learning/` :
   - routes : `deck.routes.ts`, `deck-discovery.routes.ts`, `card.routes.ts`,
     `card-generate.routes.ts`, `fsrs.routes.ts`, `fsrs-extra.routes.ts`,
     `routes.helpers.ts` (ex-`helpers.ts`), `learning.routes.ts` (ex-`index.ts`, qui monte
     les six routeurs) ;
   - services : `learning.service.ts`, `learning-errors.ts`, `card-generator.service.ts`,
     `card-validation.ts`, `card-generation.types.ts` (ex-`types.ts`), `prompts/`,
     `fsrs.service.ts`, `fsrs-types.ts`, `learning-config.ts` ;
   - schémas de génération : `cards.schema.ts`, `cards-domain.schema.ts` ;
   - données : `learning.schema.ts` (decks, cartes, enums, relations et types de ces
     tables), `learning-decks.repository.ts`, `learning-cards.repository.ts`.
2. Revue, sans changer le comportement :
   - code mort ci-dessus supprimé, tests compris ;
   - les deux requêtes de `getLearningContext` passent dans
     `learningCardsRepository.getReviewSignals(userId)` (cartes dues, matières aux
     erreurs) ; le tuteur garde la mise en forme du texte. Test du dépôt ajouté.
3. `modules/learning/index.ts`, seul point d'entrée des autres modules : `learningRoutes`,
   `learningService`, `generateCards` et son type de résultat, `getLevelConfig`,
   `getReviewSignals`. `app.ts`, `tool-executor.ts` et `mistral-helpers.ts` passent par
   lui ; `db/schema.ts` et `db/schema/index.ts` importent `learning.schema.ts` (exception
   notée dans `architecture.md`) ; `seed-dev.ts` passe par `db/schema`.
4. Tests : chemins de `mock.module` et d'import réécrits, chacun vérifié contre un
   fichier existant.
5. Doc : lignes `learning` et `tutor` d'`architecture.md`, chemin de `cards-domain.schema.ts`
   dans le suivi, suivi, suppression du plan.

## Renvoyé

- Trois définitions des types de cartes coexistent : l'enum `card_type`, les types de
  `services/learning/types.ts` et les schémas Zod de `cards.schema.ts`. Les unifier touche
  le schéma de génération : renvoyé au point « Cartes » du lot 2, qui le revoit déjà pour
  le mode strict.
- `eslint-disable` des dépôts learning : PR « lint strict », comme prévu au suivi.

## Validation

Typecheck, lint, tests unitaires et d'intégration, knip, `build`, `build:types`,
`drizzle-kit generate` sans changement, boot du serveur et sonde des routes
`/api/learning`.
