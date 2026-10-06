import { pgTable, uuid, varchar, text, timestamp, integer, jsonb, pgEnum, index, foreignKey } from 'drizzle-orm/pg-core';
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

  // Résumé conversationnel (SummaryBuffer pattern)
  conversationSummary: text('conversation_summary'),
  summaryUpToMessageId: uuid('summary_up_to_message_id'),

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

  // Métriques techniques - TEXT pour flexibilité
  aiModel: text('ai_model'),
  tokensUsed: integer('tokens_used').default(0),

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
