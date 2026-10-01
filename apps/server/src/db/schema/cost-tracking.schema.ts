import { pgTable, uuid, varchar, text, timestamp, integer, jsonb, index, foreignKey } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { user } from '../../modules/auth/auth.schema';
import { studySessions } from '../../modules/tutor/session.schema';

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
