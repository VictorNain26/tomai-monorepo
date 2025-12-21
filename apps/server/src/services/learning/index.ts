/**
 * Service Learning - Génération de cartes de révision
 *
 * Architecture Meta-Planning 2025:
 * - types.ts: Types TypeScript
 * - deck-planner.service.ts: Phase 1 - Planification du deck
 * - prompt-builder.service.ts: Phase 2 - Construction des prompts d'exécution
 * - card-generator.service.ts: Orchestration 2 phases avec TanStack AI
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
 *   console.log(result.plan); // Le plan utilisé par l'IA
 * }
 * ```
 */

// Types
export * from './types.js';

// TanStack AI Card Generation (Meta-Planning)
export {
  generateCards,
  isGenerationError,
  type CardGenerationResult,
  type CardGenerationError
} from './card-generator.service.js';

// Deck Planner (Phase 1)
export {
  generateDeckPlan,
  isPlanError,
  type DeckPlanResult,
  type DeckPlanError
} from './deck-planner.service.js';

// Prompt building (Phase 2)
export { buildCardExecutionPrompt, estimatePromptTokens } from './prompt-builder.service.js';
export type { BuiltPrompt } from './prompt-builder.service.js';

// Prompts utilities
export {
  getSubjectCategory,
  subjectRequiresKaTeX,
  getEducationCycle
} from './prompts/index.js';
