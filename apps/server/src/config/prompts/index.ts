/**
 * Système de Prompts TomAI v3 - Architecture LearnLM 2025
 *
 * Réduction ~60% tokens vs v2:
 * - Élimination duplication CSEN (5 fichiers → 1)
 * - LearnLM 5 Principles comme fondation
 * - Safety guardrails explicites
 * - Structure XML cohérente pour Gemini
 *
 * Migration v2 → v3:
 * - buildSystemPrompt: signature identique, implémentation optimisée
 * - promptRequiresKaTeX: inchangé
 * - generateSubjectPrompt: DÉPRÉCIÉ, utiliser generateSubjectSpecifics
 */

// ═══════════════════════════════════════════════════════════════════════════
// API PRINCIPALE (nouveau)
// ═══════════════════════════════════════════════════════════════════════════

export {
  buildSystemPrompt,
  promptRequiresKaTeX,
  type SystemPromptParams,
  // Alias pour compatibilité v2
  type SystemPromptParams as PromptBuilderParams
} from './system-prompt.js';

// ═══════════════════════════════════════════════════════════════════════════
// CORE EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export {
  generateIdentityPrompt,
  generatePedagogyPrinciples,
  generateCSENMethod,
  generateAdaptiveRules,
  generateSafetyGuardrails,
  type IdentityParams
} from './core/index.js';

// ═══════════════════════════════════════════════════════════════════════════
// ADAPTATION EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

import {
  generateSubjectSpecifics as _generateSubjectSpecifics
} from './adaptation/index.js';

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

// ═══════════════════════════════════════════════════════════════════════════
// COMPATIBILITÉ V2 (DÉPRÉCIÉ - sera supprimé en v4)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @deprecated Utiliser generateSubjectSpecifics à la place
 * Maintenu pour compatibilité avec l'ancien code
 */
export function generateSubjectPrompt(params: {
  subject: string;
  query: string;
  level?: import('../../types/index.js').EducationLevelType;
}): string | null {
  return _generateSubjectSpecifics(params.subject);
}
