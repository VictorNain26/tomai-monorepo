import { pgTable, uuid, varchar, timestamp, boolean, integer, jsonb, index, foreignKey } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { studySessions } from './session.schema';
import type { ExerciseSheet } from './exercise-sheet';
import type { MathCheck } from './exercise-math';
import type { Hint } from './hint-ladder';

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
  /** Index in the hint ladder (`hint-ladder.ts`), decided by the code. */
  hintLevel: integer('hint_level').notNull().default(0),
  /** The steps the student got right: the intermediate step shown is the next one. */
  stepsDone: integer('steps_done').notNull().default(0),
  /** The tutor's messages on the exercise, cut: the contract lists the last ones so it does not repeat itself. */
  hints: jsonb('hints').$type<Hint[]>().notNull().default(sql`'[]'::jsonb`),
  /** A right final answer ends the exercise: no contract after it, until a new attempt reopens it. */
  solvedAt: timestamp('solved_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  foreignKey({
    columns: [table.sessionId],
    foreignColumns: [studySessions.id],
    name: 'exercise_sheets_session_id_fkey',
  }).onDelete('cascade'),
  index('idx_exercise_sheets_session_created').on(table.sessionId, table.createdAt),
]);
