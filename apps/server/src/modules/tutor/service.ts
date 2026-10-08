/**
 * What a signed-in student does with their sessions, and a turn of the tutor: the student's
 * message filtered (moderation and distress), understood (the analysis), anchored (the exercise's
 * sheet), decided (diagnosis and level, by the code), written, checked, then stored with the
 * record of what was decided. Only a student reaches them, but the summary of the week, which a
 * guardian of their household reads too: never the conversations.
 */

import type { Logger } from 'pino';
import { detectDistress, DISTRESS_REPLY, type DistressSource } from '../../domain/distress';
import type { MemoryAnswer } from '../../domain/memory-consent';
import { DAILY_BUDGET_MICRO_EUR, QUOTA_RESET_HOUR, quotaDayStart } from '../../domain/quota';
import type { Ai } from '../../platform/ai/client';
import type { InputModeration, Moderation } from '../../platform/ai/moderation';
import { Problem } from '../../platform/http/problem';
import type { StudentDirectory } from '../household';
import { analyseTurn, turnInstruction, type TurnAnalysis } from './core/analysis';
import { assembleChatPrompt, replayable, type HistoryTurn } from './core/assembler';
import { writeChecked } from './core/controlled-turn';
import { prepareExerciseTurn } from './core/exercise-turn';
import { hintOf } from './core/ladder';
import { learnerMemoryBlock, notionMemories, notionView, schoolYearStart } from './core/memory';
import type { OutputCheckContext } from './core/output-check';
import { studentBlock, subjectBlock, systemPrompt } from './core/prompt';
import { routeReasoningEffort } from './core/reasoning';
import { exerciseBlock, notionText, SHEET_PROMPT_VERSION } from './core/sheet';
import { RECENT_MESSAGES, SUMMARY_BACKLOG, summarize } from './core/summary';
import { titleFor } from './core/title';
import { weekStart, weekSummary } from './core/week-summary';
import { TURN_PROMPT_VERSION } from './core/version';
import type { TutorRepository } from './repository';

/** The messages after the summary the tutor reads back: room for one summary late or failed, so that none falls between it and the window. */
const WINDOW = 2 * SUMMARY_BACKLOG;

interface Deps {
  repository: TutorRepository;
  students: StudentDirectory;
  ai: Ai;
  moderation: Moderation;
  logger: Logger;
  /** Work after the reply, which the shutdown waits for: the title, the summary. */
  background: (task: Promise<unknown>) => void;
}

export interface TurnInput {
  text: string;
  inputMode: 'text' | 'voice';
}

/** The turn's reply, and what runs after it, once the session is free. */
interface TurnReply {
  text: string;
  after: (() => Promise<void>) | null;
}

type Student = NonNullable<Awaited<ReturnType<StudentDirectory['find']>>>;

/** A turn opened by `openTurn`: the student, their session as the lock read it, and when the turn started. */
export interface OpenTurn {
  student: Student;
  session: {
    id: string;
    title: string | null;
    subject: TurnAnalysis['subject'] | null;
    summary: string | null;
    summaryUntil: number | null;
    closedAt: Date | null;
    turnStartedAt: Date;
  };
  /** A distress already seen past the quota: the turn answers it, and nothing else. */
  distress: { source: DistressSource; flagged: string[] | null } | null;
}

const analysisRecord = ({ error, ...analysis }: TurnAnalysis) => (error === undefined ? analysis : null);

export function createTutorService({ repository, students, ai, moderation, logger, background }: Deps) {
  const { model } = ai;
  const student = async (userId: string) => {
    const profile = await students.find(userId);
    if (!profile) throw new Problem('FORBIDDEN');
    return profile;
  };

  /** What the student's exercises before `before` say of `notions` (of every notion when null): what Tom reads, what the student sees. */
  async function memoriesOf(learner: Student, notions: readonly string[] | null, before: number | null) {
    const [past, resets] = await Promise.all([
      repository.pastExercises(learner.id, { since: schoolYearStart(new Date()), after: learner.memory.resetAfter, by: 'start' }, before, notions),
      repository.notionResets(learner.id),
    ]);
    return notionMemories(past, resets);
  }

  /** The student's summary of the week: the same for them and for their guardian. */
  async function summaryOf(studentId: string) {
    const since = weekStart(new Date());
    const [messages, exercises, resets] = await Promise.all([
      repository.messagesSince(studentId, since),
      repository.pastExercises(studentId, { since, after: 0, by: 'turn' }, null, null),
      repository.notionResets(studentId),
    ]);
    return weekSummary(messages, exercises, resets);
  }

  /** The learner memory of the exercise's notions, from the exercises before it; null while it is not active. */
  async function memoryOf(learner: Student, notions: readonly string[], before: number | null) {
    if (learner.memory.state !== 'active' || notions.length === 0) return null;
    return learnerMemoryBlock(notions, await memoriesOf(learner, notions, before));
  }

  /** The student's message moderated; null when moderation could not answer, the rules then judging distress alone. */
  const moderateInput = (lastTutorText: string | null, text: string): Promise<InputModeration | null> =>
    moderation.studentTurn(lastTutorText, text).catch((err: unknown) => {
      logger.error({ err }, 'Input moderation unavailable, distress judged by the rules alone');
      return null;
    });

  const fixed = { model, promptVersion: TURN_PROMPT_VERSION, newExercise: false, findings: [] };
  const fixedReply = (studentText: string) => ({ studentText, tutorText: DISTRESS_REPLY, replay: null });

  /** The fixed reply to a distress, the event recorded and the session closed; no failure to store it keeps the reply from the student. */
  async function answerDistress(studentId: string, sessionId: string, studentText: string, distress: NonNullable<OpenTurn['distress']>) {
    await repository
      .closeForDistress(studentId, sessionId, distress.source, fixedReply(studentText), {
        ...fixed,
        inputFlagged: distress.flagged,
        outcome: 'distress',
      })
      .catch((err: unknown) => {
        logger.error({ err }, 'Distress not stored');
      });
    return DISTRESS_REPLY;
  }

  /** After the reply: the title of the session's first turn, and the summary once enough messages wait. */
  async function afterTurn(
    studentId: string,
    session: OpenTurn['session'],
    turn: { studentText: string; tutorText: string; check: OutputCheckContext; first: boolean },
  ) {
    try {
      // The first turn only: a title held back is not asked again of every later turn.
      if (!session.title && turn.first) {
        const title = await titleFor({ ai, moderation, logger }, { studentId, ...turn });
        if (title) await repository.setTitle(session.id, title);
      }
      if ((await repository.countAfter(session.id, session.summaryUntil)) < SUMMARY_BACKLOG) return;
      const covered = (await repository.messagesAfter(session.id, session.summaryUntil)).slice(0, -RECENT_MESSAGES);
      const last = covered.at(-1);
      if (!last) return;
      const summary = await summarize({ ai, logger }, { studentId, previous: session.summary, messages: covered });
      if (summary) await repository.replaceSummary(session.id, session.summaryUntil, summary, last.position);
    } catch (err) {
      logger.error({ err }, 'After the turn: title or summary not stored');
    }
  }

  async function turn({ student: learner, session, distress }: OpenTurn, input: TurnInput): Promise<TurnReply> {
    const studentText = input.text;

    // The conversation stopped at a distress: any later message gets the fixed reply again.
    if (session.closedAt) {
      await repository
        .saveTurn(session.id, {
          exchange: fixedReply(studentText),
          subject: null,
          newExercise: null,
          exerciseId: null,
          progress: null,
          record: { ...fixed, outcome: 'closed' },
        })
        .catch((err: unknown) => {
          logger.error({ err }, 'Closed session turn not stored');
        });
      return { text: DISTRESS_REPLY, after: null };
    }

    if (distress) return { text: await answerDistress(learner.id, session.id, studentText, distress), after: null };

    const [history, current] = await Promise.all([
      repository.window(session.id, WINDOW, session.summaryUntil),
      repository.currentExercise(learner.id, session.id),
    ]);
    const lastTutorText = history.findLast((row) => row.role === 'tutor')?.text ?? null;
    // Started together; the distress waits for the moderation only, and drops the analysis.
    const analysed = analyseTurn(
      { ai, logger },
      { studentId: learner.id, studentText, lastTutorText, currentStatement: current?.sheet?.statement ?? null },
    );
    const inputModeration = await moderateInput(lastTutorText, studentText);

    // Distress before anything else: no sheet, no tutor, the fixed reply.
    const source = detectDistress(studentText, inputModeration?.flagged.includes('selfharm') ?? false);
    if (source)
      return { text: await answerDistress(learner.id, session.id, studentText, { source, flagged: inputModeration?.flagged ?? null }), after: null };
    const analysis = await analysed;

    // The detected subject, else the session's: the first one named stays the session's.
    const detected = analysis.subject === 'general' ? null : analysis.subject;
    const subject = detected ?? session.subject ?? undefined;

    const exerciseTurn = await prepareExerciseTurn(
      { ai, logger },
      {
        studentId: learner.id,
        level: learner.level,
        subject,
        analysis,
        current: current ?? null,
        studentText,
        lastTutorText,
        attachedFilesBlock: null,
        now: new Date(),
      },
    );
    const { exercise, diagnosis, contract, change, hintLevel } = exerciseTurn;
    // From the exercises before this one: the same block at every turn of it, in the cache.
    const memory = exercise?.sheet ? await memoryOf(learner, exercise.sheet.entries, exerciseTurn.isNew ? null : (current?.position ?? null)) : null;

    const system = systemPrompt(learner.level);
    const instruction = contract ?? turnInstruction(analysis);
    const window = history.map((row): HistoryTurn => {
      const modelMessages = row.role === 'tutor' ? replayable(row.modelMessages) : undefined;
      return { role: row.role === 'student' ? 'user' : 'assistant', content: row.text, ...(modelMessages && { modelMessages }) };
    });
    const messages = (extra: string | null) =>
      assembleChatPrompt({
        systemPrompt: system,
        studentBlock: studentBlock(learner.name),
        exerciseBlock: exercise?.sheet ? exerciseBlock(exercise.sheet, memory) : null,
        conversationSummary: session.summary,
        history: window,
        subjectBlock: subjectBlock(subject),
        turnInstruction: [instruction, extra].filter((block): block is string => block !== null).join('\n\n') || null,
        inputMode: input.inputMode,
        studentText,
      }).messages;
    const reasoningEffort = routeReasoningEffort({ schoolLevel: learner.level, subject, analysis, contracted: contract !== null });
    const check: OutputCheckContext = {
      sheet: exercise?.sheet ?? null,
      uncertain: exercise?.uncertain ?? false,
      drawnForms: exercise?.drawnForms ?? [],
      diagnosis,
      studentText,
      pastStudentTexts: history.filter((row) => row.role === 'student').map((row) => row.text),
    };

    const reply = await writeChecked(
      { ai, moderation, logger },
      { studentId: learner.id, sessionId: session.id, system, messages, reasoningEffort },
      check,
    );

    // A fixed reply gave none of the help the level allowed: the exercise does not move.
    const helped = reply.outcome !== 'fallback';
    await repository.saveTurn(session.id, {
      exchange: { studentText, tutorText: reply.text, replay: reply.replay },
      subject: session.subject ? null : detected,
      newExercise:
        exerciseTurn.isNew && exercise
          ? {
              sheet: exercise.sheet,
              uncertain: exercise.uncertain,
              drawnForms: exercise.drawnForms,
              mathCheck: exerciseTurn.mathCheck ?? 'not-applicable',
              promptVersion: SHEET_PROMPT_VERSION,
            }
          : null,
      exerciseId: exerciseTurn.isNew ? null : (current?.id ?? null),
      progress: helped && change && hintLevel !== null ? { ...change, hint: hintOf(hintLevel, reply.text) } : null,
      record: {
        analysis: analysisRecord(analysis),
        inputFlagged: inputModeration?.flagged ?? null,
        newExercise: exerciseTurn.isNew,
        hintLevel,
        verdict: diagnosis?.verdict ?? null,
        errorType: diagnosis?.errorType ?? null,
        decidedBy: diagnosis?.decidedBy ?? null,
        reasoningEffort,
        model,
        promptVersion: TURN_PROMPT_VERSION,
        findings: reply.findings.map((finding) => finding.kind),
        outcome: reply.outcome,
      },
    });
    const first = history.length === 0;
    return { text: reply.text, after: () => afterTurn(learner.id, session, { studentText, tutorText: reply.text, check, first }) };
  }

  return {
    /** What Tom keeps of the student, notion by notion, and whether they may say yes or no to it. */
    async memory(userId: string) {
      const learner = await student(userId);
      const { state, mayAnswer } = learner.memory;
      return { state, mayAnswer, notions: state === 'active' ? (await memoriesOf(learner, null, null)).map(notionView) : [] };
    },

    async answerMemory(userId: string, answer: MemoryAnswer) {
      const learner = await student(userId);
      if (!learner.memory.mayAnswer) throw new Problem('FORBIDDEN');
      // Accepted or declined, the memory starts afresh with the answer: no exercise begun before counts.
      await students.answerMemory(learner.id, answer, await repository.allocatedPosition());
    },

    async resetMemory(userId: string) {
      await students.resetMemory((await student(userId)).id, await repository.allocatedPosition());
    },

    /** The student understood a notion: its earlier exercises no longer count. */
    async resetNotion(userId: string, notionId: string) {
      const learner = await student(userId);
      if (!notionText(notionId)) throw new Problem('NOT_FOUND');
      await repository.resetNotion(learner.id, notionId);
    },

    /** The signed-in student's summary of the week. */
    async summary(userId: string) {
      return summaryOf((await student(userId)).id);
    },

    /** A student's summary of the week, for a guardian of their household; anyone else finds no such student. */
    async summaryFor(guardianId: string, studentId: string) {
      if (!(await students.inHousehold(guardianId, studentId))) throw new Problem('NOT_FOUND');
      return summaryOf(studentId);
    },

    async startSession(userId: string) {
      await student(userId);
      return repository.createSession(userId);
    },

    async listSessions(userId: string) {
      await student(userId);
      return repository.listSessions(userId);
    },

    async listMessages(userId: string, sessionId: string) {
      await student(userId);
      if (!(await repository.findSession(userId, sessionId))) throw new Problem('NOT_FOUND');
      return repository.listMessages(userId, sessionId);
    },

    /**
     * Before the stream: the student, their session, one turn at a time in it, and the day's quota.
     * Past the quota no model writes, but a distress still gets the fixed reply: no limit keeps it
     * from the student. A quota that cannot be read refuses the turn.
     */
    async openTurn(userId: string, sessionId: string, input: TurnInput): Promise<OpenTurn> {
      const learner = await student(userId);
      const started = await repository.startTurn(userId, sessionId);
      if (!started) throw new Problem((await repository.findSession(userId, sessionId)) ? 'TURN_IN_PROGRESS' : 'NOT_FOUND');
      const { turnStartedAt } = started;
      if (!turnStartedAt) throw new Error('Turn started without its time');
      const opened: OpenTurn = {
        student: learner,
        session: {
          id: sessionId,
          title: started.title,
          subject: started.subject,
          summary: started.summary,
          summaryUntil: started.summaryUntil,
          closedAt: started.closedAt,
          turnStartedAt,
        },
        distress: null,
      };
      try {
        // A closed session's fixed reply calls no model.
        if (started.closedAt || (await repository.spentSince(learner.id, quotaDayStart(new Date()))) < DAILY_BUDGET_MICRO_EUR) return opened;
        // Moderated with the tutor's last message, as every turn is: context tells a distress apart.
        const lastTutorText = (await repository.window(sessionId, 2, null)).findLast((row) => row.role === 'tutor')?.text ?? null;
        const moderated = await moderateInput(lastTutorText, input.text);
        const source = detectDistress(input.text, moderated?.flagged.includes('selfharm') ?? false);
        if (!source) throw new Problem('QUOTA_EXCEEDED', `Le quota du jour revient à ${String(QUOTA_RESET_HOUR)} h.`);
        return { ...opened, distress: { source, flagged: moderated?.flagged ?? null } };
      } catch (error) {
        // The refusal reaches the student even when the session cannot be freed: the lock then expires.
        await repository.endTurn(sessionId, turnStartedAt).catch((err: unknown) => {
          logger.error({ err }, 'Session not freed');
        });
        throw error;
      }
    },

    /** The turn's reply; the session is free for the next turn whatever happens. */
    async runTurn(opened: OpenTurn, input: TurnInput): Promise<string> {
      const free = () => repository.endTurn(opened.session.id, opened.session.turnStartedAt);
      let reply: TurnReply;
      try {
        reply = await turn(opened, input);
      } catch (error) {
        await free();
        throw error;
      }
      // The session is free once the reply is stored: the student may answer at once. The title and
      // the summary then run outside the lock, safe without it: the title is asked of the first turn
      // only, and a summary replaces the one it read or nothing. Two may be paid for the same
      // messages when a turn ends while the previous summary runs.
      await free();
      if (reply.after) background(reply.after());
      return reply.text;
    },
  };
}

export type TutorService = ReturnType<typeof createTutorService>;
