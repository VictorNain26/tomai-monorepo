import { pgTable, uuid, varchar, text, timestamp, integer, jsonb, index, foreignKey } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';
import { user } from '../auth/auth.schema';
import { studySessions } from '../tutor/session.schema';

/**
 * Table cost_tracking - Suivi des coûts AI
 */
export const costTracking = pgTable(
  'cost_tracking',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id', { length: 255 }),
    sessionId: uuid('session_id'),

    // Modèle et coûts - TEXT pour flexibilité
    aiModel: text('ai_model').notNull(),
    operation: varchar('operation', { length: 50 }).notNull().default('chat'),
    tokensInput: integer('tokens_input').notNull().default(0),
    tokensOutput: integer('tokens_output').notNull().default(0),
    /** Micro-euros (1 µ€ = 0.0001 c): a text turn costs a few hundred, rounded to 0 in cents. */
    costMicroEur: integer('cost_micro_eur').notNull().default(0),

    // Métadonnées de facturation
    billingMetadata: jsonb('billing_metadata').default(sql`'{}'::jsonb`),

    // Audit
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: 'cost_tracking_user_id_fkey',
    }).onDelete('set null'),
    foreignKey({
      columns: [table.sessionId],
      foreignColumns: [studySessions.id],
      name: 'cost_tracking_session_id_fkey',
    }).onDelete('set null'),

    // The quota sums a user's spend since the daily reset.
    index('idx_cost_tracking_user_created_at').on(table.userId, table.createdAt),
    index('idx_cost_tracking_created_at').on(table.createdAt),
  ],
);

export const costTrackingRelations = relations(costTracking, ({ one }) => ({
  user: one(user, {
    fields: [costTracking.userId],
    references: [user.id],
  }),
  session: one(studySessions, {
    fields: [costTracking.sessionId],
    references: [studySessions.id],
  }),
}));
