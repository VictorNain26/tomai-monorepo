/**
 * Types pour optimisation de conversations
 */

import type { IAIMessage } from '../../types/ai.types.js';

// Ré-export pour usage externe
export type { IAIMessage };

/**
 * Contexte d'optimisation — résumé conversationnel pour le SummaryBuffer pattern
 */
export interface OptimizationContext {
  conversationSummary?: string | null;
  summaryUpToMessageId?: string | null;
}
