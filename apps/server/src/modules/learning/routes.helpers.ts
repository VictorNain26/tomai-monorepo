/**
 * Learning Routes - Shared Helpers
 *
 * Validation and utility functions used across learning routes.
 */

import { z } from 'zod';
import { logger } from '../../platform/observability/logger';
import type { EducationLevelType } from '../../types/index';
import { isEducationLevel } from '../../lib/education-levels.js';
import {
  DeckNotFoundError,
  DeckOwnershipError,
} from './learning.service.js';

/** `:id` of a deck or card: a UUID, so a malformed id is a 400, not a Postgres 500. */
export const idParam = z.object({ id: z.uuid() });

/**
 * Map a LearningService deck domain error to a typed status response.
 *
 * Per the service contract (see learning-errors.ts), both "not found" and
 * "ownership mismatch" surface as HTTP 404 so the API does not leak the
 * existence of another user's deck. The distinct error *code* in the body
 * lets internal callers and tests disambiguate without exposing resource
 * existence externally.
 *
 * Returns `{ status, body }` when the error was handled, or `null` when the
 * error was not a known deck domain error (caller must rethrow / fall through).
 * The caller is responsible for calling `return c.json(domain.body, domain.status)`.
 */
export function handleDeckDomainError(
  err: unknown,
): { status: 404; body: { success: false; error: 'DECK_NOT_FOUND' | 'DECK_FORBIDDEN' } } | null {
  if (err instanceof DeckNotFoundError) {
    return { status: 404, body: { success: false, error: 'DECK_NOT_FOUND' } };
  }
  if (err instanceof DeckOwnershipError) {
    return { status: 404, body: { success: false, error: 'DECK_FORBIDDEN' } };
  }
  return null;
}

/**
 * The user's level; a missing or unknown one falls back to the 6e, logged as an incomplete profile.
 */
export function getUserLevel(
  userId: string,
  schoolLevel: string | null | undefined
): EducationLevelType {
  if (isEducationLevel(schoolLevel)) return schoolLevel;
  logger.warn('User has no collège level - using fallback', {
    operation: 'learning:getUserLevel:fallback',
    userId,
    fallbackLevel: 'sixieme',
    severity: 'low' as const,
  });
  return 'sixieme';
}
