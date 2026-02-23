/**
 * Système de Prompts TomAI v3
 * Basé sur CSEN (Éducation Nationale) + Dehaene
 */

// API principale
export {
  buildSystemPrompt,
  promptRequiresKaTeX,
  type SystemPromptParams
} from './system-prompt.js';

// Core exports
export {
  generateIdentityPrompt,
  generateSafetyGuardrails,
  generateRAGSourceOfTruth,
  generateToolInstructions,
  type IdentityParams
} from './core/index.js';

// Adaptation exports
export {
  generateLevelAdaptation,
  getCycleFromLevel,
  needsSimplifiedKaTeX,
  generateSubjectSpecifics,
  generateSubjectBlock,
  normalizeSubject,
  requiresKaTeX,
  type CycleType,
  type SubjectType
} from './adaptation/index.js';
