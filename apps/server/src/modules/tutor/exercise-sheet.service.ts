/**
 * Prepares the sheet of an exercise the student brings: three draws of Small 4 reasoning, in
 * parallel, voted (`exercise-sheet.ts`), then stored as the session's exercise in progress.
 * Reasoning gets no output cap (Victor's decision, 2026-10-04): the timeout bounds the draws.
 */

import { generateStructured } from '../../platform/ai/mistral-client.js';
import { env } from '../../platform/config/env.js';
import { logger } from '../../platform/observability/logger.js';
import { costTrackingService } from '../billing/index.js';
import type { EducationLevelType } from '../../types/index.js';
import { ExerciseSheetSchema, keepKnownNotions, notionsFor, schoolYearOf, sheetMessages, vote, type ExerciseSheet } from './exercise-sheet.js';
import { exerciseSheetsRepository } from './exercise-sheets.repository.js';
import { KEPT_HINTS, type Hint } from './hint-ladder.js';

const EXERCISE_SHEET_PROMPT_VERSION = '2026-10-05';
const DRAWS = 3;
const SHEET_TIMEOUT_MS = 20_000;
// Small 4's model card: « 0.7 for reasoning_effort="high" » (huggingface.co/mistralai/Mistral-Small-4-119B-2603).
const REASONING_TEMPERATURE = 0.7;

interface PrepareSheetParams {
  userId: string;
  sessionId: string;
  level: EducationLevelType;
  subject: string | undefined;
  studentText: string;
  /** The texts read from the session's files, oldest first, fenced. */
  attachedFilesBlock: string | null;
}

/** The exercise in progress, its id null when it could not be stored. */
export interface ExerciseState {
  id: string | null;
  /** Null when no draw succeeded: the exercise has no sheet, and the previous one is not taken back. */
  sheet: ExerciseSheet | null;
  uncertain: boolean;
  hintLevel: number;
  stepsDone: number;
  /** The tutor's last messages on the exercise. */
  hints: Hint[];
  /** Ended by a right final answer; a new attempt reopens it. */
  solved: boolean;
}

/** The exercise the student brings, its sheet voted and stored. */
export async function prepareExerciseSheet(params: PrepareSheetParams): Promise<ExerciseState> {
  const startTime = Date.now();
  const notions = notionsFor(params.level, params.subject, schoolYearOf(new Date()));
  const messages = sheetMessages(params.level, notions, params.studentText, params.attachedFilesBlock);

  const draws = await Promise.allSettled(Array.from({ length: DRAWS }, () => generateStructured({
    functionId: 'exercise-sheet',
    messages,
    schema: ExerciseSheetSchema,
    schemaName: 'exercise_sheet',
    reasoningEffort: 'high',
    temperature: REASONING_TEMPERATURE,
    safePrompt: false,
    promptCacheKey: `exercise-sheet-${EXERCISE_SHEET_PROMPT_VERSION}`,
    timeoutMs: SHEET_TIMEOUT_MS,
  })));

  for (const draw of draws) {
    if (draw.status === 'rejected') {
      logger.error('Exercise sheet draw failed', { operation: 'exercise-sheet:draw-error', sessionId: params.sessionId, err: draw.reason, severity: 'medium' as const });
    }
  }
  const results = draws.flatMap((draw) => (draw.status === 'fulfilled' ? [draw.value] : []));
  // Bookkeeping stays off the turn's critical path; each write logs its own failure.
  void Promise.all(results.map(({ usage }) => costTrackingService.record({
    userId: params.userId,
    sessionId: params.sessionId,
    aiModel: env.MISTRAL_MODEL,
    operation: 'exercise-sheet',
    tokensInput: usage.inputTokens,
    tokensOutput: usage.outputTokens,
    cachedTokens: usage.cachedInputTokens,
  })));
  const kept = results.map(({ object }) => keepKnownNotions(object, notions));
  const droppedNotions = kept.reduce((sum, { dropped }) => sum + dropped, 0);
  const outputTokens = results.reduce((sum, { usage }) => sum + usage.outputTokens, 0);

  const voted = vote(kept.map(({ sheet }) => sheet));
  logger.info('Exercise sheet prepared', {
    operation: 'exercise-sheet:prepared',
    sessionId: params.sessionId,
    draws: results.length,
    kind: voted?.sheet.kind,
    uncertain: voted?.uncertain,
    mathCheck: voted?.mathCheck,
    droppedNotions,
    outputTokens,
    durationMs: Date.now() - startTime,
  });
  if (!voted) {
    logger.error('Exercise sheet failed: no draw succeeded', { operation: 'exercise-sheet:error', sessionId: params.sessionId, severity: 'high' as const });
  }
  // Awaited: the turn needs the row to keep the exercise's progress. A failure leaves the turn
  // with its sheet and no progress kept.
  const id = await exerciseSheetsRepository
    .create({
      sessionId: params.sessionId,
      sheet: voted?.sheet ?? null,
      uncertain: voted?.uncertain ?? true,
      mathCheck: voted?.mathCheck ?? 'not-applicable',
      promptVersion: EXERCISE_SHEET_PROMPT_VERSION,
    })
    .catch((err: unknown) => {
      logger.error('Exercise sheet not stored', { operation: 'exercise-sheet:store-error', sessionId: params.sessionId, err, severity: 'high' as const });
      return null;
    });
  return { id, sheet: voted?.sheet ?? null, uncertain: voted?.uncertain ?? true, hintLevel: 0, stepsDone: 0, hints: [], solved: false };
}

/** The session's last exercise, solved or not: its statement stays before the tutor. */
export async function currentExercise(sessionId: string): Promise<ExerciseState | null> {
  const row = await exerciseSheetsRepository.findLatest(sessionId);
  if (!row) return null;
  return {
    id: row.id,
    sheet: row.sheet,
    uncertain: row.uncertain,
    hintLevel: row.hintLevel,
    stepsDone: row.stepsDone,
    hints: row.hints.slice(-KEPT_HINTS),
    solved: row.solvedAt !== null,
  };
}
