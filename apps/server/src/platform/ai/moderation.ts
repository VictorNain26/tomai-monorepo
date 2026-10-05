/**
 * Mistral moderation of what reaches the student (https://docs.mistral.ai/studio/safety-moderation).
 * `mistral-moderation-2603` is free (its model card) and served on the EU endpoint. Each category
 * comes with a score and a flag at Mistral's threshold, « determined based on the optimal
 * performance of our internal test set »: without a measure of our own, the flag rules.
 */

import type { ModerationObject } from '@mistralai/mistralai/models/components';
import { logger } from '../observability/logger.js';
import { getMistralSdk } from './mistral-sdk.js';

const MODERATION_MODEL = 'mistral-moderation-2603';
const MODERATION_TIMEOUT_MS = 5_000;

/**
 * The categories that hold back an output. `health`, `financial` and `law` stay out (a biology or
 * civics lesson touches them), `pii` too (the tutor calls the student by their first name), and
 * `jailbreaking`, which concerns the input.
 */
export const OUTPUT_BLOCKING = ['sexual', 'hate_and_discrimination', 'violence_and_threats', 'dangerous', 'criminal', 'selfharm'] as const;

function blocking(result: ModerationObject | undefined): string[] {
  const flagged = OUTPUT_BLOCKING.filter((category) => result?.categories?.[category] === true);
  if (flagged.length > 0) {
    logger.warn('Output flagged by moderation', {
      operation: 'moderation:flagged',
      categories: flagged,
      scores: Object.fromEntries(flagged.map((category) => [category, result?.categoryScores?.[category]])),
    });
  }
  return flagged;
}

/** The blocking categories of the tutor's reply, read with the student's message for context. Throws when moderation is unavailable. */
export async function moderateReply(studentText: string, reply: string): Promise<string[]> {
  const response = await getMistralSdk().classifiers.moderateChat(
    { model: MODERATION_MODEL, inputs: [{ role: 'user', content: studentText }, { role: 'assistant', content: reply }] },
    { timeoutMs: MODERATION_TIMEOUT_MS },
  );
  return blocking(response.results[0]);
}

/** The blocking categories of each text, in order. Throws when moderation is unavailable. */
export async function moderateTexts(texts: readonly string[]): Promise<string[][]> {
  if (texts.length === 0) return [];
  const response = await getMistralSdk().classifiers.moderate(
    { model: MODERATION_MODEL, inputs: [...texts] },
    { timeoutMs: MODERATION_TIMEOUT_MS },
  );
  return texts.map((_, index) => blocking(response.results[index]));
}
