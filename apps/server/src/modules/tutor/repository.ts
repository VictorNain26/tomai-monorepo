/**
 * The only file of the module that touches the database. A student reaches a session through
 * `ownSession`, a clause of the query itself: another student's session is simply not found.
 */

import { and, asc, count, desc, eq, exists, getTableName, gt, gte, isNotNull, isNull, lt, notExists, or, sql, sum } from 'drizzle-orm';
import type { DistressSource } from '../../domain/distress';
import type { MathCheck } from '../../domain/exercise-math';
import type { SubjectFamily } from '../../domain/subjects';
import type { ResponseMessage } from '../../platform/ai/client';
import { aiCost } from '../../platform/ai/schema';
import type { Db } from '../../platform/db/client';
import type { ExerciseChange, ExerciseState } from './core/exercise-turn';
import type { Hint } from './core/ladder';
import type { PastExercise } from './core/memory';
import type { CueKind } from './core/parent-cues';
import type { WeekMessage } from './core/week-summary';
import { distressEvent, exercise, learnerNotionReset, message, studySession, turnRecord } from './schema';

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
  /** The cue given to the parent beside the child: one more toward the session's cap, the last one. */
  parentCue?: CueKind;
}

/** The two messages of a turn: what the student wrote and the text of their photo, what they read, and how to replay it. */
interface Exchange {
  studentText: string;
  photoText: string | null;
  tutorText: string;
  replay: ResponseMessage[] | null;
}

async function writeExchange(executor: Executor, sessionId: string, { studentText, photoText, tutorText, replay }: Exchange) {
  await executor.insert(message).values({ sessionId, role: 'student', text: studentText, photoText });
  const [tutor] = await executor
    .insert(message)
    .values({ sessionId, role: 'tutor', text: tutorText, modelMessages: replay })
    .returning({ id: message.id });
  return tutor?.id;
}

const ownSession = (studentId: string, sessionId: string) => and(eq(studySession.id, sessionId), eq(studySession.studentId, studentId));

/**
 * The last exercise position handed out, committed or not: a reset leaves out every exercise begun
 * before it, the one a turn is still writing too. Positions only grow, where the clock can step
 * back and count an exercise forgotten, or forget a later one.
 * https://www.postgresql.org/docs/current/view-pg-sequences.html
 */
const allocatedPosition = sql<number>`coalesce((select last_value from pg_sequences where quote_ident(schemaname) || '.' || quote_ident(sequencename) = pg_get_serial_sequence(${getTableName(exercise)}, ${exercise.position.name})), 0)`;

const sessionColumns = {
  id: studySession.id,
  title: studySession.title,
  accompanied: studySession.accompanied,
  closedAt: studySession.closedAt,
  createdAt: studySession.createdAt,
};

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
    /**
     * A new session, or the latest one nothing was said in yet, with the parent beside or not:
     * tapping again piles up no empty one, and takes the new choice.
     */
    async createSession(studentId: string, accompanied: boolean) {
      const [empty] = await db
        .select({ id: studySession.id })
        .from(studySession)
        .where(
          and(
            eq(studySession.studentId, studentId),
            notExists(
              db
                .select({ one: sql`1` })
                .from(message)
                .where(eq(message.sessionId, studySession.id)),
            ),
          ),
        )
        .orderBy(desc(studySession.createdAt))
        .limit(1);
      if (empty) {
        // Still empty and idle when it takes the new choice: a first turn running keeps its mode.
        const [reopened] = await db
          .update(studySession)
          .set({ accompanied })
          .where(
            and(
              eq(studySession.id, empty.id),
              isNull(studySession.turnStartedAt),
              notExists(
                db
                  .select({ one: sql`1` })
                  .from(message)
                  .where(eq(message.sessionId, studySession.id)),
              ),
            ),
          )
          .returning(sessionColumns);
        if (reopened) return reopened;
      }
      const [created] = await db.insert(studySession).values({ studentId, accompanied }).returning(sessionColumns);
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

    /** The messages of the student's session, oldest first, whether a photo came with each; none for a session that is not theirs. */
    listMessages(studentId: string, sessionId: string) {
      return db
        .select({
          id: message.id,
          role: message.role,
          text: message.text,
          photo: isNotNull(message.photoText).mapWith(Boolean),
          createdAt: message.createdAt,
        })
        .from(message)
        .innerJoin(studySession, eq(studySession.id, message.sessionId))
        .where(ownSession(studentId, sessionId))
        .orderBy(asc(message.position));
    },

    /** The last exercise of the student's session, solved or not: its statement stays before the tutor. */
    async currentExercise(studentId: string, sessionId: string): Promise<(ExerciseState & { id: string; position: number }) | undefined> {
      const [row] = await db
        .select({ exercise })
        .from(exercise)
        .innerJoin(studySession, eq(studySession.id, exercise.sessionId))
        .where(ownSession(studentId, sessionId))
        .orderBy(desc(exercise.position))
        .limit(1);
      if (!row) return undefined;
      const { id, position, sheet, uncertain, drawnForms, hintLevel, stepsDone, stuckTurns, hints, solvedAt } = row.exercise;
      return { id, position, sheet, uncertain, drawnForms, hintLevel, stepsDone, stuckTurns, hints, solved: solvedAt !== null };
    },

    /**
     * The student's exercises since `since`, begun then (`by: 'start'`) or with a turn then
     * (`by: 'turn'`), after the position `after`, before the one at `before` (all of them when
     * null), on one of `notions` (any when null), oldest first, with their notions and the error
     * types of their turns: what the learner memory and the summary of the week read. Through the
     * student's own sessions only.
     */
    async pastExercises(
      studentId: string,
      { since, after, by }: { since: Date; after: number; by: 'start' | 'turn' },
      before: number | null,
      notions: readonly string[] | null,
    ): Promise<PastExercise[]> {
      const entries = sql`(${exercise.sheet} -> 'entries')`;
      const rows = await db
        .select({
          position: exercise.position,
          entries: sql<string[]>`coalesce(${entries}, '[]'::jsonb)`,
          hintLevel: exercise.hintLevel,
          solvedAt: exercise.solvedAt,
          errorTypes: sql<
            string[]
          >`coalesce((select array_agg(${turnRecord.errorType}) from ${turnRecord} where ${turnRecord.exerciseId} = ${exercise.id} and ${turnRecord.errorType} is not null), '{}')`,
        })
        .from(exercise)
        .innerJoin(studySession, eq(studySession.id, exercise.sessionId))
        .where(
          and(
            eq(studySession.studentId, studentId),
            by === 'start'
              ? gte(exercise.createdAt, since)
              : exists(
                  db
                    .select({ one: sql`1` })
                    .from(turnRecord)
                    .where(and(eq(turnRecord.exerciseId, exercise.id), gte(turnRecord.createdAt, since))),
                ),
            gt(exercise.position, after),
            isNotNull(exercise.sheet),
            ...(before === null ? [] : [lt(exercise.position, before)]),
            ...(notions === null
              ? []
              : [
                  sql`${entries} ?| array[${sql.join(
                    notions.map((notion) => sql`${notion}`),
                    sql`, `,
                  )}]::text[]`,
                ]),
          ),
        )
        .orderBy(asc(exercise.position));
      return rows.map(({ position, entries: notionIds, hintLevel, solvedAt, errorTypes }) => ({
        position,
        entries: notionIds,
        hintLevel,
        solved: solvedAt !== null,
        errorTypes,
      }));
    },

    /**
     * The times of the student's messages since `since`, with their session's subject and opening,
     * grouped by session, in their order; none from the distress that closed a session on.
     */
    async messagesSince(studentId: string, since: Date): Promise<WeekMessage[]> {
      return db
        .select({ sessionId: message.sessionId, subject: studySession.subject, startedAt: studySession.createdAt, at: message.createdAt })
        .from(message)
        .innerJoin(studySession, eq(studySession.id, message.sessionId))
        .where(
          and(
            eq(studySession.studentId, studentId),
            gte(message.createdAt, since),
            or(isNull(studySession.closedAt), lt(message.createdAt, studySession.closedAt)),
          ),
        )
        .orderBy(asc(message.sessionId), asc(message.position));
    },

    /** The notions the student marked as understood, and the last exercise each mark covers. */
    async notionResets(studentId: string) {
      const rows = await db
        .select({ notionId: learnerNotionReset.notionId, afterPosition: learnerNotionReset.afterPosition })
        .from(learnerNotionReset)
        .where(eq(learnerNotionReset.studentId, studentId));
      return new Map(rows.map(({ notionId, afterPosition }) => [notionId, afterPosition]));
    },

    /** The last exercise position handed out, which a reset of the memory keeps. */
    async allocatedPosition(): Promise<number> {
      // last_value is a bigint, which postgres.js reads as a string.
      const [row] = await db.execute<{ position: string }>(sql`select ${allocatedPosition} as position`);
      return Number(row?.position ?? 0);
    },

    /** No exercise begun before now counts for this notion. */
    async resetNotion(studentId: string, notionId: string) {
      await db
        .insert(learnerNotionReset)
        .values({ studentId, notionId, afterPosition: allocatedPosition })
        .onConflictDoUpdate({ target: [learnerNotionReset.studentId, learnerNotionReset.notionId], set: { afterPosition: allocatedPosition } });
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
            accompanied: studySession.accompanied,
            parentCues: studySession.parentCues,
            lastParentCue: studySession.lastParentCue,
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
        .select({ role: message.role, text: message.text, photoText: message.photoText, modelMessages: message.modelMessages })
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
        .select({ position: message.position, role: message.role, text: message.text, photoText: message.photoText })
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

    /** The records of a session's turns, in their order: what the harness reads (src/evaluate.ts). */
    async records(sessionId: string) {
      return db.select().from(turnRecord).where(eq(turnRecord.sessionId, sessionId)).orderBy(turnRecord.createdAt);
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
        if (turn.parentCue) {
          await tx
            .update(studySession)
            .set({ parentCues: sql`${studySession.parentCues} + 1`, lastParentCue: turn.parentCue })
            .where(eq(studySession.id, sessionId));
        }
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
