/**
 * Export central des utils de conversation
 * Point d'entrée unique pour optimisation conversation
 */

// Types
export type { IAIMessage, HistoryOptimizationConfig } from './types.js';

// Fonctions utilitaires
export {
  optimizeConversationHistory
} from './conversation-optimizer.js';
