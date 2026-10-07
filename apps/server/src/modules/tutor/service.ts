/**
 * What a signed-in student does with their sessions, and a turn of the tutor: the student's
 * message filtered (moderation and distress), understood (the analysis), anchored (the exercise's
 * sheet), decided (diagnosis and level, by the code), written, checked, then stored with the
 * record of what was decided. Only a student reaches them: a guardian follows the work through
 * the parent's summary, never the conversations.
 */

import type { Logger } from 'pino';
import { detectDistress, DISTRESS_REPLY, type DistressSource } from '../../domain/distress';
import { DAILY_BUDGET_MICRO_EUR, quotaDayStart } from '../../domain/quota';
import type { SchoolLevel } from '../../domain/levels';
import type { Ai } from '../../platform/ai/client';
import type { InputModeration, Moderation } from '../../platform/ai/moderation';
import { Problem } from '../../platform/http/problem';
import type { StudentDirectory } from '../household';
import { analyseTurn, turnInstruction, type TurnAnalysis } from './core/analysis';
import { assembleChatPrompt, replayable, type HistoryTurn } from './core/assembler';
import { writeChecked } from './core/controlled-turn';
import { prepareExerciseTurn } from './core/exercise-turn';
import { hintOf } from './core/ladder';
import type { OutputCheckContext } from './core/output-check';
import { studentBlock, subjectBlock, systemPrompt } from './core/prompt';
import { routeReasoningEffort } from './core/reasoning';
import { exerciseBlock, SHEET_PROMPT_VERSION } from './core/sheet';
import { TURN_PROMPT_VERSION } from './core/version';
import type { TutorRepository } from './repository';

/** The messages of the session the tutor reads back; the summary of the older ones comes later. */
const WINDOW = 20;

interface Deps {
  repository: TutorRepository;
  students: StudentDirectory;
  ai: Ai;
  moderation: Moderation;
  logger: Logger;
}

export interface TurnInput {
  text: string;
  inputMode: 'text' | 'voice';
}

/** A turn opened by `openTurn`: the student, their session as the lock read it, and when the turn started. */
export interface OpenTurn {
  student: { id: string; name: string; level: SchoolLevel };
  session: { id: string; subject: TurnAnalysis['subject'] | null; closedAt: Date | null; turnStartedAt: Date };
  /** A distress already seen past the quota: the turn answers it, and nothing else. */
  distress: { source: DistressSource; flagged: string[] | null } | null;
}

const analysisRecord = ({ error, ...analysis }: TurnAnalysis) => (error === undefined ? analysis : null);

export function createTutorService({ repository, students, ai, moderation, logger }: Deps) {
  const { model } = ai;
  const student = async (userId: string) => {
    const profile = await students.find(userId);
    if (!profile) throw new Problem('FORBIDDEN');
    return profile;
  };

  /** The student's message moderated; null when moderation could not answer, the rules then judging distress alone. */
  const moderateInput = (lastTutorText: string | null, text: string): Promise<InputModeration | null> =>
    moderation.studentTurn(lastTutorText, text).catch((err: unknown) => {
      logger.error({ err }, 'Input moderation unavailable, distress judged by the rules alone');
      return null;
    });

  async function turn({ student: learner, session, distress }: OpenTurn, input: TurnInput): Promise<string> {
    const studentText = input.text;
    const fixed = { model, promptVersion: TURN_PROMPT_VERSION, newExercise: false, findings: [] };
    const fixedReply = { studentText, tutorText: DISTRESS_REPLY, replay: null };

    // The conversation stopped at a distress: any later message gets the fixed reply again.
    if (session.closedAt) {
      await repository
        .saveTurn(session.id, {
          exchange: fixedReply,
          subject: null,
          newExercise: null,
          exerciseId: null,
          progress: null,
          record: { ...fixed, outcome: 'closed' },
        })
        .catch((err: unknown) => {
          logger.error({ err }, 'Closed session turn not stored');
        });
      return DISTRESS_REPLY;
    }

    if (distress) {
      await repository
        .closeForDistress(learner.id, session.id, distress.source, fixedReply, { ...fixed, inputFlagged: distress.flagged, outcome: 'distress' })
        .catch((err: unknown) => {
          logger.error({ err }, 'Distress not stored');
        });
      return DISTRESS_REPLY;
    }

    const [history, current] = await Promise.all([repository.window(session.id, WINDOW), repository.currentExercise(learner.id, session.id)]);
    const lastTutorText = history.findLast((row) => row.role === 'tutor')?.text ?? null;
    // Started together; the distress waits for the moderation only, and drops the analysis.
    const analysed = analyseTurn(
      { ai, logger },
      { studentId: learner.id, studentText, lastTutorText, currentStatement: current?.sheet?.statement ?? null },
    );
    const inputModeration = await moderateInput(lastTutorText, studentText);

    // Distress before anything else: no sheet, no tutor, the fixed reply. No failure to store it
    // keeps the reply from the student.
    const source = detectDistress(studentText, inputModeration?.flagged.includes('selfharm') ?? false);
    if (source) {
      await repository
        .closeForDistress(learner.id, session.id, source, fixedReply, {
          ...fixed,
          inputFlagged: inputModeration?.flagged ?? null,
          outcome: 'distress',
        })
        .catch((err: unknown) => {
          logger.error({ err }, 'Distress not stored');
        });
      return DISTRESS_REPLY;
    }
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
        exerciseBlock: exercise?.sheet ? exerciseBlock(exercise.sheet) : null,
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
        decidedBy: diagnosis?.decidedBy ?? null,
        reasoningEffort,
        model,
        promptVersion: TURN_PROMPT_VERSION,
        findings: reply.findings.map((finding) => finding.kind),
        outcome: reply.outcome,
      },
    });
    return reply.text;
  }

  return {
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
        session: { id: sessionId, subject: started.subject, closedAt: started.closedAt, turnStartedAt },
        distress: null,
      };
      try {
        // A closed session's fixed reply calls no model.
        if (started.closedAt || (await repository.spentSince(learner.id, quotaDayStart(new Date()))) < DAILY_BUDGET_MICRO_EUR) return opened;
        const moderated = await moderateInput(null, input.text);
        const source = detectDistress(input.text, moderated?.flagged.includes('selfharm') ?? false);
        if (!source) throw new Problem('QUOTA_EXCEEDED', 'Le quota du jour revient à 4 h.');
        return { ...opened, distress: { source, flagged: moderated?.flagged ?? null } };
      } catch (error) {
        await repository.endTurn(sessionId, turnStartedAt);
        throw error;
      }
    },

    /** The turn's reply; the session is free for the next turn whatever happens. */
    async runTurn(opened: OpenTurn, input: TurnInput): Promise<string> {
      try {
        return await turn(opened, input);
      } finally {
        await repository.endTurn(opened.session.id, opened.session.turnStartedAt);
      }
    },
  };
}

export type TutorService = ReturnType<typeof createTutorService>;
