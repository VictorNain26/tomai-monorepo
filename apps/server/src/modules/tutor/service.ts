/**
 * What a signed-in student does with their sessions, and a turn of the tutor: the student's
 * message filtered (moderation and distress), understood (the analysis), anchored (the exercise's
 * sheet), decided (diagnosis and level, by the code), written, checked, then stored with the
 * record of what was decided. Only a student reaches them: a guardian follows the work through
 * the parent's summary, never the conversations.
 */

import type { Logger } from 'pino';
import { detectDistress, DISTRESS_REPLY } from '../../domain/distress';
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
import { promptVersion, studentBlock, subjectBlock, systemPrompt } from './core/prompt';
import { routeReasoningEffort } from './core/reasoning';
import { exerciseBlock, SHEET_PROMPT_VERSION } from './core/sheet';
import type { TurnRecord, TutorRepository } from './repository';

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

/** A turn opened by `openTurn`: the student, their session, and the turn marked as running. */
export interface OpenTurn {
  student: { id: string; name: string; level: SchoolLevel };
  session: { id: string; subject: TurnAnalysis['subject'] | null; closedAt: Date | null };
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

  async function turn({ student: learner, session }: OpenTurn, input: TurnInput): Promise<string> {
    const studentText = input.text;
    const fixed = { model, promptVersion: promptVersion(DISTRESS_REPLY), newExercise: false, findings: [] };

    // The conversation stopped at a distress: any later message gets the fixed reply again.
    if (session.closedAt) {
      await repository
        .saveTurn(session.id, { studentText, tutorText: DISTRESS_REPLY, replay: null }, null, { ...fixed, outcome: 'closed' })
        .catch((err: unknown) => {
          logger.error({ err }, 'Closed session turn not stored');
        });
      return DISTRESS_REPLY;
    }

    const [history, current] = await Promise.all([repository.window(session.id, WINDOW), repository.currentExercise(learner.id, session.id)]);
    const lastTutorText = history.findLast((row) => row.role === 'tutor')?.text ?? null;
    // Run alongside, neither adding to the wait; the analysis is dropped on a distress.
    const [analysis, inputModeration] = await Promise.all([
      analyseTurn({ ai, logger }, { studentId: learner.id, studentText, lastTutorText, currentStatement: current?.sheet?.statement ?? null }),
      moderateInput(lastTutorText, studentText),
    ]);

    // Distress before anything else: no sheet, no tutor, the fixed reply. No failure to store it
    // keeps the reply from the student.
    const source = detectDistress(studentText, inputModeration?.flagged.includes('selfharm') ?? false);
    if (source) {
      await repository
        .closeForDistress(
          learner.id,
          session.id,
          source,
          { studentText, tutorText: DISTRESS_REPLY, replay: null },
          { ...fixed, inputFlagged: inputModeration?.flagged ?? null, outcome: 'distress' },
        )
        .catch((err: unknown) => {
          logger.error({ err }, 'Distress not stored');
        });
      return DISTRESS_REPLY;
    }

    // The detected subject, else the session's: the first one named stays the session's.
    const detected = analysis.subject === 'general' ? null : analysis.subject;
    const subject = detected ?? session.subject ?? undefined;
    if (detected && !session.subject) await repository.setSubject(session.id, detected);

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
    const exerciseId =
      exerciseTurn.isNew && exercise
        ? await repository.createExercise(learner.id, session.id, {
            sheet: exercise.sheet,
            uncertain: exercise.uncertain,
            drawnForms: exercise.drawnForms,
            mathCheck: exerciseTurn.mathCheck ?? 'not-applicable',
            promptVersion: SHEET_PROMPT_VERSION,
          })
        : current?.id;

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

    const record: TurnRecord = {
      analysis: analysisRecord(analysis),
      inputFlagged: inputModeration?.flagged ?? null,
      exerciseId: exerciseId ?? null,
      newExercise: exerciseTurn.isNew,
      hintLevel,
      verdict: diagnosis?.verdict ?? null,
      decidedBy: diagnosis?.decidedBy ?? null,
      reasoningEffort,
      model,
      promptVersion: promptVersion(system),
      findings: reply.findings.map((finding) => finding.kind),
      outcome: reply.outcome,
    };
    await repository.saveTurn(
      session.id,
      { studentText, tutorText: reply.text, replay: reply.replay },
      change && exerciseId && hintLevel !== null ? { exerciseId, progress: { ...change, hint: hintOf(hintLevel, reply.text) } } : null,
      record,
    );
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

    /** Before the stream: the student, their session, and one turn at a time in it. */
    async openTurn(userId: string, sessionId: string): Promise<OpenTurn> {
      const learner = await student(userId);
      const session = await repository.findSession(userId, sessionId);
      if (!session) throw new Problem('NOT_FOUND');
      if (!(await repository.startTurn(userId, sessionId))) throw new Problem('TURN_IN_PROGRESS');
      return { student: learner, session };
    },

    /** The turn's reply; the session is free for the next turn whatever happens. */
    async runTurn(opened: OpenTurn, input: TurnInput): Promise<string> {
      try {
        return await turn(opened, input);
      } finally {
        await repository.endTurn(opened.session.id);
      }
    },
  };
}

export type TutorService = ReturnType<typeof createTutorService>;
