/**
 * Learning Routes - Shared Helpers
 *
 * Validation and utility functions used across learning routes.
 */

import { logger } from '../../lib/observability';
import type { EducationLevelType } from '../../types/index';
import {
  DeckNotFoundError,
  DeckOwnershipError,
} from '../../services/learning/learning.service';

/**
 * Map a LearningService deck domain error to an Elysia HTTP response.
 *
 * Per the service contract (see learning-errors.ts), both "not found" and
 * "ownership mismatch" surface as HTTP 404 so the API does not leak the
 * existence of another user's deck. The distinct error *code* in the body
 * lets internal callers and tests disambiguate without exposing resource
 * existence externally.
 *
 * Returns the response body when the error was handled, or `null` when the
 * error was not a known deck domain error (caller must rethrow / fall through).
 *
 * `set` is typed loosely (`status?: unknown`) because Elysia's `set` carries
 * more than just `status`; we only ever assign to `status`.
 */
export function handleDeckDomainError(
  err: unknown,
  set: { status?: unknown },
): { success: false; error: 'DECK_NOT_FOUND' | 'DECK_FORBIDDEN' } | null {
  if (err instanceof DeckNotFoundError) {
    set.status = 404;
    return { success: false, error: 'DECK_NOT_FOUND' };
  }
  if (err instanceof DeckOwnershipError) {
    set.status = 404;
    return { success: false, error: 'DECK_FORBIDDEN' };
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
    return 'sixieme' as EducationLevelType;
  }
  return schoolLevel as EducationLevelType;
}

/**
 * School level type schema for Elysia validation
 * Used in multiple route files
 */
export const schoolLevelLiterals = [
  'cp', 'ce1', 'ce2', 'cm1', 'cm2',
  'sixieme', 'cinquieme', 'quatrieme', 'troisieme',
  'seconde', 'premiere', 'terminale',
] as const;

/**
 * Subject labels for French UI
 * Aligned with Qdrant matières and frontend SUBJECT_METADATA
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
