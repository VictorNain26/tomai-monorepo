/**
 * The tutor's tables. A session belongs to its student; its messages, its exercises and the
 * distress that closed it follow. The distress event outlives the session (`SET NULL`), for the
 * human review that follows it, and keeps no score (Victor's decision 7, 2026-10-06).
 */

import { sql } from 'drizzle-orm';
import { bigint, boolean, index, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { DISTRESS_SOURCES } from '../../domain/distress';
import { MATH_CHECKS } from '../../domain/exercise-math';
import { SUBJECT_FAMILIES } from '../../domain/subjects';
import { user } from '../../platform/auth/schema';
import type { Hint } from './core/ladder';
import type { ExerciseSheet } from './core/sheet';

export const subjectFamily = pgEnum('subject_family', SUBJECT_FAMILIES);
export const messageRole = pgEnum('message_role', ['student', 'tutor']);
export const mathCheck = pgEnum('math_check', MATH_CHECKS);
export const distressSource = pgEnum('distress_source', DISTRESS_SOURCES);

export const studySession = pgTable(
  'study_session',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studentId: text('student_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    title: text('title'),
    /** The summary of the messages up to `summaryUntil`, which the tutor reads first; out of the student's sight. */
    summary: text('summary'),
    /** The position of the last message the summary covers. */
    summaryUntil: bigint('summary_until', { mode: 'number' }),
    /** The subject of the first turn that names one: the next turns fall back on it. */
    subject: subjectFamily('subject'),
    /** Set by a distress: every later message gets the fixed reply. */
    closedAt: timestamp('closed_at', { withTimezone: true }),
    /** One turn at a time: set when a turn starts, cleared when it ends; a stale one is taken over. */
    turnStartedAt: timestamp('turn_started_at', { withTimezone: true }),
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
    // The last one written is in progress: created_at would tie within a transaction.
    position: bigint('position', { mode: 'number' }).generatedAlwaysAsIdentity(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => studySession.id, { onDelete: 'cascade' }),
    /** Null when every draw failed: the help then stays low. */
    sheet: jsonb('sheet').$type<ExerciseSheet>(),
    uncertain: boolean('uncertain').notNull(),
    drawnForms: jsonb('drawn_forms').$type<string[]>().notNull(),
    mathCheck: mathCheck('math_check').notNull(),
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
  (table) => [index('exercise_session_id_position_idx').on(table.sessionId, table.position)],
);

export const turnOutcome = pgEnum('turn_outcome', ['passed', 'regenerated', 'fallback', 'distress', 'closed']);

/**
 * What the code decided at each turn, to explain a reply and compare prompt versions
 * (`docs/etudes/2026-10-06/refonte-architecture.md`, « Tuteur »): no word of the student nor of
 * the tutor, only the decisions and the versions.
 */
export const turnRecord = pgTable(
  'turn_record',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => studySession.id, { onDelete: 'cascade' }),
    /** The analysis' booleans and subject; null when it failed. */
    analysis: jsonb('analysis').$type<Record<string, boolean | string>>(),
    /** The categories moderation recorded on the student's message; null when it could not answer. */
    inputFlagged: jsonb('input_flagged').$type<string[]>(),
    exerciseId: uuid('exercise_id').references(() => exercise.id, { onDelete: 'set null' }),
    newExercise: boolean('new_exercise').notNull(),
    hintLevel: integer('hint_level'),
    verdict: text('verdict'),
    /** The diagnosis' error type, which the learner memory counts. */
    errorType: text('error_type'),
    decidedBy: text('decided_by'),
    reasoningEffort: text('reasoning_effort'),
    model: text('model').notNull(),
    promptVersion: text('prompt_version').notNull(),
    /** What the check held back from the first text. */
    findings: jsonb('findings').$type<string[]>().notNull(),
    outcome: turnOutcome('outcome').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('turn_record_session_id_created_at_idx').on(table.sessionId, table.createdAt)],
);

export const distressEvent = pgTable(
  'distress_event',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studentId: text('student_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    sessionId: uuid('session_id').references(() => studySession.id, { onDelete: 'set null' }),
    detectedBy: distressSource('detected_by').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // One event per session: two distress messages sent at once must not alert twice.
    uniqueIndex('distress_event_session_id_idx').on(table.sessionId),
    index('distress_event_student_id_created_at_idx').on(table.studentId, table.createdAt),
  ],
);

/** A notion the student marked as understood: the learner memory counts only its later exercises. */
export const learnerNotionReset = pgTable(
  'learner_notion_reset',
  {
    studentId: text('student_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    notionId: text('notion_id').notNull(),
    resetAt: timestamp('reset_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.studentId, table.notionId] })],
);
