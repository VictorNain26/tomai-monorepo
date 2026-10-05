/**
 * Revision cards reach the student: each one is checked before it is stored, by Mistral's
 * moderation and by the caller's deterministic check (in the chat, the exercise's answer as the
 * tutor's message is checked). A card that fails is set aside; with moderation unavailable, none
 * passes.
 */

import { collectStrings } from '../../lib/collect-strings.js';
import { moderateTexts } from '../../platform/ai/moderation.js';
import { logger } from '../../platform/observability/logger.js';

export interface CardCheck<Card> {
  kept: Card[];
  setAside: number;
  /** Moderation could not answer: no card was kept, for want of a check, not for its content. */
  unmoderated: boolean;
}

export async function checkCards<Card extends { content: unknown }>(
  cards: readonly Card[],
  passes: (text: string) => boolean,
): Promise<CardCheck<Card>> {
  // Without the indexes: a correctIndex is no text the student reads.
  const texts = cards.map((card) => collectStrings(card.content, false));
  let flagged: boolean[];
  try {
    flagged = (await moderateTexts(texts)).map((categories) => categories.length > 0);
  } catch (err) {
    logger.error('Moderation unavailable', { operation: 'moderation:error', what: 'cards', err, severity: 'high' as const });
    return { kept: [], setAside: cards.length, unmoderated: true };
  }
  const kept = cards.filter((_, index) => !flagged[index] && passes(texts[index] ?? ''));
  return { kept, setAside: cards.length - kept.length, unmoderated: false };
}
