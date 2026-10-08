/**
 * The exercise side of a turn: the exercise in progress (a new one prepared, else the session's),
 * the diagnosis of what the student proposes, the level decided by the code, the contract the
 * writer follows (`ladder.ts`). Nothing is stored here: the turn records the change once the
 * student has seen the answer. Without a sheet the contract keeps the help low; on a solved
 * exercise without a new attempt, there is none.
 */

import type { Logger } from 'pino';
import type { MathCheck } from '../../../domain/exercise-math';
import { findLeakForm } from '../../../domain/leak';
import type { SchoolLevel } from '../../../domain/levels';
import type { SubjectFamily } from '../../../domain/subjects';
import type { Ai } from '../../../platform/ai/client';
import type { TurnAnalysis } from './analysis';
import { diagnose, type Diagnosis } from './diagnosis';
import { applyChange, levelChange, topLevel, turnContract, type Hint } from './ladder';
import { prepareSheet, type ExerciseSheet } from './sheet';

/** The exercise in progress, as the session keeps it. */
export interface ExerciseState {
  /** Null when no draw succeeded: the exercise is followed, its help kept low. */
  sheet: ExerciseSheet | null;
  uncertain: boolean;
  /** The answer's forms in every draw, which an uncertain sheet is held to. */
  drawnForms: string[];
  hintLevel: number;
  stepsDone: number;
  /** Turns in a row where the student said they were stuck, without trying. */
  stuckTurns: number;
  /** The tutor's last messages on the exercise. */
  hints: Hint[];
  /** Ended by a right final answer; a new attempt reopens it. */
  solved: boolean;
}

/** What the turn changes on the exercise in progress, recorded once the student has seen the answer. */
export interface ExerciseChange {
  hintLevel: number;
  stuckTurns: number;
  stepDone: boolean;
  /** Set by an attempt: a right final answer ends the exercise, any other reopens it. */
  solved: boolean | undefined;
}

export interface ExerciseTurn {
  /** The exercise of this turn; `isNew` when the student brought it. */
  exercise: ExerciseState | null;
  isNew: boolean;
  /** What mathjs said of a new sheet's answer; null for the exercise in progress. */
  mathCheck: MathCheck | null;
  diagnosis: Diagnosis | null;
  /** The level of this turn's help, null without a contract. */
  hintLevel: number | null;
  contract: string | null;
  change: ExerciseChange | null;
}

export interface ExerciseTurnRequest {
  studentId: string;
  level: SchoolLevel;
  subject: SubjectFamily | undefined;
  analysis: TurnAnalysis;
  /** The session's exercise before this turn. */
  current: ExerciseState | null;
  studentText: string;
  lastTutorText: string | null;
  attachedFilesBlock: string | null;
  now: Date;
}

const MIN_RESTATED = 12;

/**
 * Whether the turn draws a new sheet, the long part of a turn. The statement in progress pasted
 * again with a new try is the same exercise, which the analysis took for a new one (measured
 * 2026-10-05): a new sheet would reset the level. A short statement (« Conjugue », the rest on a
 * photo) would match any message.
 */
export function drawsSheet({ analysis, current, studentText }: Pick<ExerciseTurnRequest, 'analysis' | 'current' | 'studentText'>): boolean {
  const statement = current?.sheet?.statement.trim() ?? '';
  const restated = statement.length >= MIN_RESTATED && findLeakForm(studentText, [statement]) !== null;
  return analysis.bringsExercise && !restated;
}

export async function prepareExerciseTurn(deps: { ai: Ai; logger: Logger }, request: ExerciseTurnRequest): Promise<ExerciseTurn> {
  const { analysis, current } = request;
  const drawn = drawsSheet(request) ? await prepareSheet(deps, request) : null;
  // Draws that all failed never replace a watched exercise: its answer stays watched.
  const prepared = drawn?.sheet === null && current?.sheet ? null : drawn;
  if (drawn && !prepared) deps.logger.warn('Sheet failed: the exercise in progress stays');
  const exercise: ExerciseState | null = prepared
    ? {
        sheet: prepared.sheet,
        uncertain: prepared.uncertain,
        drawnForms: prepared.drawnForms,
        hintLevel: 0,
        stepsDone: 0,
        stuckTurns: 0,
        hints: [],
        solved: false,
      }
    : current;
  const isNew = prepared !== null;
  const attempt = analysis.proposesAnswer;
  const mathCheck = prepared?.mathCheck ?? null;
  if (!exercise || (exercise.solved && !attempt))
    return { exercise, isNew, mathCheck, diagnosis: null, hintLevel: null, contract: null, change: null };

  // An uncertain sheet cannot judge, nor a missing one: no diagnosis is asked of them.
  const diagnosis =
    attempt && exercise.sheet && !exercise.uncertain
      ? await diagnose(deps, exercise.sheet, { studentId: request.studentId, studentText: request.studentText, lastTutorText: request.lastTutorText })
      : null;
  const { change, stuckTurns } = levelChange({
    attempt,
    verdict: diagnosis?.verdict ?? null,
    uncertain: exercise.uncertain,
    stuck: analysis.saysStuck,
    stuckTurns: exercise.stuckTurns,
  });
  const hintLevel = applyChange(exercise.hintLevel, change, topLevel(exercise.uncertain));
  const stepDone = diagnosis?.verdict === 'right-step';

  return {
    exercise,
    isNew,
    mathCheck,
    diagnosis,
    hintLevel,
    change: { hintLevel, stuckTurns, stepDone, solved: attempt ? diagnosis?.verdict === 'correct' : undefined },
    contract: turnContract({
      sheet: exercise.sheet,
      uncertain: exercise.uncertain,
      level: hintLevel,
      attempt,
      asksSolution: analysis.asksSolution,
      diagnosis,
      stepsDone: exercise.stepsDone + (stepDone ? 1 : 0),
      hints: exercise.hints,
    }),
  };
}
