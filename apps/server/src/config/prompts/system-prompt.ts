/**
 * System Prompt Builder
 * Basé sur les recommandations du CSEN (Éducation Nationale)
 */

import { generateIdentityCore, generateStudentContext } from './core/identity.js';
import { generateRAGSourceOfTruth } from './core/rag-policy.js';
import { generateSafetyGuardrails } from './core/safety.js';
import { generateAttachmentsPolicy } from './core/attachments.js';
import { generateChatbotPedagogyPrompt } from '../../shared/pedagogy/index.js';
import { generateLevelAdaptation } from './adaptation/by-level.js';
import { generateSubjectBlock } from './adaptation/by-subject.js';
import type { EducationLevelType } from '../../types/index.js';

interface SystemPromptParams {
  level: EducationLevelType;
  levelText: string;
  subject?: string;
  firstName?: string;
}

/**
 * Construit le prompt système complet.
 *
 * Ordre : [BLOCS STABLES] puis [BLOCS DYNAMIQUES]. Gemini 2.5+ applique
 * automatiquement un cache implicite (-90% sur les tokens d'input) sur les
 * préfixes >=1024 tokens partagés entre appels. Placer identityCore +
 * pedagogy + RAG policy + safety EN PREMIER maximise la portion cachable.
 * Le contexte élève et les adaptations niveau/matière arrivent après — ils
 * changent d'un appel à l'autre mais ne cassent pas le préfixe stable.
 */
export function buildSystemPrompt(params: SystemPromptParams): string {
  const { level, levelText, subject, firstName } = params;
  const studentName = firstName ?? "l'élève";

  const parts = [
    // ——— STABLE PREFIX (partagé entre utilisateurs, cachable) ———
    generateIdentityCore(),
    generateChatbotPedagogyPrompt(),
    generateRAGSourceOfTruth(),
    generateAttachmentsPolicy(),
    generateSafetyGuardrails(),
    // ——— DYNAMIC (spécifique à l'élève / au tour) ———
    generateStudentContext({ studentName, levelText, subject }),
    generateLevelAdaptation(level),
    generateSubjectBlock(subject),
  ].filter(Boolean);

  return parts.join('\n\n');
}

