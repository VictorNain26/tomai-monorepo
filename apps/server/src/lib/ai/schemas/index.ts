/**
 * AI Schemas — exports centralisés.
 *
 * Schemas Zod pour structured output (réponses JSON Mistral validées).
 *
 * Usage :
 * ```typescript
 * import { CardGenerationOutputSchema, ParsedCardSchema } from '@/lib/ai/schemas';
 * ```
 */

// Card Schemas - 13 types de cartes
export {
  // Content Schemas
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
  // Combined Schemas
  CardTypeSchema,
  ParsedCardSchema,
  CardGenerationOutputSchema,
  // Types
  type CardType,
  type ParsedCard,
  type CardGenerationOutput,
  type FlashcardContent,
  type QCMContent,
  type VraiFauxContent,
  type MatchingContent,
  type FillBlankContent,
  type WordOrderContent,
  type CalculationContent,
  type TimelineContent,
  type MatchingEraContent,
  type CauseEffectContent,
  type ClassificationContent,
  type ProcessOrderContent,
  type GrammarTransformContent
} from './cards.schema.js';
