# Plan — `refactor/server-tutor`

Refonte du serveur, module `tutor` (lot 0, `roadmap.md`, point 7), selon le rangement de
`architecture.md` (« Monolithe modulaire »). Chemins relatifs à `apps/server/src/`.
Comportement et URL inchangés : le contrat `@repo/api` ne bouge pas.

## Pré-vol (contre `main` après #351)

- Code du module (≈ 5 200 lignes, le plus gros de la refonte) :
  - routes : `routes/chat-message.routes.ts` (`/api/chat`), `routes/api/chat-session.routes.ts`
    (monté sous `/api` par `routes/api/index.ts`) ;
  - services : `services/chat/` (18 fichiers), `episodic-memory.service.ts`,
    `cognitive-profile.service.ts`, `mistral-embeddings.service.ts`,
    `lib/ai/mistral-reasoning.ts`, `utils/conversation/` ;
  - prompts et aide : `config/prompts/` (prompt système, adaptation par matière et niveau),
    `config/app-guide/` (outil `get_app_help`) ;
  - purge RGPD : `services/retention-purge.service.ts` ne purge que des tables du tuteur
    (`session_episodes`, `student_subject_profile`). `architecture.md` la range dans
    `platform`, qui n'importe aucun module : elle va dans `tutor`, et `src/index.ts` démarre
    le job comme il démarre ceux des modules ;
  - données : `study_sessions`, `messages`, `session_episodes`, `student_subject_profile`
    (`db/schema/learning.schema.ts`), `student_cognitive_profiles`
    (`db/schema/cognitive-profile.schema.ts`), dépôts `study-sessions`, `messages`,
    `episodic-memory`, `student-subject-profile`.
- Restent hors du module : `progress` (famille) et `cost_tracking` (facturation), qui
  partagent aujourd'hui `db/schema/learning.schema.ts`. Ils passent dans
  `db/schema/progress.schema.ts` et `db/schema/cost-tracking.schema.ts` jusqu'aux PR
  `family` et `billing`. `shared/pedagogy/` reste partagé : les prompts de `learning`
  s'en servent aussi.
- Cycle à éviter : `tutor` utilise `documents` (fichiers d'un tour), et
  `modules/documents/session-files.routes.ts` lit `studySessionsRepository` pour vérifier
  la propriété de la séance. Les trois routes `/api/chat/session/:id/files` vont donc dans
  `tutor`, qui appelle `documents` par son index ; `documents` ne garde que
  `GET /api/files`, dans `files.routes.ts`.
- Consommateurs hors module : `app.ts` (routes, types `TomChatMessage`, `TomDataParts`,
  `DeckCreatedData` du contrat client), `src/index.ts` (purge), `routes/api/student.routes.ts`
  (`subjectProfileService`, `STUDENT_SUBJECTS`), `services/progress.service.ts` et
  `services/parent/parent-dashboard.service.ts` (dépôts de séances et de messages, requêtes
  directes sur `study_sessions` et `messages`), `modules/documents/files.schema.ts` (clé
  étrangère vers `study_sessions`), `db/schema.ts`, `db/schema/index.ts`.
- Clés étrangères entre modules : un `*.schema.ts` de module importe directement le
  `*.schema.ts` dont il référence la table, comme `db/schema` le fait déjà (exception notée
  dans `architecture.md`, à étendre).
- `drizzle-kit generate` doit répondre sans changement.
- Code mort : aucune méthode sans appelant ; le barrel `utils/conversation/index.ts`
  disparaît.
- Une trentaine de tests importent ou mockent un chemin déplacé : la réécriture des
  chemins passe par un script qui résout chaque import relatif et le recalcule depuis le
  nouvel emplacement. Les mocks de `db/repositories` qui mélangent dépôts d'utilisateurs
  et de séances se scindent à la main.

## Tâches

1. `git mv` vers `modules/tutor/`, à plat sauf `prompts/` et `app-guide/` :
   - routes : `chat-message.routes.ts`, `chat-session.routes.ts`,
     `session-files.routes.ts` (les trois routes de séance venues de `documents`) ;
   - services : tout `services/chat/`, `episodic-memory.service.ts`,
     `cognitive-profile.service.ts`, `mistral-embeddings.service.ts`,
     `mistral-reasoning.ts`, `conversation-optimizer.ts` et
     `conversation-optimizer.types.ts`, `retention-purge.service.ts` ;
   - `prompts/` (ex-`config/prompts/`), `app-guide/` (ex-`config/app-guide/`) ;
   - données : `session.schema.ts` (séances, messages, épisodes, profils par matière,
     leurs enums, relations et types), `cognitive-profile.schema.ts`, les quatre dépôts.
2. `modules/tutor/index.ts`, seul point d'entrée : `chatMessageRoutes`,
   `chatSessionRoutes`, `sessionFilesRoutes`, `startRetentionPurgeScheduler`,
   `subjectProfileService`, `STUDENT_SUBJECTS`, `studySessionsRepository`,
   `messagesRepository`, les types du contrat client. `progress.service.ts` et
   `parent-dashboard.service.ts` passent par lui pour les dépôts ; leurs requêtes directes
   sur les tables du tuteur sont renvoyées à la PR `family`.
3. `db/schema.ts` et `db/schema/index.ts` importent les schémas du module ;
   `db/repositories/index.ts` n'exporte plus que les dépôts hors tuteur.
4. Tests : chemins réécrits par le script, mocks mixtes scindés à la main, chaque
   `mock.module` vérifié contre un fichier existant.
5. Doc : lignes `tutor`, `documents` et `platform` d'`architecture.md`, exception des clés
   étrangères, chemins du suivi (`chat-tools.ts`, `summarization.service.ts`,
   `finishTurn`, `app-guide-data.ts`), suivi, suppression du plan.

## Renvoyé

- `progress.service.ts` et `parent-dashboard.service.ts` interrogent directement
  `study_sessions` et `messages` : à faire passer par l'index du tuteur dans la PR
  `family`, qui supprime aussi `getSessionMessages` (suivi, lot 3).
- Défauts de coût et de résumé du tuteur : lot 2, comme au suivi.

## Validation

Typecheck, lint, tests unitaires et d'intégration, knip, `build`, `build:types`,
`drizzle-kit generate` sans changement, boot du serveur, sonde de `/api/chat`,
`/api/chat/sessions` et `/api/chat/session/:id/files`.
