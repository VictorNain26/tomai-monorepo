/**
 * System Prompt Builder - Architecture LearnLM 2025
 * Point d'entrée unique pour la génération du prompt système
 *
 * Réduction: ~1800 tokens → ~700 tokens (-60%)
 *
 * Architecture:
 * 1. Identity (role, tone, transparency)
 * 2. Pedagogy (LearnLM 5 principles + CSEN method)
 * 3. Safety (guardrails)
 * 4. Level adaptation (vocabulaire, structure par cycle)
 * 5. Subject specifics (variations minimales par matière)
 * 6. RAG context (si disponible)
 *
 * Sources:
 * - Google LearnLM Paper 2025
 * - Gemini Prompting Best Practices 2025
 * - CSEN Enseignement Explicite 2022
 */

import { generateIdentityPrompt } from './core/identity.js';
import {
  generatePedagogyPrinciples,
  generateCSENMethod,
  generateAdaptiveRules
} from './core/pedagogy.js';
import { generateSafetyGuardrails } from './core/safety.js';
import { generateLevelAdaptation } from './adaptation/by-level.js';
import { generateSubjectSpecifics, requiresKaTeX } from './adaptation/by-subject.js';
import type { EducationLevelType } from '../../types/index.js';

/** Limite tokens RAG (~1500 tokens ≈ 6000 chars FR) */
const MAX_RAG_CHARS = 6000;

export interface SystemPromptParams {
  level: EducationLevelType;
  levelText: string;
  subject: string;
  firstName?: string;
  ragContext?: string;
}

/**
 * Construit le prompt système complet - Architecture XML Gemini
 * ~700 tokens de base + RAG context
 */
export function buildSystemPrompt(params: SystemPromptParams): string {
  const { level, levelText, subject, firstName, ragContext } = params;
  const studentName = firstName ?? "l'élève";

  // 1. IDENTITY - Qui est Tom, ton, transparence
  const identity = generateIdentityPrompt({ studentName, levelText, subject });

  // 2. PEDAGOGY - Principes LearnLM + CSEN (une seule fois, pas par matière)
  const pedagogy = generatePedagogyPrinciples();
  const csenMethod = generateCSENMethod();
  const adaptiveRules = generateAdaptiveRules();

  // 3. SAFETY - Guardrails
  const safety = generateSafetyGuardrails();

  // 4. LEVEL ADAPTATION - Vocabulaire et structure par cycle
  const levelAdaptation = generateLevelAdaptation(level);

  // 5. SUBJECT SPECIFICS - Variations minimales par matière
  const subjectSpecifics = generateSubjectSpecifics(subject);

  // 6. RAG CONTEXT - Contenu programmes si disponible
  const ragBlock = formatRAGContext(ragContext);

  // ASSEMBLAGE XML - Format optimisé pour Gemini
  const parts = [
    identity,
    pedagogy,
    csenMethod,
    adaptiveRules,
    safety,
    levelAdaptation,
    subjectSpecifics,
    ragBlock
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

// Réexport pour compatibilité avec l'ancien builder.ts
export type { SystemPromptParams as PromptBuilderParams };
