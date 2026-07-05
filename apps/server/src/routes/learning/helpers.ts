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
 * The caller is responsible for calling `return status(domain.status, domain.body)`.
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
    return 'sixieme' as EducationLevelType;
  }
  return schoolLevel as EducationLevelType;
}

export type RagGateResult =
  | { ok: true }
  | { ok: false; reason: 'rag_disabled'; httpStatus: 503 }
  | { ok: false; reason: 'no_results'; httpStatus: 400 };

/**
 * Gate de génération : on génère dès que le programme officiel répond.
 * Volontairement AUCUN seuil sur les scores : en fusion RRF ce sont des
 * scores de rang (~1/(k+rank)), pas des similarités — toute comparaison
 * absolue est un bug (audit 2026-07-01, P0 n°1).
 */
export function evaluateRagGate(
  ragResult: { strategy: string; semanticChunks: readonly unknown[] },
): RagGateResult {
  if (ragResult.strategy === 'disabled') {
    return { ok: false, reason: 'rag_disabled', httpStatus: 503 };
  }
  if (ragResult.semanticChunks.length === 0) {
    return { ok: false, reason: 'no_results', httpStatus: 400 };
  }
  return { ok: true };
}

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
