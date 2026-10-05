import { pgTable, uuid, varchar, text, timestamp, boolean, integer, decimal, jsonb, pgEnum, index, foreignKey } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { user } from '../auth/auth.schema';

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
}, (table) => [
  foreignKey({
    columns: [table.userId],
    foreignColumns: [user.id],
    name: 'study_sessions_user_id_fkey'
  }).onDelete('cascade'),

  index('idx_sessions_user_status').on(table.userId, table.status),
  index('idx_sessions_user_subject_date').on(table.userId, table.subject, table.startedAt),
  index('idx_sessions_active').on(table.startedAt),
]);

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

  // Réponse du modèle telle qu'il l'a produite (raisonnement, appels d'outils), rejouée au tour
  // suivant ; jamais rendue au client.
  modelMessages: jsonb('model_messages'),

  // Audit
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  foreignKey({
    columns: [table.sessionId],
    foreignColumns: [studySessions.id],
    name: 'messages_session_id_fkey'
  }).onDelete('cascade'),

  index('idx_messages_session_created').on(table.sessionId, table.createdAt),
  index('idx_messages_quality').on(table.messageQualityScore),
]);

// =============================================
// RELATIONS
// =============================================

export const messagesRelations = relations(messages, ({ one }) => ({
  session: one(studySessions, {
    fields: [messages.sessionId],
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
export type SessionStatus = typeof sessionStatusEnum.enumValues[number];
export type MessageRole = typeof messageRoleEnum.enumValues[number];

// Type pour fichier attaché aux messages
export interface AttachedFile {
  fileName: string;
  fileId?: string | undefined;
  mimeType?: string | undefined;
  fileSizeBytes?: number | undefined;
}
