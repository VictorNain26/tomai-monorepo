/**
 * The tutor's tables. A session belongs to its student; its messages, its exercises and the
 * distress that closed it follow. The distress event outlives the session (`SET NULL`), for the
 * human review that follows it, and keeps no score (Victor's decision 7, 2026-10-06).
 */

import { sql } from 'drizzle-orm';
import { bigint, boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import type { DistressSource } from '../../domain/distress';
import type { MathCheck } from '../../domain/exercise-math';
import { SUBJECT_FAMILIES } from '../../domain/subjects';
import { user } from '../../platform/auth/schema';
import type { Hint } from './core/ladder';
import type { ExerciseSheet } from './core/sheet';

export const subjectFamily = pgEnum('subject_family', SUBJECT_FAMILIES);
export const messageRole = pgEnum('message_role', ['student', 'tutor']);

export const studySession = pgTable(
  'study_session',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studentId: text('student_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    title: text('title'),
    /** The subject of the first turn that names one: the next turns fall back on it. */
    subject: subjectFamily('subject'),
    /** Set by a distress: every later message gets the fixed reply. */
    closedAt: timestamp('closed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('study_session_student_id_created_at_idx').on(table.studentId, table.createdAt)],
);

export const message = pgTable(
  'message',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // The order of the conversation: a turn writes its two messages in one transaction, where
    // now() is the same for both.
    position: bigint('position', { mode: 'number' }).generatedAlwaysAsIdentity(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => studySession.id, { onDelete: 'cascade' }),
    role: messageRole('role').notNull(),
    /** What the student wrote, or what they read: the checked text. */
    text: text('text').notNull(),
    /** The tutor's response messages as the model produced them, replayed by the next turns; never sent to the client. */
    modelMessages: jsonb('model_messages'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('message_session_id_position_idx').on(table.sessionId, table.position)],
);

/** Each exercise the student brings, its sheet out of their sight; the session's last one is in progress. */
export const exercise = pgTable(
  'exercise',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => studySession.id, { onDelete: 'cascade' }),
    /** Null when every draw failed: the help then stays low. */
    sheet: jsonb('sheet').$type<ExerciseSheet>(),
    uncertain: boolean('uncertain').notNull(),
    drawnForms: jsonb('drawn_forms').$type<string[]>().notNull(),
    mathCheck: text('math_check').$type<MathCheck>().notNull(),
    promptVersion: text('prompt_version').notNull(),
    hintLevel: integer('hint_level').notNull().default(0),
    stepsDone: integer('steps_done').notNull().default(0),
    stuckTurns: integer('stuck_turns').notNull().default(0),
    hints: jsonb('hints')
      .$type<Hint[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    solvedAt: timestamp('solved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('exercise_session_id_created_at_idx').on(table.sessionId, table.createdAt)],
);

export const distressEvent = pgTable(
  'distress_event',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studentId: text('student_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    sessionId: uuid('session_id').references(() => studySession.id, { onDelete: 'set null' }),
    detectedBy: text('detected_by').$type<DistressSource>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // One event per session: two distress messages sent at once must not alert twice.
    uniqueIndex('distress_event_session_id_idx').on(table.sessionId),
    index('distress_event_student_id_created_at_idx').on(table.studentId, table.createdAt),
  ],
);
