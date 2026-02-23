/**
 * System Prompt Builder
 * Basé sur les recommandations du CSEN (Éducation Nationale)
 */

import { generateIdentityPrompt } from './core/identity.js';
import { generateRAGSourceOfTruth } from './core/rag-policy.js';
import { generateSafetyGuardrails } from './core/safety.js';
import { generateChatbotPedagogyPrompt } from '../../shared/pedagogy/index.js';
import { generateLevelAdaptation } from './adaptation/by-level.js';
import { generateSubjectBlock, requiresKaTeX } from './adaptation/by-subject.js';
import type { EducationLevelType } from '../../types/index.js';

export interface SystemPromptParams {
  level: EducationLevelType;
  levelText: string;
  subject?: string;
  firstName?: string;
}

/**
 * Construit le prompt système complet
 */
export function buildSystemPrompt(params: SystemPromptParams): string {
  const { level, levelText, subject, firstName } = params;
  const studentName = firstName ?? "l'élève";

  const parts = [
    generateIdentityPrompt({ studentName, levelText, subject }),
    generateChatbotPedagogyPrompt(),
    generateRAGSourceOfTruth(),
    generateSafetyGuardrails(),
    generateLevelAdaptation(level),
    generateSubjectBlock(subject),
  ].filter(Boolean);

  return parts.join('\n\n');
}

/**
 * Vérifie si le prompt nécessite KaTeX
 * Réexport pour compatibilité
 */
export function promptRequiresKaTeX(subject: string): boolean {
  return requiresKaTeX(subject);
}
