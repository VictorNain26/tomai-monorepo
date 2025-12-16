/**
 * Export central des configurations IA
 * Point d'entrée unique pour toutes les configurations de complexité
 */

// Configuration
export * from './complexity-config.js';

// Utilitaires
export {
  getAdaptiveTokenConfig,
  detectQuestionComplexity,
  calculateEducationalThinkingBudget,
  shouldUseThinkingMode
} from './complexity-utils.js';
