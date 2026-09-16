import { pgTable, uuid, varchar, text, timestamp, boolean, integer, decimal, jsonb, pgEnum, index, foreignKey, unique, vector } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { user } from './auth.schema';

// =============================================
// ENUMS
// =============================================
export const sessionStatusEnum = pgEnum('session_status', ['draft', 'active', 'paused', 'completed', 'abandoned', 'timeout', 'error']);
export const messageRoleEnum = pgEnum('message_role', ['user', 'assistant', 'system']);

// =============================================
// TABLES
// =============================================

/**
 * Table study_sessions - Sessions d'apprentissage TomAI
 */
export const studySessions = pgTable('study_sessions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 255 }).notNull(),

  // Détails pédagogiques
  subject: varchar('subject', { length: 100 }).notNull().default('général'),
  topic: varchar('topic', { length: 200 }),
  status: sessionStatusEnum('status').notNull().default('active'),

  // Timing
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
  durationMinutes: integer('duration_minutes'),

  // Métriques pédagogiques
  frustrationAvg: decimal('frustration_avg', { precision: 3, scale: 2 }).default('0'),
  frustrationMin: decimal('frustration_min', { precision: 3, scale: 2 }).default('0'),
  frustrationMax: decimal('frustration_max', { precision: 3, scale: 2 }).default('0'),
  questionLevelsAvg: decimal('question_levels_avg', { precision: 3, scale: 2 }).default('0'),
  conceptsCovered: text('concepts_covered').array().default(sql`'{}'::text[]`),

  // Métriques Socratiques
  socraticEffectiveness: decimal('socratic_effectiveness', { precision: 3, scale: 2 }).default('0'),
  studentEngagement: decimal('student_engagement', { precision: 3, scale: 2 }).default('0'),
  questionsAsked: integer('questions_asked').default(0),
  questionsAnswered: integer('questions_answered').default(0),
  hintsGiven: integer('hints_given').default(0),

  // Métriques techniques - TEXT pour flexibilité (pas d'ENUM = pas de migration par modèle)
  aiModelUsed: text('ai_model_used').notNull().default(''),
  totalTokensUsed: integer('total_tokens_used').default(0),
  apiCostCents: integer('api_cost_cents').default(0),
  averageResponseTimeMs: integer('average_response_time_ms'),

  // Device et contexte
  deviceType: varchar('device_type', { length: 20 }),

  // Évaluation utilisateur
  userSatisfaction: integer('user_satisfaction'),
  sessionRating: integer('session_rating'),

  // Résumé conversationnel (SummaryBuffer pattern)
  conversationSummary: text('conversation_summary'),
  summaryUpToMessageId: uuid('summary_up_to_message_id'),

  // Métadonnées
  // CRITICAL FIX: JSONB default must use sql`'{}'::jsonb` NOT .default({})
  // See: https://orm.drizzle.team/docs/column-types/pg#default-value
  sessionMetadata: jsonb('session_metadata').default(sql`'{}'::jsonb`),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdFk: foreignKey({
    columns: [table.userId],
    foreignColumns: [user.id],
    name: 'study_sessions_user_id_fkey'
  }).onDelete('cascade'),

  userStatusIdx: index('idx_sessions_user_status').on(table.userId, table.status),
  userSubjectDateIdx: index('idx_sessions_user_subject_date').on(table.userId, table.subject, table.startedAt),
  activeIdx: index('idx_sessions_active').on(table.startedAt),
}));

/**
 * Table messages - Messages de chat TomAI
 */
export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').notNull(),

  // Contenu
  role: messageRoleEnum('role').notNull(),
  content: text('content').notNull(),
  contentHash: varchar('content_hash', { length: 64 }),

  // Métriques pédagogiques
  frustrationLevel: integer('frustration_level'),
  questionLevel: integer('question_level'),
  socraticLevel: integer('socratic_level'),

  // Classification
  messageCategory: varchar('message_category', { length: 50 }),

  // Métriques techniques - TEXT pour flexibilité
  aiModel: text('ai_model'),
  tokensUsed: integer('tokens_used').default(0),
  responseTimeMs: integer('response_time_ms'),

  // Qualité
  messageQualityScore: decimal('message_quality_score', { precision: 3, scale: 2 }),
  isHelpful: boolean('is_helpful'),

  // Sécurité
  containsPii: boolean('contains_pii').default(false),
  isFlagged: boolean('is_flagged').default(false),

  // Fichiers attachés (nouveau)
  attachedFile: jsonb('attached_file'), // { fileName: string, fileId?: string, mimeType?: string }

  // Métadonnées
  messageMetadata: jsonb('message_metadata').default(sql`'{}'::jsonb`),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  sessionIdFk: foreignKey({
    columns: [table.sessionId],
    foreignColumns: [studySessions.id],
    name: 'messages_session_id_fkey'
  }).onDelete('cascade'),

  sessionCreatedIdx: index('idx_messages_session_created').on(table.sessionId, table.createdAt),
  qualityIdx: index('idx_messages_quality').on(table.messageQualityScore),
}));

/**
 * Table progress - Progression pédagogique
 */
export const progress = pgTable('progress', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 255 }).notNull(),

  // Domaine d'apprentissage
  subject: varchar('subject', { length: 100 }).notNull(),
  concept: varchar('concept', { length: 200 }).notNull(),
  competencyDomain: varchar('competency_domain', { length: 10 }),

  // Métriques de progression
  masteryLevel: integer('mastery_level').notNull(),
  totalPracticeTime: integer('total_practice_time').notNull().default(0),
  successRate: decimal('success_rate', { precision: 5, scale: 2 }),

  // Historique de progression
  progressHistory: jsonb('progress_history').default(sql`'[]'::jsonb`),

  // Timing
  firstPracticed: timestamp('first_practiced', { withTimezone: true }).notNull().defaultNow(),
  lastPracticed: timestamp('last_practiced', { withTimezone: true }).notNull().defaultNow(),

  // Métadonnées
  progressMetadata: jsonb('progress_metadata').default(sql`'{}'::jsonb`),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdFk: foreignKey({
    columns: [table.userId],
    foreignColumns: [user.id],
    name: 'progress_user_id_fkey'
  }).onDelete('cascade'),

  userSubjectConceptUnique: unique('progress_user_id_subject_concept_key').on(table.userId, table.subject, table.concept),

  userIdIdx: index('idx_progress_user_id').on(table.userId),
  subjectIdx: index('idx_progress_subject').on(table.subject),
  masteryLevelIdx: index('idx_progress_mastery_level').on(table.masteryLevel),
}));

/**
 * Table cost_tracking - Suivi des coûts AI
 */
export const costTracking = pgTable('cost_tracking', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 255 }),
  sessionId: uuid('session_id'),

  // Modèle et coûts - TEXT pour flexibilité
  aiModel: text('ai_model').notNull(),
  operation: varchar('operation', { length: 50 }).notNull().default('chat'),
  tokensInput: integer('tokens_input').notNull().default(0),
  tokensOutput: integer('tokens_output').notNull().default(0),
  costCents: integer('cost_cents').notNull().default(0),

  // Métadonnées de facturation
  billingMetadata: jsonb('billing_metadata').default(sql`'{}'::jsonb`),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdFk: foreignKey({
    columns: [table.userId],
    foreignColumns: [user.id],
    name: 'cost_tracking_user_id_fkey'
  }).onDelete('set null'),
  sessionIdFk: foreignKey({
    columns: [table.sessionId],
    foreignColumns: [studySessions.id],
    name: 'cost_tracking_session_id_fkey'
  }).onDelete('set null'),

  userIdIdx: index('idx_cost_tracking_user_id').on(table.userId),
  createdAtIdx: index('idx_cost_tracking_created_at').on(table.createdAt),
}));

/**
 * Table session_episodes - Mémoire épisodique long-terme
 *
 * Une ligne par session close, avec un résumé compressé + l'embedding 1024D
 * de ce résumé (Mistral Embed). Permet de
 * retrouver les sessions passées pertinentes pour le tour courant via
 * similarité cosinus côté Postgres (pgvector).
 *
 * Extraction : fire-and-forget à chaque session archivée (resetSession +
 * deleteSession). Retrieval : top-3 épisodes les plus similaires injectés
 * dans le system prompt au début d'une nouvelle conversation.
 *
 * GDPR-K : ttlUntil permet la purge automatique des épisodes >90 jours sauf
 * opt-in parent. Suppression cascade via userId FK.
 */
export const sessionEpisodes = pgTable('session_episodes', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  sessionId: uuid('session_id').notNull(),

  // Contenu pédagogique
  subject: varchar('subject', { length: 100 }).notNull(),
  summaryText: text('summary_text').notNull(),
  summaryEmbedding: vector('summary_embedding', { dimensions: 1024 }).notNull(),
  conceptsCovered: jsonb('concepts_covered').notNull().default(sql`'[]'::jsonb`),

  // Métriques
  messageCount: integer('message_count').notNull().default(0),
  durationSeconds: integer('duration_seconds'),
  outcome: varchar('outcome', { length: 32 }).notNull().default('completed'),

  // Audit + purge
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  ttlUntil: timestamp('ttl_until', { withTimezone: true }),
}, (table) => ({
  userIdFk: foreignKey({
    columns: [table.userId],
    foreignColumns: [user.id],
    name: 'session_episodes_user_id_fkey'
  }).onDelete('cascade'),
  sessionIdFk: foreignKey({
    columns: [table.sessionId],
    foreignColumns: [studySessions.id],
    name: 'session_episodes_session_id_fkey'
  }).onDelete('cascade'),

  userIdIdx: index('idx_session_episodes_user_id').on(table.userId),
  createdAtIdx: index('idx_session_episodes_created_at').on(table.createdAt),
  ttlIdx: index('idx_session_episodes_ttl').on(table.ttlUntil),
  embeddingIdx: index('idx_session_episodes_embedding')
    .using('hnsw', table.summaryEmbedding.op('vector_cosine_ops')),
}));

// Profil mémoire élève PAR MATIÈRE — agrégat pédagogique durable, distinct de
// sessionEpisodes (par session, pgvector) et studentCognitiveProfiles (global).
export const studentSubjectProfiles = pgTable('student_subject_profile', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  subject: varchar('subject', { length: 100 }).notNull(),
  conceptsSeen: jsonb('concepts_seen').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  difficulties: jsonb('difficulties').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
  masteryNotes: text('mastery_notes'),
  sessionsCount: integer('sessions_count').notNull().default(0),
  lastOutcome: varchar('last_outcome', { length: 32 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  ttlUntil: timestamp('ttl_until', { withTimezone: true }).notNull(),
}, (table) => ({
  userIdFk: foreignKey({
    columns: [table.userId],
    foreignColumns: [user.id],
    name: 'student_subject_profiles_user_id_fkey'
  }).onDelete('cascade'),

  userSubjectUnique: unique('uq_subject_profile_user_subject').on(table.userId, table.subject),
  userIdIdx: index('idx_subject_profile_user').on(table.userId),
  ttlIdx: index('idx_subject_profile_ttl').on(table.ttlUntil),
}));

export type StudentSubjectProfile = typeof studentSubjectProfiles.$inferSelect;
export type NewStudentSubjectProfile = typeof studentSubjectProfiles.$inferInsert;

// =============================================
// RELATIONS
// =============================================

export const messagesRelations = relations(messages, ({ one }) => ({
  session: one(studySessions, {
    fields: [messages.sessionId],
    references: [studySessions.id]
  }),
}));

export const sessionEpisodesRelations = relations(sessionEpisodes, ({ one }) => ({
  user: one(user, {
    fields: [sessionEpisodes.userId],
    references: [user.id]
  }),
  session: one(studySessions, {
    fields: [sessionEpisodes.sessionId],
    references: [studySessions.id]
  }),
}));

export const progressRelations = relations(progress, ({ one }) => ({
  user: one(user, {
    fields: [progress.userId],
    references: [user.id]
  }),
}));

export const costTrackingRelations = relations(costTracking, ({ one }) => ({
  user: one(user, {
    fields: [costTracking.userId],
    references: [user.id]
  }),
  session: one(studySessions, {
    fields: [costTracking.sessionId],
    references: [studySessions.id]
  }),
}));

// =============================================
// TYPES
// =============================================
export type StudySession = typeof studySessions.$inferSelect;
export type NewStudySession = typeof studySessions.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type Progress = typeof progress.$inferSelect;
export type NewProgress = typeof progress.$inferInsert;
export type SessionEpisode = typeof sessionEpisodes.$inferSelect;
export type NewSessionEpisode = typeof sessionEpisodes.$inferInsert;
export type SessionStatus = typeof sessionStatusEnum.enumValues[number];
export type MessageRole = typeof messageRoleEnum.enumValues[number];

// Type pour fichier attaché aux messages
export interface AttachedFile {
  fileName: string;
  fileId?: string;
  mimeType?: string;
  fileSizeBytes?: number;
}
