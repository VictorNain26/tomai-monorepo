/**
 * The exercise side of a turn: the exercise in progress (a new one prepared, else the session's),
 * the diagnosis of what the student proposes, the level decided by the code, the contract the
 * writer follows (`hint-ladder.ts`). Nothing is stored here: what the turn changes is recorded once
 * the student has seen the answer (`finishTurn`). Without a sheet, or on a solved exercise without
 * a new attempt, there is no contract.
 */

import type { EducationLevelType } from '../../types/index.js';
import type { SubjectFamily } from '../../lib/subjects.js';
import { diagnose, type Diagnosis } from './exercise-diagnosis.service.js';
import { prepareExerciseSheet, type ExerciseState } from './exercise-sheet.service.js';
import { applyChange, levelChange, topLevel, turnContract } from './hint-ladder.js';
import { findLeakForm } from '../../lib/leak.js';
import type { TurnAnalysis } from './turn-analysis.service.js';

/** What the turn changes on the exercise, recorded by `finishTurn`. */
export interface ExerciseChange {
  levelChange: number;
  top: number;
  stepDone: boolean;
  solved: boolean | undefined;
}

export interface ExerciseTurn {
  exercise: ExerciseState | null;
  diagnosis: Diagnosis | null;
  /** The level of this turn's help, null without a contract. */
  hintLevel: number | null;
  contract: string | null;
  change: ExerciseChange | null;
}

interface ExerciseTurnParams {
  userId: string;
  sessionId: string;
  level: EducationLevelType;
  subject: SubjectFamily | undefined;
  analysis: TurnAnalysis;
  /** The session's exercise before this turn, read once with the turn's context. */
  current: ExerciseState | null;
  studentText: string;
  lastTutorText: string | null;
  attachedFilesBlock: string | null;
}

export async function prepareExerciseTurn(params: ExerciseTurnParams): Promise<ExerciseTurn> {
  const { userId, sessionId, analysis } = params;
  // The statement in progress pasted again with a new try is the same exercise: the code knows
  // it, the analysis took it for a new one (measured 2026-10-05). A new sheet would reset the level.
  const restated = params.current?.sheet ? findLeakForm(params.studentText, [params.current.sheet.statement]) !== null : false;
  const exercise =
    analysis.bringsExercise && !restated
      ? await prepareExerciseSheet({
          userId,
          sessionId,
          level: params.level,
          subject: params.subject,
          studentText: params.studentText,
          attachedFilesBlock: params.attachedFilesBlock,
        })
      : params.current;
  const attempt = analysis.proposesAnswer;
  if (!exercise?.sheet || (exercise.solved && !attempt)) return { exercise, diagnosis: null, hintLevel: null, contract: null, change: null };

  // An uncertain sheet cannot judge: no diagnosis is asked of it.
  const diagnosis =
    attempt && !exercise.uncertain
      ? await diagnose(exercise.sheet, { studentText: params.studentText, lastTutorText: params.lastTutorText, userId, sessionId })
      : null;
  const change: ExerciseChange = {
    levelChange: levelChange({ attempt, verdict: diagnosis?.verdict ?? null, uncertain: exercise.uncertain }),
    top: topLevel(exercise.uncertain),
    stepDone: diagnosis?.verdict === 'right-step',
    // A right final answer ends the exercise; any other attempt reopens a solved one.
    solved: attempt ? diagnosis?.verdict === 'correct' : undefined,
  };
  const hintLevel = applyChange(exercise.hintLevel, change.levelChange, change.top);

  return {
    exercise,
    diagnosis,
    hintLevel,
    change,
    contract: turnContract({
      sheet: exercise.sheet,
      uncertain: exercise.uncertain,
      level: hintLevel,
      attempt,
      asksSolution: analysis.asksSolution,
      diagnosis,
      stepsDone: exercise.stepsDone + (change.stepDone ? 1 : 0),
      hints: exercise.hints,
    }),
  };
}
