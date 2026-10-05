/**
 * Mistral moderation of what reaches the student (https://docs.mistral.ai/studio/safety-moderation).
 * `mistral-moderation-2603` is free (its model card) and served on the EU endpoint. Each category
 * comes with a score and a flag at Mistral's threshold, « determined based on the optimal
 * performance of our internal test set »: without a measure of our own, the flag rules.
 */

import type { ModerationObject } from '@mistralai/mistralai/models/components';
import { logger } from '../observability/logger.js';
import { getModerationSdk, MODERATION_TIMEOUT_MS } from './mistral-sdk.js';

const MODERATION_MODEL = 'mistral-moderation-2603';

/**
 * The categories that hold back an output. `health`, `financial` and `law` stay out (a biology or
 * civics lesson touches them), `pii` too (the tutor calls the student by their first name), and
 * `jailbreaking`, which concerns the input.
 */
export const OUTPUT_BLOCKING = ['sexual', 'hate_and_discrimination', 'violence_and_threats', 'dangerous', 'criminal', 'selfharm'] as const;

function blocking(result: ModerationObject): string[] {
  const flagged = OUTPUT_BLOCKING.filter((category) => result.categories?.[category] === true);
  if (flagged.length > 0) {
    logger.warn('Output flagged by moderation', {
      operation: 'moderation:flagged',
      categories: flagged,
      scores: Object.fromEntries(flagged.map((category) => [category, result.categoryScores?.[category]])),
    });
  }
  return flagged;
}

/** One result per input, or the answer cannot be read: a text without its result was not checked. */
function resultsFor(results: readonly ModerationObject[], count: number): ModerationObject[] {
  if (results.length !== count) throw new Error(`Moderation returned ${results.length} results for ${count} inputs`);
  return [...results];
}

/**
 * The blocking categories of the tutor's reply, read with the student's message for context; a
 * turn without text (a photo alone) moderates the reply by itself. Throws when moderation is
 * unavailable.
 */
export async function moderateReply(studentText: string, reply: string): Promise<string[]> {
  if (!studentText.trim()) return (await moderateTexts([reply]))[0] ?? [];
  const response = await getModerationSdk().classifiers.moderateChat(
    { model: MODERATION_MODEL, inputs: [{ role: 'user', content: studentText }, { role: 'assistant', content: reply }] },
    { timeoutMs: MODERATION_TIMEOUT_MS },
  );
  return resultsFor(response.results, 1).map(blocking)[0] ?? [];
}

/** The blocking categories of each text, in order. Throws when moderation is unavailable. */
export async function moderateTexts(texts: readonly string[]): Promise<string[][]> {
  if (texts.length === 0) return [];
  const response = await getModerationSdk().classifiers.moderate(
    { model: MODERATION_MODEL, inputs: [...texts] },
    { timeoutMs: MODERATION_TIMEOUT_MS },
  );
  return resultsFor(response.results, texts.length).map(blocking);
}

/**
 * The categories kept with a student's message. `selfharm` decides distress (`distress.ts`); the
 * others are measured, not blocking: a history homework touches violence, and an injection stays
 * the student's text, which the turn contract and the output checks frame.
 */
const INPUT_RECORDED = ['selfharm', 'sexual', 'jailbreaking', 'pii', 'violence_and_threats', 'dangerous', 'criminal'] as const;

export interface InputModeration {
  /** The recorded categories Mistral flags. */
  flagged: string[];
  /** Null when Mistral returns no score: a missing score is not a low one. */
  selfharmScore: number | null;
}

/** The student's message moderated, the tutor's last message for context. Throws when moderation is unavailable. */
export async function moderateStudentTurn(lastTutorText: string | null, studentText: string): Promise<InputModeration> {
  const inputs = [
    ...(lastTutorText ? [{ role: 'assistant' as const, content: lastTutorText }] : []),
    { role: 'user' as const, content: studentText },
  ];
  const response = await getModerationSdk().classifiers.moderateChat({ model: MODERATION_MODEL, inputs }, { timeoutMs: MODERATION_TIMEOUT_MS });
  const [result] = resultsFor(response.results, 1);
  return {
    flagged: INPUT_RECORDED.filter((category) => result?.categories?.[category] === true),
    selfharmScore: result?.categoryScores?.['selfharm'] ?? null,
  };
}
