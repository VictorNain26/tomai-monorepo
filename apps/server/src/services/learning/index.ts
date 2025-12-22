/**
 * Service Learning - Génération de cartes de révision
 *
 * Architecture Single-Phase 2025:
 * - types.ts: Types TypeScript
 * - card-generator.service.ts: Génération en un seul appel Gemini
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

// TanStack AI Card Generation (Single-Phase)
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
