/**
 * The only file of the module that touches the database. A student reaches a session through
 * `ownSession`, a clause of the query itself: another student's session is simply not found.
 */

import { and, asc, desc, eq, isNull, lt, or, sql } from 'drizzle-orm';
import type { DistressSource } from '../../domain/distress';
import type { MathCheck } from '../../domain/exercise-math';
import type { SubjectFamily } from '../../domain/subjects';
import type { ResponseMessage } from '../../platform/ai/client';
import type { Db } from '../../platform/db/client';
import type { ExerciseChange, ExerciseState } from './core/exercise-turn';
import type { Hint } from './core/ladder';
import { distressEvent, exercise, message, studySession, turnRecord } from './schema';

/** The tutor's last messages on an exercise that the contract lists, so as not to repeat them. */
const KEPT_HINTS = 4;

/** Past it, a turn left marked by a crash no longer blocks the session: longer than any turn's calls. */
const STALE_TURN = sql`interval '3 minutes'`;

type Executor = Db | Parameters<Parameters<Db['transaction']>[0]>[0];

export type TurnRecord = Omit<typeof turnRecord.$inferInsert, 'id' | 'sessionId' | 'createdAt'>;

/** The two messages of a turn: what the student wrote, what they read, and how to replay it. */
interface Exchange {
  studentText: string;
  tutorText: string;
  replay: ResponseMessage[] | null;
}

async function writeExchange(executor: Executor, sessionId: string, { studentText, tutorText, replay }: Exchange) {
  await executor.insert(message).values({ sessionId, role: 'student', text: studentText });
  const [tutor] = await executor
    .insert(message)
    .values({ sessionId, role: 'tutor', text: tutorText, modelMessages: replay })
    .returning({ id: message.id });
  return tutor?.id;
}

const ownSession = (studentId: string, sessionId: string) => and(eq(studySession.id, sessionId), eq(studySession.studentId, studentId));

const sessionColumns = { id: studySession.id, title: studySession.title, closedAt: studySession.closedAt, createdAt: studySession.createdAt };

export interface ExerciseProgress extends ExerciseChange {
  /** The tutor's message, cut, that the contract lists so as not to repeat it. */
  hint: Hint;
}

async function updateExercise(executor: Executor, exerciseId: string, progress: ExerciseProgress) {
  await executor
    .update(exercise)
    .set({
      hintLevel: progress.hintLevel,
      stuckTurns: progress.stuckTurns,
      ...(progress.stepDone ? { stepsDone: sql`${exercise.stepsDone} + 1` } : {}),
      ...(progress.solved === undefined ? {} : { solvedAt: progress.solved ? new Date() : null }),
      hints: sql`(select coalesce(jsonb_agg(kept.hint order by kept.i), '[]'::jsonb) from (select hint, i from jsonb_array_elements(${exercise.hints} || ${JSON.stringify([progress.hint])}::jsonb) with ordinality as all_hints(hint, i) order by i desc limit ${KEPT_HINTS}) as kept)`,
    })
    .where(eq(exercise.id, exerciseId));
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
     * and the stuck turns are the turn's decision, from the state it read: one turn at a time runs
     * in a session (`startTurn`). A step done counts in SQL, and only the last hints are kept.
     */
    recordExerciseTurn: (exerciseId: string, progress: ExerciseProgress) => updateExercise(db, exerciseId, progress),

    /** Marks a turn as running in the student's session; false when one already runs. */
    async startTurn(studentId: string, sessionId: string) {
      const started = await db
        .update(studySession)
        .set({ turnStartedAt: sql`now()` })
        .where(
          and(ownSession(studentId, sessionId), or(isNull(studySession.turnStartedAt), lt(studySession.turnStartedAt, sql`now() - ${STALE_TURN}`))),
        )
        .returning({ id: studySession.id });
      return started.length > 0;
    },

    async endTurn(sessionId: string) {
      await db.update(studySession).set({ turnStartedAt: null }).where(eq(studySession.id, sessionId));
    },

    /** The last messages of the session, oldest first, with what the tutor's replay. */
    async window(sessionId: string, limit: number) {
      const rows = await db
        .select({ role: message.role, text: message.text, modelMessages: message.modelMessages })
        .from(message)
        .where(eq(message.sessionId, sessionId))
        .orderBy(desc(message.position))
        .limit(limit);
      return rows.reverse();
    },

    /** The first subject the analysis names stays the session's; a later one does not replace it. */
    async setSubject(sessionId: string, subject: Exclude<SubjectFamily, 'general'>) {
      await db
        .update(studySession)
        .set({ subject })
        .where(and(eq(studySession.id, sessionId), isNull(studySession.subject)));
    },

    /** A turn answered: its messages, its change on the exercise and its record, together. */
    async saveTurn(sessionId: string, exchange: Exchange, change: { exerciseId: string; progress: ExerciseProgress } | null, record: TurnRecord) {
      await db.transaction(async (tx) => {
        await writeExchange(tx, sessionId, exchange);
        if (change) await updateExercise(tx, change.exerciseId, change.progress);
        await tx.insert(turnRecord).values({ sessionId, ...record });
      });
    },

    /**
     * A distress: the event, once per session, the session closed, the fixed reply kept with the
     * message. Every later message of the session gets the same reply.
     */
    async closeForDistress(studentId: string, sessionId: string, source: DistressSource, exchange: Exchange, record: TurnRecord) {
      await db.transaction(async (tx) => {
        await tx.insert(distressEvent).values({ studentId, sessionId, detectedBy: source }).onConflictDoNothing();
        await tx
          .update(studySession)
          .set({ closedAt: sql`now()` })
          .where(and(eq(studySession.id, sessionId), isNull(studySession.closedAt)));
        await writeExchange(tx, sessionId, exchange);
        await tx.insert(turnRecord).values({ sessionId, ...record });
      });
    },
  };
}

export type TutorRepository = ReturnType<typeof createTutorRepository>;
