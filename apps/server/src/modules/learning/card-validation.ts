/**
 * Card content validation — domain invariants per card type.
 *
 * A card's `content` shape depends on its `cardType`. These checks live in the
 * domain layer (not the route) so every write path — add cards, update a card —
 * enforces the same invariants without duplicating the rules.
 */

import { z } from 'zod';
import { CardSchema, type CardType } from './card-content.schema.js';

/**
 * Validate a card's content against the schema of its type.
 * Returns `{ valid: true }` or `{ valid: false, error }` with a human-readable
 * reason. Pure function — no I/O.
 */
export function validateCardContent(
  cardType: CardType,
  content: Record<string, unknown>,
): { valid: true } | { valid: false; error: string } {
  const result = CardSchema.safeParse({ cardType, content });
  return result.success ? { valid: true } : { valid: false, error: z.prettifyError(result.error) };
}
