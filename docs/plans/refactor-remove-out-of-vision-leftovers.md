# Plan — refactor/remove-out-of-vision-leftovers

Nettoyage demandé par Victor le 2026-10-06, troisième de trois PR : ce qui sert un public hors
vision (primaire, lycée), les routes sans client, et une migration de base unique. La migration
recrée la base locale : accord de Victor le 2026-10-06. Chemins relatifs à `apps/server/src/`.

## Pré-vol (2026-10-06, contre `main` à `210471c8`)

- L'inventaire de `docs/suivi.md` est confirmé fichier par fichier. S'y ajoutent : une
  quatrième liste de matières (`subjectLabels` de `modules/learning/routes.helpers.ts`), le
  `SUBJECT_MAPPING` des fiches et le `normalizeSubject` du tuteur, que `docs/agent.md` (§ 4,
  « Une seule taxonomie ») range déjà dans la cible ; `config/education/` et
  `services/education.service.ts`, restes de l'ancienne structure.
- Les listes ne s'accordent pas : `COLLEGE_SUBJECTS` sert `physique_chimie` et `histoire_geo`,
  que le chat ignore (il ne garde que les familles de `STUDENT_SUBJECTS`) ; `SUBJECT_SLUGS`
  sépare `histoire` et `geographie` et n'a pas `italien`.
- Arbitrage : les niveaux du primaire et du lycée partent ici, et non au lot 3 comme le
  prévoyait le suivi. Postgres ne retire une valeur d'enum qu'en recréant le type ; la
  migration de base de cette PR le fait sans coût, plus tard il faudrait une migration de
  plus. Sans client, l'inscription n'a rien à garder.
- Les migrations ne contiennent aucun SQL écrit à la main (ni `INSERT`, ni fonction, ni
  trigger) : la base se régénère entière par `drizzle-kit generate` (0.31.11).
- Image Postgres : `postgres:18.6`, dernière 18 publiée sur Docker Hub le 2026-10-06, même
  base Debian que l'image pgvector actuelle.

## Tâches

1. **Niveaux** : `EDUCATION_LEVELS` (`lib/education-levels.ts`) réduit à la 6e, la 5e, la 4e
   et la 3e, avec leurs libellés (ceux de `config/education/education-mapping.ts`, qui part) ;
   `isCollegeLevel` disparaît, l'enum de validation suffit. `CollegeLevel` du référentiel
   devient `EducationLevelType`. Tables par niveau réduites : `learning-config.ts`, cycles des
   fiches (`EducationCycle` = `cycle3` | `cycle4`), raisonnement réservé à la 4e et la 3e
   (`mistral-reasoning.ts`). Repli `'seconde'` de `modules/documents/upload.helpers.ts`
   retiré. Tests : niveaux hors collège refusés à la validation de l'inscription d'un enfant
   et du chat.
2. **Matières** : une seule taxonomie dans `lib/subjects.ts` — dix slugs du collège
   (`histoire-geo` fusionné, `italien` ajouté), chacun avec son libellé et sa famille ; les
   familles de l'analyse du tour, `general` compris. Remplace `STUDENT_SUBJECTS`,
   `COLLEGE_SUBJECTS`, `subjectLabels`, `SUBJECT_MAPPING` (et la catégorie `autre`),
   `normalizeSubject`, le `'général'` accentué. Le slug se valide aux frontières : corps du
   chat (`subject`), création de paquet et génération de cartes ; la séance garde une famille.
   Les exercices du jeu en `histoire` passent en `histoire-geo`. Tests : correspondance slug
   → famille, matière inconnue refusée par les routes, bloc de consignes de chaque famille.
3. **Routes** : retirées, `GET /api/tts/voices`, `GET /learning/config` et `GET /health/ai`
   avec leurs tests ; `services/education.service.ts` remplacé par la lecture directe des
   listes (`GET /api/education/levels` rend les niveaux et leur libellé, `GET
   /learning/subjects` les matières, sans paramètre de niveau).
4. **Morceaux morts** : `currentMessageMaxTokens` (`token-budget.service.ts`), la référence à
   `docs/AUDIT_LEARNING_FLASHCARDS.md`, les dossiers `drizzle/2025*`, le rôle `admin`
   (`user_role`, `packages/api/src/types.ts`), la source `rag_program` (`deck_source`,
   `modules/learning/deck.routes.ts`).
5. **Migration de base** : historique 0000 à 0039 remplacé par une migration générée ; plus
   d'extension `vector` (`platform/db/migrate.ts`, `scripts/doctor-checks.mjs` et ses tests,
   `scripts/setup.mjs`) ; image `postgres:18.6` dans `docker-compose.yml` et la CI ; base
   locale recréée, puis `bun run seed`.
6. **Doc** : `README.md`, `apps/server/README.md`, `docs/agent.md` (chemin de la taxonomie,
   périmètre), `.claude/skills/dev-bootstrap/SKILL.md` (`/health/ai`), `docs/suivi.md`
   (point « Niveaux » du lot 3 soldé).

## Hors périmètre

- Tables et colonnes d'abonnement, forfaits absents de `subscription_plans` : point 8.
- Routes de séance qui se recouvrent : lot 3, avec le client.

## Validation

`bun run typecheck`, `bun run lint`, `bunx knip`, `bun run test`, `bun run test:scripts`,
`db:check`, base locale recréée et migrée, `bun run test:integration`, `bun run doctor`.
