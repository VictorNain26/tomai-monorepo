/**
 * Types pour optimisation de conversations
 */

import type { IAIMessage } from '../../types/ai.types.js';

// Ré-export pour usage externe
export type { IAIMessage };

/**
 * Options de configuration pour l'optimisation d'historique
 */
export interface HistoryOptimizationConfig {
  maxHistoryTokens: number;
  recentMessagesCount: number;
  maxTopics: number;
}
