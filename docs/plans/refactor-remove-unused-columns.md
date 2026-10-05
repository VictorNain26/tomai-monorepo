# Plan — refactor/remove-unused-columns

Nettoyage demandé par Victor le 2026-10-06, deuxième de trois PR : colonnes et tables que rien
n'écrit ou que rien ne lit, et les champs de tableau de bord qui n'en renvoient que des zéros.
Relevé : recherche de chaque colonne dans `apps/server/src` et `packages/`, hors schémas et
tests (2026-10-06). Chemins relatifs à `apps/server/src/`.

## Ce qui part

- `study_sessions` : `duration_minutes`, `frustration_avg`, `frustration_min`,
  `frustration_max`, `question_levels_avg`, `concepts_covered`, `socratic_effectiveness`,
  `student_engagement`, `questions_asked`, `questions_answered`, `hints_given`,
  `ai_model_used` (toujours vide), `total_tokens_used`, `api_cost_cents`,
  `average_response_time_ms`, `device_type`, `user_satisfaction`, `session_rating`,
  `session_metadata`. Rien ne les écrit ; les lectures ne rendent que 0 ou null.
- `messages` : `content_hash`, `socratic_level`, `message_category`, `message_quality_score`
  et son index, `is_helpful`, `contains_pii`, `is_flagged` (jamais touchés) ;
  `frustration_level`, `question_level` (écrits à null seulement).
- `user` : `login_count`, `last_login_at`, `country_code`, `timezone`, `metadata`,
  `preferences` (défaut de l'ancienne application mobile) ; `banned`, `ban_reason`,
  `ban_expires`, et `session.impersonated_by`, champs du plugin admin de Better Auth, qui n'est
  pas activé (`platform/auth/auth.ts`).
- Tables `parent_restore_token` (Quick Switch du mobile, sans lecteur ni écrivain) et
  `progress` (jamais écrite), son dépôt et `/progress/dashboard`, qui ne rendait qu'un nombre
  de séances et des zéros ; un tableau de statistiques de l'élève n'est pas dans la vision.
- `files.storage_bucket`, `files.storage_region` : écrits, jamais lus.
- Tableau de bord du parent : `avgSessionDuration`, `totalStudyTime`, `avgFrustration`,
  toujours à 0. Restent les séances, les jours d'étude, les matières et la dernière séance ;
  le résumé de la semaine s'y ajoute au lot 3.

## Hors périmètre

- Valeurs d'enum sans usage (`user_role` `admin`, `deck_source` `rag_program`) : Postgres ne
  retire une valeur qu'en recréant le type ; elles partent avec la migration de base de la
  troisième PR, avec le rôle `admin` de `packages/api`.
- Tables d'abonnement (`family_billing`, colonnes de `subscription_plans` et
  `user_subscriptions`) : le quota en dépend, il se refait au point 8.

## Validation

`bun run typecheck`, `bun run lint`, `bunx knip`, `bun run test`, `db:check`,
`bun run test:integration`.
