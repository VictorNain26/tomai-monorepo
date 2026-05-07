/**
 * Service Learning — génération de cartes de révision.
 *
 * Architecture Single-Phase :
 * - types.ts : types TypeScript
 * - card-generator.service.ts : génération en un seul appel Mistral
 *
 * Usage:
 * ```typescript
 * import { generateCards, isGenerationError } from '@/services/learning';
 *
 * const result = await generateCards({
 *   topic: 'Proportionnalité',
 *   subject: 'Mathématiques',
 *   level: 'cinquieme',
 *   ragContext: '...',
 *   cardCount: 15
 * });
 *
 * if (isGenerationError(result)) {
 *   console.error(result.error);
 * } else {
 *   console.log(result.cards);
 * }
 * ```
 */

// Types
export * from './types.js';

// AI Card Generation (Single-Phase)
export {
  generateCards,
  isGenerationError,
  type CardGenerationResult,
  type CardGenerationError
} from './card-generator.service.js';

// Prompts utilities
export {
  getSubjectCategory,
  subjectRequiresKaTeX,
  getEducationCycle
} from './prompts/index.js';
