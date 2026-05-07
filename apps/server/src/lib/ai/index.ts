/**
 * Mistral AI — exports centralisés.
 *
 * Usage:
 * ```typescript
 * import { generateSimpleResponse } from '@/lib/ai';
 * import { CardGenerationOutputSchema } from '@/lib/ai';
 * ```
 */

// Simple Chat Service (pour cas simples sans streaming)
export {
  generateSimpleResponse,
  type SimpleChatParams,
  type SimpleChatResult,
} from './simple-chat.service.js';

// Schemas for Structured Output (card generation)
export {
  // Card Schemas
  CardTypeSchema,
  ParsedCardSchema,
  CardGenerationOutputSchema,
  FlashcardContentSchema,
  QCMContentSchema,
  VraiFauxContentSchema,
  MatchingContentSchema,
  FillBlankContentSchema,
  WordOrderContentSchema,
  CalculationContentSchema,
  TimelineContentSchema,
  MatchingEraContentSchema,
  CauseEffectContentSchema,
  ClassificationContentSchema,
  ProcessOrderContentSchema,
  GrammarTransformContentSchema,
  // Types
  type CardType,
  type ParsedCard,
  type CardGenerationOutput,
} from './schemas/index.js';
