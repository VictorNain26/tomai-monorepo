# Plan — `refactor/server-documents`

Refonte du serveur, module `documents` (lot 0, `roadmap.md`, point 7), selon le rangement
de `architecture.md` (« Monolithe modulaire »). Chemins relatifs à `apps/server/src/`.
Comportement et URL inchangés : le contrat `@repo/api` ne bouge pas.

## Pré-vol (contre `main` après #349)

- Code du module (≈ 2 100 lignes) :
  - analyse : `services/document/` (analyse, extraction, prompts, types, OCR) ;
  - stockage : `services/storage/scaleway-storage.service.ts` (449 lignes, au-delà du seuil) ;
  - routes : `routes/file-upload.routes.ts` et `file-upload.helpers.ts` (`/api/upload`),
    `routes/api/session-files.routes.ts` (`/api/files`, `/api/chat/session/:id/files`) ;
  - fichiers d'un tour de chat : `services/chat/file-context.service.ts`,
    `file-multimodal.service.ts`, `file-context-types.ts`. Ils lisent le stockage, lancent
    l'analyse et écrivent dans `files` : ils relèvent de `documents`, le tuteur n'en
    consomme que le résultat ;
  - données : `db/schema/files.schema.ts` (`files`, `session_files`),
    `db/repositories/files.repository.ts`, `session-files.repository.ts`.
- Consommateurs hors module : `app.ts` et `routes/api/index.ts` (routes),
  `services/chat/chat-orchestration.service.ts` (`fileContextService`,
  `sessionFilesRepository.attach`), `services/chat/session-cleanup.ts` et
  `services/parent.service.ts` (suppression en stockage et en base), `db/schema.ts` et
  `db/schema/index.ts` (tables et relations).
- Code mort : `healthCheck` du stockage, `FileContextService.retrieveFileMetadata`,
  `filesRepository.findByStorageKey` et `softDelete`, `sessionFilesRepository.isAttached`.
- Premier module qui porte des tables. `drizzle.config.ts` lit `src/db/schema.ts`, qui
  réexportera la table du module : `drizzle-kit generate` doit répondre sans changement.
- Tests dont un `mock.module` vise un chemin déplacé (un chemin périmé ne lève aucune
  erreur, le mock cesse juste de s'appliquer) : `chat-session`, `parent-service`,
  `route-guards`, `chat-orchestration-finish-turn`, `document-analysis`,
  `integration-tests/api-endpoints` ; imports directs : `files-repository`,
  `storage-delete-files`, `live/structured-output`.

## Tâches

1. `git mv` vers `modules/documents/` :
   - `upload.routes.ts`, `upload.helpers.ts`, `session-files.routes.ts` ;
   - `storage.ts` (ex-`scaleway-storage.service.ts`) ;
   - `document-analysis.service.ts`, `document-extraction.service.ts`,
     `document-prompts.ts`, `document-types.ts`, `mistral-vision.ts` ;
   - `file-context.service.ts`, `file-multimodal.service.ts`, `file-context-types.ts` ;
   - `files.schema.ts`, `files.repository.ts`, `session-files.repository.ts`.
2. Revue des services et dépôts, sans changer le comportement :
   - code mort ci-dessus supprimé ; stockage exporté en fonctions, sans l'objet qui les
     doublait ;
   - `updateFileAnalysis` passe par `filesRepository.mergeEducationalContext` (fusion
     JSONB en SQL) au lieu d'un lire-modifier-écrire ; test ajouté ;
   - `session-files.routes.ts` importe ses dépôts statiquement (plus d'`import()` dynamique) ;
   - `services/document/index.ts` (barrel à lignes vides) disparaît au profit de l'index
     du module.
3. `modules/documents/index.ts`, seul point d'entrée des autres modules :
   `uploadRoutes`, `sessionFilesRoutes`, `fileContextService` et ses types de prompt,
   `filesRepository`, `sessionFilesRepository`, `deleteFile`, `deleteFiles`, tables.
   `app.ts` monte les deux routeurs (`/api/upload`, `/api`) ; `routes/api/index.ts` ne
   monte plus le classeur ; `db/schema.ts` et `db/schema/index.ts` importent la table du
   module ; `db/repositories/index.ts` n'exporte plus les dépôts de fichiers.
4. Tests : chemins de `mock.module` et d'import réécrits ; chaque mock vérifié actif.
5. Doc : ligne `documents` d'`architecture.md`, suivi, suppression du plan.

## Renvoyé

- Suppression d'un fichier (`DELETE /api/upload/file/:fileId`, `deleteSession`) : la ligne
  `files` est effacée même quand la suppression S3 échoue, ce qui laisse un objet d'élève
  orphelin. Correctif avec test, hors refonte : renvoyé au lot 3 dans le suivi.

## Validation

Typecheck, lint, tests unitaires et d'intégration, knip, `build:types`,
`drizzle-kit generate` sans changement, boot du serveur.
