import { pgTable, uuid, varchar, timestamp, real, index, uniqueIndex, foreignKey } from 'drizzle-orm/pg-core';
import { user } from '../auth/auth.schema';
import { studySessions } from './session.schema';
import type { DistressSource } from './distress';

/** The distress that closed a session, one per session, for the parent's alert (lot 3). */
export const distressEvents = pgTable(
  'distress_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: varchar('user_id', { length: 255 }).notNull(),
    sessionId: uuid('session_id').notNull(),
    detectedBy: varchar('detected_by', { length: 16 }).$type<DistressSource>().notNull(),
    /** Mistral's selfharm score; null when moderation could not answer. */
    selfharmScore: real('selfharm_score'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({ columns: [table.userId], foreignColumns: [user.id], name: 'distress_events_user_id_fkey' }).onDelete('cascade'),
    foreignKey({ columns: [table.sessionId], foreignColumns: [studySessions.id], name: 'distress_events_session_id_fkey' }).onDelete('cascade'),
    // One event per session: two distress messages sent at once must not alert the parent twice.
    uniqueIndex('uq_distress_events_session').on(table.sessionId),
    index('idx_distress_events_user_created').on(table.userId, table.createdAt),
  ],
);
