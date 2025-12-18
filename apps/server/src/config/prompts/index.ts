/**
 * Système de Prompts TomAI v2 - Architecture Optimisée
 * Core (identité) + Subjects (par matière) + Builder (composition)
 * Réduction ~50% tokens vs v1
 */

// Builder principal (point d'entrée)
export {
  buildSystemPrompt,
  estimateTokens,
  promptRequiresKaTeX,
  type PromptBuilderParams
} from './builder.js';

// Core prompts
export {
  generateIdentityPrompt,
  generateAdaptiveRules,
  type IdentityParams
} from './core/index.js';

// Subject prompts
export {
  generateSubjectPrompt,
  requiresKaTeX
} from './subjects/index.js';
