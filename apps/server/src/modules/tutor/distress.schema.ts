import { pgTable, uuid, varchar, timestamp, real, index, foreignKey } from 'drizzle-orm/pg-core';
import { user } from '../auth/auth.schema';
import { studySessions } from './session.schema';
import type { DistressSource } from './distress';

/** Each distress the code detected, for the parent's alert (lot 3); the session it closed. */
export const distressEvents = pgTable('distress_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: varchar('user_id', { length: 255 }).notNull(),
  sessionId: uuid('session_id').notNull(),
  detectedBy: varchar('detected_by', { length: 16 }).$type<DistressSource>().notNull(),
  /** Mistral's selfharm score; null when moderation could not answer. */
  selfharmScore: real('selfharm_score'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  foreignKey({ columns: [table.userId], foreignColumns: [user.id], name: 'distress_events_user_id_fkey' }).onDelete('cascade'),
  foreignKey({ columns: [table.sessionId], foreignColumns: [studySessions.id], name: 'distress_events_session_id_fkey' }).onDelete('cascade'),
  index('idx_distress_events_session').on(table.sessionId),
  index('idx_distress_events_user_created').on(table.userId, table.createdAt),
]);
