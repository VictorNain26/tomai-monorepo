/**
 * The only file of the module that touches the database. A student reaches a session through
 * `ownSession`, a clause of the query itself: another student's session is simply not found.
 */

import { and, asc, desc, eq, sql } from 'drizzle-orm';
import type { MathCheck } from '../../domain/exercise-math';
import type { Db } from '../../platform/db/client';
import type { ExerciseChange, ExerciseState } from './core/exercise-turn';
import type { Hint } from './core/ladder';
import { exercise, message, studySession } from './schema';

/** The tutor's last messages on an exercise that the contract lists, so as not to repeat them. */
const KEPT_HINTS = 4;

const ownSession = (studentId: string, sessionId: string) => and(eq(studySession.id, sessionId), eq(studySession.studentId, studentId));

const sessionColumns = { id: studySession.id, title: studySession.title, closedAt: studySession.closedAt, createdAt: studySession.createdAt };

export interface ExerciseProgress extends ExerciseChange {
  /** The tutor's message, cut, that the contract lists so as not to repeat it. */
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

    /** The last exercise of the student's session, solved or not: its statement stays before the tutor. */
    async currentExercise(studentId: string, sessionId: string): Promise<(ExerciseState & { id: string }) | undefined> {
      const [row] = await db
        .select({ exercise })
        .from(exercise)
        .innerJoin(studySession, eq(studySession.id, exercise.sessionId))
        .where(ownSession(studentId, sessionId))
        .orderBy(desc(exercise.position))
        .limit(1);
      if (!row) return undefined;
      const { id, sheet, uncertain, drawnForms, hintLevel, stepsDone, stuckTurns, hints, solvedAt } = row.exercise;
      return { id, sheet, uncertain, drawnForms, hintLevel, stepsDone, stuckTurns, hints, solved: solvedAt !== null };
    },

    /** A new exercise in the student's session, at the first level; undefined when the session is not theirs. */
    async createExercise(
      studentId: string,
      sessionId: string,
      fresh: Pick<ExerciseState, 'sheet' | 'uncertain' | 'drawnForms'> & { mathCheck: MathCheck; promptVersion: string },
    ) {
      return db.transaction(async (tx) => {
        // The session read in the same transaction, and locked against its deletion until the insert.
        const [owned] = await tx.select({ id: studySession.id }).from(studySession).where(ownSession(studentId, sessionId)).for('share');
        if (!owned) return undefined;
        const [created] = await tx
          .insert(exercise)
          .values({ sessionId: owned.id, ...fresh })
          .returning({ id: exercise.id });
        return created?.id;
      });
    },

    /**
     * What a turn the student has seen changes on an exercise this module read for them. The level
     * and the stuck turns are the turn's decision, from the state it read: the turn service lets one
     * turn at a time run in a session. A step done counts in SQL, and only the last hints are kept.
     */
    async recordExerciseTurn(exerciseId: string, progress: ExerciseProgress) {
      await db
        .update(exercise)
        .set({
          hintLevel: progress.hintLevel,
          stuckTurns: progress.stuckTurns,
          ...(progress.stepDone ? { stepsDone: sql`${exercise.stepsDone} + 1` } : {}),
          ...(progress.solved === undefined ? {} : { solvedAt: progress.solved ? new Date() : null }),
          hints: sql`(select coalesce(jsonb_agg(kept.hint order by kept.i), '[]'::jsonb) from (select hint, i from jsonb_array_elements(${exercise.hints} || ${JSON.stringify([progress.hint])}::jsonb) with ordinality as all_hints(hint, i) order by i desc limit ${KEPT_HINTS}) as kept)`,
        })
        .where(eq(exercise.id, exerciseId));
    },
  };
}

export type TutorRepository = ReturnType<typeof createTutorRepository>;
