import { pgTable, uuid, varchar, integer, timestamp, real, index } from 'drizzle-orm/pg-core';

/**
 * Retrieval audit log — RGPD article 30 (registre des activités de traitement).
 *
 * Persists a row for every RAG call so we can answer "what did this user
 * search and when" without having to replay logs. PII-safe by design:
 *
 * - `query_hash` is SHA-256 of the lowercased query text. Lets the same
 *   question across users de-duplicate in aggregates but keeps the prompt
 *   itself out of the database.
 * - `user_id` is the pseudonym from Better Auth (already not a name/email).
 * - No prompt, no response, no chunk content — just operational metadata.
 *
 * The table is append-only from the application path: there is no UPDATE or
 * DELETE caller. CRUD deletions are driven by the user-deletion cascade on
 * `auth.user.id` (RGPD article 17 right to erasure).
 *
 * Retention is enforced by `services/retention-purge.service.ts`: rows older
 * than 12 months are deleted at boot and every 24 h. Article 30 calls for
 * "as long as processing is active"; for an MVP we keep one year of analytics + audit.
 */
export const retrievalAudit = pgTable(
  'retrieval_audit',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // Pseudonyme user (Better Auth user.id). Pas de cascade FK pour garder
    // l'historique d'audit même après suppression du user — mais le user_id
    // est anonymisé en NULL par un job RGPD séparé si le user invoque son
    // droit à l'effacement.
    userId: varchar('user_id', { length: 255 }),

    // Lien optionnel vers la session chat. NULL pour les retrieval hors chat
    // (ex: card-generator qui fait un RAG seul).
    sessionId: uuid('session_id'),

    // SHA-256 hex de la query lowercased. PII-safe lookup + dedup.
    queryHash: varchar('query_hash', { length: 64 }).notNull(),

    // Filtres effectivement utilisés sur Qdrant.
    niveau: varchar('niveau', { length: 32 }).notNull(),
    matiere: varchar('matiere', { length: 64 }),

    // Métriques retrieval (pas le contenu retourné — juste la forme).
    resultsCount: integer('results_count').notNull(),
    avgScore: real('avg_score'),
    durationMs: integer('duration_ms').notNull(),

    // Strategy label (`qdrant-hybrid-rrf`, `qdrant-dense`, etc.) pour qu'on
    // puisse comparer la qualité de retrieval entre stratégies a posteriori.
    strategy: varchar('strategy', { length: 64 }).notNull(),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    userIdIdx: index('idx_retrieval_audit_user_id').on(table.userId),
    createdAtIdx: index('idx_retrieval_audit_created_at').on(table.createdAt),
    // Composite for the most common query: "this user's recent retrievals"
    userTimeIdx: index('idx_retrieval_audit_user_time').on(table.userId, table.createdAt),
  }),
);

export type RetrievalAudit = typeof retrievalAudit.$inferSelect;
export type NewRetrievalAudit = typeof retrievalAudit.$inferInsert;
