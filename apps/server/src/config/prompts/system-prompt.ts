/**
 * System Prompt Builder
 * Basé sur les recommandations du CSEN (Éducation Nationale)
 */

import { generateIdentityPrompt } from './core/identity.js';
import { generatePedagogyPrinciples } from './core/pedagogy.js';
import { generateSafetyGuardrails } from './core/safety.js';
import { generateLevelAdaptation } from './adaptation/by-level.js';
import { generateSubjectSpecifics, requiresKaTeX } from './adaptation/by-subject.js';
import type { EducationLevelType } from '../../types/index.js';

const MAX_RAG_CHARS = 6000;

export interface SystemPromptParams {
  level: EducationLevelType;
  levelText: string;
  subject: string;
  firstName?: string;
  ragContext?: string;
}

/**
 * Construit le prompt système complet
 */
export function buildSystemPrompt(params: SystemPromptParams): string {
  const { level, levelText, subject, firstName, ragContext } = params;
  const studentName = firstName ?? "l'élève";

  const parts = [
    generateIdentityPrompt({ studentName, levelText, subject }),
    generatePedagogyPrinciples(),
    generateSafetyGuardrails(),
    generateLevelAdaptation(level),
    generateSubjectSpecifics(subject),
    formatRAGContext(ragContext)
  ].filter(Boolean);

  return parts.join('\n\n');
}

/**
 * Formate le contexte RAG avec validation longueur
 */
function formatRAGContext(context: string | undefined): string {
  if (!context || context.trim().length === 0) {
    return `<context>
Pas de contenu RAG disponible pour cette requête.
Tu peux répondre aux salutations et questions générales.
Pour le contenu éducatif sans source: guide l'élève avec tes connaissances.
</context>`;
  }

  // Tronquer si dépassement
  let safeContext = context;
  if (context.length > MAX_RAG_CHARS) {
    const truncated = context.slice(0, MAX_RAG_CHARS);
    const lastPeriod = truncated.lastIndexOf('.');
    safeContext = lastPeriod > MAX_RAG_CHARS * 0.8
      ? truncated.slice(0, lastPeriod + 1)
      : truncated + '...';
  }

  return `<context source="curriculum">
${safeContext}
</context>`;
}

/**
 * Vérifie si le prompt nécessite KaTeX
 * Réexport pour compatibilité
 */
export function promptRequiresKaTeX(subject: string): boolean {
  return requiresKaTeX(subject);
}

