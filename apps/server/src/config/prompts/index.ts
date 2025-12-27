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
  generatePedagogyPrinciples,
  generateSafetyGuardrails,
  type IdentityParams
} from './core/index.js';

// Adaptation exports
export {
  generateLevelAdaptation,
  getCycleFromLevel,
  needsSimplifiedKaTeX,
  generateSubjectSpecifics,
  normalizeSubject,
  requiresKaTeX,
  type CycleType,
  type SubjectType
} from './adaptation/index.js';
