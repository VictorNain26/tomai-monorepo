/**
 * TanStack AI Schemas - Exports centralisés
 *
 * Schemas Zod pour structured output avec Gemini
 *
 * Usage:
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

// Deck Planner Schemas - Meta-planning
export {
  DeckPlanSchema,
  PlannedCardSchema,
  NotionGroupSchema,
  validateDeckPlan,
  autoFixPlan,
  type DeckPlan,
  type PlannedCard,
  type NotionGroup,
  type PlanValidationResult
} from './deck-planner.schema.js';
