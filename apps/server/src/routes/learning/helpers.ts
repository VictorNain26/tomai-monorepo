/**
 * Learning Routes - Shared Helpers
 *
 * Validation and utility functions used across learning routes.
 */

import { logger } from '../../lib/observability';
import type { CardType } from '../../db/schema';
import type { EducationLevelType } from '../../types/index';

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
 * Validate card content based on card type
 */
export function validateCardContent(
  cardType: CardType,
  content: Record<string, unknown>
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
 */
export const subjectLabels: Record<string, string> = {
  mathematiques: 'Mathématiques',
  francais: 'Français',
  physique_chimie: 'Physique-Chimie',
  svt: 'SVT',
  histoire_geo: 'Histoire-Géographie',
  anglais: 'Anglais',
};
