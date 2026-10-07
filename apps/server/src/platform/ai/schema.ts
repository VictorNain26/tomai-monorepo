/**
 * What each billed AI call cost, written for its student: the daily quota sums it. Moderation,
 * free, is not written.
 */

import { boolean, index, integer, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { user } from '../auth/schema';

export const aiCost = pgTable(
  'ai_cost',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studentId: text('student_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    model: text('model').notNull(),
    operation: text('operation').notNull(),
    inputTokens: integer('input_tokens').notNull(),
    cachedInputTokens: integer('cached_input_tokens').notNull(),
    outputTokens: integer('output_tokens').notNull(),
    costMicroEur: integer('cost_micro_eur').notNull(),
    // A model missing from the price list costs 0 here: the row says so.
    unknownModel: boolean('unknown_model').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('ai_cost_student_id_created_at_idx').on(table.studentId, table.createdAt)],
);
