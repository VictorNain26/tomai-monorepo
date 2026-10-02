/**
 * Learning Routes - Shared Helpers
 *
 * Validation and utility functions used across learning routes.
 */

import { z } from 'zod';
import { logger } from '../../platform/observability/logger';
import type { EducationLevelType } from '../../types/index';
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
 * Get user's education level with fallback and logging
 * Logs warning if fallback is used (indicates incomplete profile)
 */
export function getUserLevel(
  userId: string,
  schoolLevel: string | null | undefined
): EducationLevelType {
  if (!schoolLevel) {
    logger.warn('User has no schoolLevel - using fallback', {
      operation: 'learning:getUserLevel:fallback',
      userId,
      fallbackLevel: 'sixieme',
      severity: 'low' as const,
    });
    return 'sixieme';
  }
  return schoolLevel as EducationLevelType;
}

/**
 * Subject labels for French UI
 * Aligned with the server subject slugs and frontend SUBJECT_METADATA
 */
export const subjectLabels: Record<string, string> = {
  mathematiques: 'Mathématiques',
  francais: 'Français',
  physique_chimie: 'Physique-Chimie',
  svt: 'SVT',
  histoire_geo: 'Histoire-Géographie',
  anglais: 'Anglais',
  espagnol: 'Espagnol',
  allemand: 'Allemand',
  italien: 'Italien',
  technologie: 'Technologie',
};
