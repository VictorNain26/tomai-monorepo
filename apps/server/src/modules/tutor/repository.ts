/**
 * The only file of the module that touches the database. A student reaches a session through
 * `ownSession`, a clause of the query itself: another student's session is simply not found.
 */

import { and, asc, count, desc, eq, gt, gte, isNull, sql, sum } from 'drizzle-orm';
import type { DistressSource } from '../../domain/distress';
import type { MathCheck } from '../../domain/exercise-math';
import type { SubjectFamily } from '../../domain/subjects';
import type { ResponseMessage } from '../../platform/ai/client';
import { aiCost } from '../../platform/ai/schema';
import type { Db } from '../../platform/db/client';
import type { ExerciseChange, ExerciseState } from './core/exercise-turn';
import type { Hint } from './core/ladder';
import { distressEvent, exercise, message, studySession, turnRecord } from './schema';

/** The tutor's last messages on an exercise that the contract lists, so as not to repeat them. */
const KEPT_HINTS = 4;

/** Past it, a turn left marked by a crash no longer blocks the session: longer than any turn's calls. */
const STALE_TURN = sql`interval '3 minutes'`;

type Executor = Db | Parameters<Parameters<Db['transaction']>[0]>[0];

export type TurnRecord = Omit<typeof turnRecord.$inferInsert, 'id' | 'sessionId' | 'exerciseId' | 'createdAt'>;

export interface SavedTurn {
  exchange: Exchange;
  /** The subject the analysis named, which the session takes if it has none. */
  subject: Exclude<SubjectFamily, 'general'> | null;
  /** The exercise the student brought this turn, at the first level. */
  newExercise: (Pick<ExerciseState, 'sheet' | 'uncertain' | 'drawnForms'> & { mathCheck: MathCheck; promptVersion: string }) | null;
  /** The exercise in progress, when no new one comes. */
  exerciseId: string | null;
  /** What the turn changes on the exercise, the student having read the help it allowed. */
  progress: ExerciseProgress | null;
  record: TurnRecord;
}

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

    /**
     * Marks a turn as running in the student's session, and reads the session in the same
     * statement: a session closed by the turn before is seen closed. Undefined when a turn of the
     * student already runs, in this session or another, or when the session is not theirs.
     */
    async startTurn(studentId: string, sessionId: string) {
      return db.transaction(async (tx) => {
        // One turn at a time for the student, whatever the session: turns in parallel sessions would
        // all pass the same quota check. The lock serialises this student's starts until the commit.
        await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`turn:${studentId}`}))`);
        const [running] = await tx
          .select({ id: studySession.id })
          .from(studySession)
          .where(and(eq(studySession.studentId, studentId), gte(studySession.turnStartedAt, sql`now() - ${STALE_TURN}`)))
          .limit(1);
        if (running) return undefined;
        const [started] = await tx
          .update(studySession)
          // To the millisecond, as a JavaScript Date holds it: endTurn compares it back.
          .set({ turnStartedAt: sql`date_trunc('milliseconds', now())` })
          .where(ownSession(studentId, sessionId))
          .returning({
            title: studySession.title,
            subject: studySession.subject,
            summary: studySession.summary,
            summaryUntil: studySession.summaryUntil,
            closedAt: studySession.closedAt,
            turnStartedAt: studySession.turnStartedAt,
          });
        return started;
      });
    },

    /** Frees the session, unless another turn took over a lock this one held too long. */
    async endTurn(sessionId: string, startedAt: Date) {
      await db
        .update(studySession)
        .set({ turnStartedAt: null })
        .where(and(eq(studySession.id, sessionId), eq(studySession.turnStartedAt, startedAt)));
    },

    /** What the student's AI calls cost since an instant, in micro-euros. */
    async spentSince(studentId: string, since: Date) {
      const [row] = await db
        .select({ spent: sum(aiCost.costMicroEur).mapWith(Number) })
        .from(aiCost)
        .where(and(eq(aiCost.studentId, studentId), gte(aiCost.createdAt, since)));
      return row?.spent ?? 0;
    },

    /** The last messages of the session after the summary's, oldest first, with what the tutor's replay. */
    async window(sessionId: string, limit: number, after: number | null) {
      const rows = await db
        .select({ role: message.role, text: message.text, modelMessages: message.modelMessages })
        .from(message)
        .where(and(eq(message.sessionId, sessionId), after === null ? undefined : gt(message.position, after)))
        .orderBy(desc(message.position))
        .limit(limit);
      return rows.reverse();
    },

    /** How many messages of the session follow the summary's: a summary is due past a backlog. */
    async countAfter(sessionId: string, after: number | null) {
      const [row] = await db
        .select({ count: count() })
        .from(message)
        .where(and(eq(message.sessionId, sessionId), after === null ? undefined : gt(message.position, after)));
      return row?.count ?? 0;
    },

    /** Every message of the session after the summary's, oldest first. */
    messagesAfter(sessionId: string, after: number | null) {
      return db
        .select({ position: message.position, role: message.role, text: message.text })
        .from(message)
        .where(and(eq(message.sessionId, sessionId), after === null ? undefined : gt(message.position, after)))
        .orderBy(asc(message.position));
    },

    /** The new summary, unless another one was written since `previousUntil` was read: two runs write one. */
    async replaceSummary(sessionId: string, previousUntil: number | null, summary: string, until: number) {
      const replaced = await db
        .update(studySession)
        .set({ summary, summaryUntil: until })
        .where(
          and(
            eq(studySession.id, sessionId),
            previousUntil === null ? isNull(studySession.summaryUntil) : eq(studySession.summaryUntil, previousUntil),
          ),
        )
        .returning({ id: studySession.id });
      return replaced.length > 0;
    },

    /** The session's title, unless it already has one. */
    async setTitle(sessionId: string, title: string) {
      await db
        .update(studySession)
        .set({ title })
        .where(and(eq(studySession.id, sessionId), isNull(studySession.title)));
    },

    /**
     * A turn answered, all of it or nothing: the subject the session takes from its first one, a
     * new exercise, the exercise's change, the messages and the record. The session is the one the
     * turn locked, through the student's ownership (`startTurn`).
     */
    async saveTurn(sessionId: string, turn: SavedTurn) {
      await db.transaction(async (tx) => {
        if (turn.subject) {
          await tx
            .update(studySession)
            .set({ subject: turn.subject })
            .where(and(eq(studySession.id, sessionId), isNull(studySession.subject)));
        }
        const created = turn.newExercise
          ? (
              await tx
                .insert(exercise)
                .values({ sessionId, ...turn.newExercise })
                .returning({ id: exercise.id })
            )[0]?.id
          : undefined;
        const exerciseId = created ?? turn.exerciseId;
        if (exerciseId && turn.progress) await updateExercise(tx, exerciseId, turn.progress);
        await writeExchange(tx, sessionId, turn.exchange);
        await tx.insert(turnRecord).values({ sessionId, exerciseId: exerciseId ?? null, ...turn.record });
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
        await tx.insert(turnRecord).values({ sessionId, exerciseId: null, ...record });
      });
    },
  };
}

export type TutorRepository = ReturnType<typeof createTutorRepository>;
