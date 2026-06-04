/**
 * Card content validation — domain invariants per card type.
 *
 * A card's `content` shape depends on its `cardType`. These checks live in the
 * domain layer (not the route) so every write path — add cards, update a card —
 * enforces the same invariants without duplicating the rules.
 */

import type { CardType } from '../../db/schema.js';

/**
 * Validate a card's content against the invariants of its type.
 * Returns `{ valid: true }` or `{ valid: false, error }` with a human-readable
 * reason. Pure function — no I/O.
 */
export function validateCardContent(
  cardType: CardType,
  content: Record<string, unknown>,
): { valid: boolean; error?: string } {
  switch (cardType) {
    case 'flashcard':
      if (!content.front || !content.back) {
        return { valid: false, error: 'Flashcard requires front and back' };
      }
      if (typeof content.front !== 'string' || typeof content.back !== 'string') {
        return { valid: false, error: 'front and back must be strings' };
      }
      break;

    case 'qcm':
      if (!content.question || !content.options || content.correctIndex === undefined) {
        return { valid: false, error: 'QCM requires question, options, and correctIndex' };
      }
      if (!Array.isArray(content.options) || content.options.length < 2) {
        return { valid: false, error: 'QCM requires at least 2 options' };
      }
      if (typeof content.correctIndex !== 'number' || content.correctIndex < 0 || content.correctIndex >= content.options.length) {
        return { valid: false, error: 'correctIndex must be a valid option index' };
      }
      break;

    case 'vrai_faux':
      if (!content.statement || content.isTrue === undefined) {
        return { valid: false, error: 'Vrai/Faux requires statement and isTrue' };
      }
      if (typeof content.statement !== 'string' || typeof content.isTrue !== 'boolean') {
        return { valid: false, error: 'statement must be string, isTrue must be boolean' };
      }
      break;

    default:
      return { valid: false, error: `Unknown card type: ${cardType}` };
  }

  return { valid: true };
}
