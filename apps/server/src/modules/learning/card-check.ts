/**
 * Revision cards reach the student: each one is checked before it is stored, by Mistral's
 * moderation and by the caller's deterministic check (in the chat, the exercise's answer as the
 * tutor's message is checked). A card that fails is set aside; with moderation unavailable, none
 * passes.
 */

import { collectStrings } from '../../lib/collect-strings.js';
import { moderateTexts } from '../../platform/ai/moderation.js';
import { logger } from '../../platform/observability/logger.js';

export async function checkCards<Card extends { content: unknown }>(
  cards: readonly Card[],
  passes: (text: string) => boolean,
): Promise<{ kept: Card[]; setAside: number }> {
  // Without the indexes: a correctIndex is no text the student reads.
  const texts = cards.map((card) => collectStrings(card.content, false));
  const flagged = await moderateTexts(texts).then(
    (verdicts) => verdicts.map((categories) => categories.length > 0),
    (err: unknown) => {
      logger.error('Moderation unavailable', { operation: 'moderation:error', what: 'cards', err, severity: 'high' as const });
      return texts.map(() => true);
    },
  );
  const kept = cards.filter((_, index) => !flagged[index] && passes(texts[index] ?? ''));
  return { kept, setAside: cards.length - kept.length };
}
