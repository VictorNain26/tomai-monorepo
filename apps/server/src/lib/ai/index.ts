/**
 * TanStack AI - Exports centralisés
 *
 * Usage:
 * ```typescript
 * import { geminiAdapter, AI_MODELS, ragSearchTool } from '@/lib/ai';
 * import { CardGenerationOutputSchema } from '@/lib/ai';
 * ```
 */

// Adapter & Configuration
export {
  geminiAdapter,
  AI_MODELS,
  type AIModel,
} from './adapter.js';

// Server Tools
export {
  ragSearchTool,
  ragSearchToolDef,
  type RAGSearchInput,
  type RAGSearchOutput,
} from './tools/index.js';

// Simple Chat Service
export {
  generateSimpleResponse,
  type SimpleChatParams,
  type SimpleChatResult,
} from './simple-chat.service.js';

// Schemas for Structured Output
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
  // Deck Planner Schemas
  DeckPlanSchema,
  PlannedCardSchema,
  NotionGroupSchema,
  validateDeckPlan,
  autoFixPlan,
  // Types
  type CardType,
  type ParsedCard,
  type CardGenerationOutput,
  type DeckPlan,
  type PlannedCard,
  type NotionGroup,
  type PlanValidationResult,
} from './schemas/index.js';
