import { pgTable, uuid, varchar, timestamp, boolean, jsonb, index, foreignKey } from 'drizzle-orm/pg-core';
import { studySessions } from './session.schema';
import type { ExerciseSheet } from './exercise-sheet';
import type { MathCheck } from './exercise-math';

/**
 * The sheet of each exercise a student brings, out of the student's sight; the session's last row
 * is the exercise in progress. A row without a sheet is an exercise whose draws all failed: the
 * session must not fall back on the one before.
 */
export const exerciseSheets = pgTable('exercise_sheets', {
  id: uuid('id').primaryKey().defaultRandom(),
  sessionId: uuid('session_id').notNull(),
  sheet: jsonb('sheet').$type<ExerciseSheet>(),
  /** No majority among the draws, or an answer mathjs refutes: the diagnosis must not rely on it. */
  uncertain: boolean('uncertain').notNull(),
  mathCheck: varchar('math_check', { length: 16 }).$type<MathCheck>().notNull(),
  promptVersion: varchar('prompt_version', { length: 32 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  foreignKey({
    columns: [table.sessionId],
    foreignColumns: [studySessions.id],
    name: 'exercise_sheets_session_id_fkey',
  }).onDelete('cascade'),
  index('idx_exercise_sheets_session_created').on(table.sessionId, table.createdAt),
]);
