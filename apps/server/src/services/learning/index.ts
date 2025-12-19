/**
 * Service Learning - Génération de cartes de révision
 *
 * Architecture TanStack AI 2025:
 * - types.ts: Types TypeScript
 * - prompts/: Construction des prompts par matière et cycle
 * - prompt-builder.service.ts: Assemblage du prompt final
 * - card-generator.service.ts: Génération avec TanStack AI structured output
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

// TanStack AI Card Generation
export {
  generateCards,
  isGenerationError,
  type CardGenerationResult,
  type CardGenerationError
} from './card-generator.service.js';

// Prompt building
export { buildCardGenerationPrompt, estimatePromptTokens } from './prompt-builder.service.js';
export type { BuiltPrompt } from './prompt-builder.service.js';

// Prompts utilities
export {
  getSubjectCategory,
  subjectRequiresKaTeX,
  getEducationCycle
} from './prompts/index.js';
