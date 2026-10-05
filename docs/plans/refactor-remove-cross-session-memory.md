# Plan — refactor/remove-cross-session-memory

Nettoyage demandé par Victor le 2026-10-06 (« tout ce dont on n'a plus besoin on supprime »),
décisions qu'il m'a déléguées. Première de trois PR : la mémoire entre séances. Inventaire :
lecture du code serveur du 2026-10-06. Chemins relatifs à `apps/server/src/`.

## Décision

Toute la mémoire d'une séance à l'autre part. La séance garde son résumé incrémental (#395).

- La vision (`docs/vision.md`) ne la promet pas : elle promet de ne pas céder, de bien
  expliquer, un résumé de la semaine et une alerte de détresse pour le parent.
- Rien n'en est mesuré : le harnais joue un élève neuf dans une séance neuve
  (`docs/agent.md` § 9) ; ce qui tourne devient ce qui est mesuré.
- Ses réglages sont inventés : similarité > 0,6, 10 caractères, 3 tours, 90 et 180 jours,
  12 concepts.
- Le profil cognitif garde, sans durée ni accès pour l'élève ou le parent, des notes libres
  écrites par le modèle sur un enfant (`docs/agent.md` § 10 demandait un profil inspectable).
- Le contexte d'apprentissage écrit « propose des flashcards » dans `<student_context>`, bloc
  que le prompt déclare sans ordre (défaut relevé par `etudes/2026-10-04/refonte-agent.md`).
- Le résumé de la semaine du parent (lot 3) se construira sur les séances et leurs résumés.
  Une continuité entre séances ne reviendrait que mesurée.

## Ce qui part

- Épisodes : `episodic-memory.service.ts`, `episodic-memory.repository.ts`, table
  `session_episodes`, colonne `study_sessions.recalled_episodes` ; extraction au reset.
- Embeddings : `mistral-embeddings.service.ts`, `MISTRAL_EMBED_MODEL`.
- Profils : `subject-profile.service.ts`, `student-subject-profile.repository.ts`, table
  `student_subject_profile`, routes `/student/memory` ; `cognitive-profile.service.ts`, table
  `student_cognitive_profiles`, outil `update_student_profile`.
- Contexte d'apprentissage (`getLearningContext`) et bloc `<student_context>` du tour.
- Purge de rétention (`retention-purge.service.ts`), qui ne purgeait que les épisodes et
  les profils.
- Leurs tests, leurs mentions dans le prompt et la doc.

## Ce qui reste, et pourquoi

- pgvector (image `pgvector/pgvector`, `CREATE EXTENSION vector` du migrateur) : la migration
  0016 crée une colonne `vector`, une base neuve ne rejoue l'historique qu'avec lui. Il part
  avec la troisième PR du nettoyage, qui repart d'une migration de base unique (aucune base
  déployée).

## Validation

`bun run typecheck`, `bun run lint`, `bunx knip`, `bun run test`, `db:check`,
`bun run test:integration`, `bun run test:scripts`.
