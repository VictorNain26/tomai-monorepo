/**
 * The only file of the module that touches the database. A student reaches a session through
 * `ownSession`, a clause of the query itself: another student's session is simply not found.
 */

import { and, asc, desc, eq, sql } from 'drizzle-orm';
import type { MathCheck } from '../../domain/exercise-math';
import type { Db } from '../../platform/db/client';
import type { ExerciseState } from './core/exercise-turn';
import type { Hint } from './core/ladder';
import { exercise, message, studySession } from './schema';

/** The tutor's last messages on an exercise that the contract lists, so as not to repeat them. */
const KEPT_HINTS = 4;

const ownSession = (studentId: string, sessionId: string) => and(eq(studySession.id, sessionId), eq(studySession.studentId, studentId));

const sessionColumns = { id: studySession.id, title: studySession.title, closedAt: studySession.closedAt, createdAt: studySession.createdAt };

export interface NewExercise {
  state: ExerciseState;
  mathCheck: MathCheck;
  promptVersion: string;
}

export interface ExerciseProgress {
  hintLevel: number;
  stuckTurns: number;
  stepDone: boolean;
  solved: boolean | undefined;
  hint: Hint;
}

export function createTutorRepository(db: Db) {
  return {
    async createSession(studentId: string) {
      const [created] = await db.insert(studySession).values({ studentId }).returning(sessionColumns);
      if (!created) throw new Error('Session not created');
      return created;
    },

    listSessions(studentId: string) {
      return db.select(sessionColumns).from(studySession).where(eq(studySession.studentId, studentId)).orderBy(desc(studySession.createdAt));
    },

    async findSession(studentId: string, sessionId: string) {
      const [found] = await db
        .select({ ...sessionColumns, subject: studySession.subject })
        .from(studySession)
        .where(ownSession(studentId, sessionId));
      return found;
    },

    /** The messages of the student's session, oldest first; none for a session that is not theirs. */
    listMessages(studentId: string, sessionId: string) {
      return db
        .select({ id: message.id, role: message.role, text: message.text, createdAt: message.createdAt })
        .from(message)
        .innerJoin(studySession, eq(studySession.id, message.sessionId))
        .where(ownSession(studentId, sessionId))
        .orderBy(asc(message.position));
    },

    /** The session's last exercise, solved or not: its statement stays before the tutor. */
    async currentExercise(sessionId: string): Promise<(ExerciseState & { id: string }) | undefined> {
      const [row] = await db.select().from(exercise).where(eq(exercise.sessionId, sessionId)).orderBy(desc(exercise.createdAt)).limit(1);
      if (!row) return undefined;
      return {
        id: row.id,
        sheet: row.sheet,
        uncertain: row.uncertain,
        drawnForms: row.drawnForms,
        hintLevel: row.hintLevel,
        stepsDone: row.stepsDone,
        stuckTurns: row.stuckTurns,
        hints: row.hints.slice(-KEPT_HINTS),
        solved: row.solvedAt !== null,
      };
    },

    async createExercise(sessionId: string, { state, mathCheck, promptVersion }: NewExercise) {
      const [created] = await db
        .insert(exercise)
        .values({ sessionId, sheet: state.sheet, uncertain: state.uncertain, drawnForms: state.drawnForms, mathCheck, promptVersion })
        .returning({ id: exercise.id });
      if (!created) throw new Error('Exercise not created');
      return created.id;
    },

    /** What a turn the student has seen changes on the exercise, in one statement: two turns at once both count. */
    async recordExerciseTurn(exerciseId: string, progress: ExerciseProgress) {
      await db
        .update(exercise)
        .set({
          hintLevel: progress.hintLevel,
          stuckTurns: progress.stuckTurns,
          ...(progress.stepDone ? { stepsDone: sql`${exercise.stepsDone} + 1` } : {}),
          ...(progress.solved === undefined ? {} : { solvedAt: progress.solved ? new Date() : null }),
          hints: sql`${exercise.hints} || ${JSON.stringify([progress.hint])}::jsonb`,
        })
        .where(eq(exercise.id, exerciseId));
    },
  };
}

export type TutorRepository = ReturnType<typeof createTutorRepository>;
