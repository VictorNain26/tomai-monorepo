/**
 * The exercise side of a turn: the exercise in progress (a new one prepared, else the session's),
 * the diagnosis of what the student proposes, the level decided by the code, the contract the
 * writer follows (`hint-ladder.ts`). Without a sheet, there is no contract.
 */

import { logger } from '../../platform/observability/logger.js';
import type { EducationLevelType } from '../../types/index.js';
import { diagnose, type Diagnosis } from './exercise-diagnosis.service.js';
import { currentExercise, prepareExerciseSheet, type ExerciseState } from './exercise-sheet.service.js';
import { exerciseSheetsRepository } from './exercise-sheets.repository.js';
import { nextLevel, turnContract } from './hint-ladder.js';
import type { TurnAnalysis } from './turn-analysis.service.js';

export interface ExerciseTurn {
  exercise: ExerciseState | null;
  diagnosis: Diagnosis | null;
  /** The level of this turn's help, null without a contract. */
  hintLevel: number | null;
  contract: string | null;
}

interface ExerciseTurnParams {
  userId: string;
  sessionId: string;
  level: EducationLevelType;
  subject: string | undefined;
  analysis: TurnAnalysis;
  studentText: string;
  lastTutorText: string | null;
  attachedFilesBlock: string | null;
}

export async function prepareExerciseTurn(params: ExerciseTurnParams): Promise<ExerciseTurn> {
  const { userId, sessionId, analysis } = params;
  const exercise = analysis.bringsExercise
    ? await prepareExerciseSheet({
      userId,
      sessionId,
      level: params.level,
      subject: params.subject,
      studentText: params.studentText,
      attachedFilesBlock: params.attachedFilesBlock,
    })
    : await currentExercise(sessionId);
  if (!exercise?.sheet) return { exercise, diagnosis: null, hintLevel: null, contract: null };

  const attempt = analysis.proposesAnswer;
  // An uncertain sheet cannot judge: no diagnosis is asked of it.
  const diagnosis = attempt && !exercise.uncertain
    ? await diagnose(exercise.sheet, { studentText: params.studentText, lastTutorText: params.lastTutorText, userId, sessionId })
    : null;
  const hintLevel = nextLevel(exercise.hintLevel, { attempt, verdict: diagnosis?.verdict ?? null, uncertain: exercise.uncertain });
  const solved = diagnosis?.verdict === 'correct';

  if (exercise.id && (hintLevel !== exercise.hintLevel || solved)) {
    void exerciseSheetsRepository.updateProgress(exercise.id, { hintLevel, solved }).catch((err: unknown) => {
      logger.error('Exercise progress not stored', { operation: 'exercise-turn:store-error', sessionId, err, severity: 'medium' as const });
    });
  }

  return {
    exercise,
    diagnosis,
    hintLevel,
    contract: turnContract({
      sheet: exercise.sheet,
      uncertain: exercise.uncertain,
      level: hintLevel,
      attempt,
      asksSolution: analysis.asksSolution,
      diagnosis,
      hints: exercise.hints,
    }),
  };
}
