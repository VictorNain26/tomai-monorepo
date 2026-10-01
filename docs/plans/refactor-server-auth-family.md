# Plan — `refactor/server-auth-family`

Refonte du serveur, modules `auth` et `family` (lot 0, `roadmap.md`, point 7), selon le
rangement de `architecture.md` (« Monolithe modulaire »). Chemins relatifs à
`apps/server/src/`. URL inchangées ; le contrat `@repo/api` ne bouge pas.

## Pré-vol (contre `main` après #352)

- Code concerné (≈ 1 500 lignes) : `routes/api/parent.routes.ts`, `progress.routes.ts`,
  `student.routes.ts`, `services/parent.service.ts`, `services/parent/`,
  `services/progress.service.ts`, `schemas/validation.ts`, `db/schema/auth.schema.ts`,
  dépôts `users`, `parent-child`, `progress`.
- Moteur d'authentification : `platform/auth/auth.ts` lit `user`, `session`, `account`,
  `verification` par `db/schema`, le point de composition. Les tables peuvent donc aller
  dans `modules/auth/` sans que `platform` importe un module.
- Code mort, joignable seulement par des tests :
  - `ParentService` : `getParentStudentProgress`, `getStudentSessions`,
    `getSessionMessages`, `getParentStatistics`, `isParentOf`, et leurs pendants de
    `ParentDashboardService`. `getSessionMessages` renvoyait le texte complet des séances
    d'un enfant : sa suppression solde le point « Tableau de bord parent » du lot 3 ;
  - `ProgressService` : tout sauf `getStudentStats` ;
  - `progressRepository` : `create`, `findByUserId`, `findByUserIdAndSubject`,
    `findByUserSubjectConcept`, `upsertProgress`, `deleteById` ;
  - `parentChildRepository` : `getChildIds`, `getParentIds`, `unlink`.
- Aucun code n'écrit la table `progress` (seules les méthodes mortes le faisaient) :
  `conceptsLearned` de `/api/progress/dashboard` vaut toujours 0. `parent_restore_token`
  (bascule rapide du mobile) n'est lue ni écrite nulle part. Les supprimer demande une
  migration et une décision sur le tableau de bord : renvoyé au lot 3.
- Le tableau de bord parent (`ParentDashboardService`) et la progression de l'élève
  (`ProgressService.getStudentStats`) recalculent chacun des statistiques sur
  `study_sessions` par requêtes directes (#352, « Reporté »).
- `/api/student/memory` édite les profils par matière du tuteur, et
  `/api/progress/dashboard` affiche les statistiques de séance de l'élève : ces deux routes
  relèvent de `tutor`.
- Le test d'intégration de connexion par identifiant supprime le parent en fin de test,
  mais pas l'enfant : la cascade ne retire que le lien `parent_child`.

## Tâches

1. **`modules/auth/`** : `auth.schema.ts` (`user`, `session`, `account`, `verification`,
   `parent_restore_token`, enums, relations), `users.repository.ts`, et `accounts.ts`, qui
   reprend de `ParentService` la création d'un compte élève par better-auth
   (`createStudentAccount`) et le changement de mot de passe (`setPassword`). Index :
   `usersRepository`, `createStudentAccount`, `setPassword`.
2. **`modules/family/`** : `family.schema.ts` (`parent_child`, relations),
   `parent-child.repository.ts` (reçoit `findChildrenByParentId` et
   `findAllChildrenByParentId` de `usersRepository`), `parent.service.ts`,
   `parent-dashboard.service.ts`, `parent-types.ts`, `parent.routes.ts`,
   `parent.validation.ts` (ex-`schemas/validation.ts`). Index : `parentRoutes`,
   `parentChildRepository`.
3. **`tutor`** reçoit `student.routes.ts`, `progress.routes.ts` et une fonction
   `getStudyStats(userId)` (séances, minutes, frustration, matières, dernière séance, jours
   d'étude, séances sur 7 et 30 jours), portée par `studySessionsRepository`. Le tableau
   de bord parent l'appelle pour chaque enfant au lieu d'interroger `study_sessions`.
   `progress.service.ts` disparaît ; `subjectProfileService` et `STUDENT_SUBJECTS` sortent
   de l'index du tuteur.
4. Code mort ci-dessus supprimé, tests compris. Dépôt `progress` réduit à
   `getProgressSummary`, laissé dans `db/` jusqu'à la décision du lot 3.
5. Consommateurs : `app.ts`, `routes/api/index.ts` (ne garde que santé et niveaux),
   `subscription.service.ts`, `routes/subscription/status.routes.ts`,
   `modules/tutor/chat-session.service.ts`, `scripts/seed-dev.ts`.
6. Tests : chemins réécrits par script, mocks vérifiés ; test de `getStudyStats` contre
   Postgres ; le test d'intégration de connexion couvre `createStudentAccount`, gagne un cas
   `setPassword` et supprime aussi l'enfant en fin de test.
7. Doc : lignes `auth`, `family`, `tutor` d'`architecture.md`, suivi (point lot 3 soldé,
   nouveaux points renvoyés), suppression du plan.

## Validation

Typecheck, lint, tests unitaires et d'intégration, knip, `build`, `build:types`,
`drizzle-kit generate` sans changement, boot et sonde de `/api/parent/*`,
`/api/progress/dashboard`, `/api/student/memory`, `/api/auth/*`.
