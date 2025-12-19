/**
 * Prompt Builder - Compositeur de prompts optimisé
 * Assemble : Core (identité) + Subject (matière) + Context (RAG)
 * Best Practice 2025 : Délimiteurs XML pour Gemini
 */

import { generateIdentityPrompt, generateAdaptiveRules } from './core/index.js';
import { generateSubjectPrompt, requiresKaTeX } from './subjects/index.js';
import { getVocabularyGuide } from '../../config/learning-config.js';
import { getStructuredResponseGuide } from '../../config/education/education-mapping.js';
import type { EducationLevelType } from '../../types/index.js';

/** Limite tokens RAG (~1500 tokens ≈ 6000 chars FR) */
const MAX_RAG_CHARS = 6000;

export interface PromptBuilderParams {
  level: EducationLevelType;
  levelText: string;
  subject: string;
  firstName?: string;
  userQuery: string;
  ragContext?: string;
}

/**
 * Construit le prompt système complet
 * Architecture XML : <system> + <context> + <subject> + <instruction>
 */
export function buildSystemPrompt(params: PromptBuilderParams): string {
  const { level, levelText, subject, firstName, userQuery, ragContext } = params;
  const studentName = firstName ?? "l'élève";

  // 1. CORE : Identité + Règles
  const identity = generateIdentityPrompt({ studentName, levelText, subject });
  const adaptiveRules = generateAdaptiveRules();

  // 2. GUIDES : Vocabulaire + Structure
  const vocabulary = getVocabularyGuide(level);
  const structure = getStructuredResponseGuide(level);

  // 3. RAG : Contexte programmes (avec validation longueur)
  const ragBlock = formatRAGContext(ragContext, levelText);

  // 4. SUBJECT : Règles spécifiques matière
  const subjectPrompt = generateSubjectPrompt({ subject, query: userQuery, level });

  // 5. COMPOSITION XML (Best Practice Gemini 2025)
  return `<system>
${identity}

${adaptiveRules}

<vocabulary>
${vocabulary}
</vocabulary>

<response_structure>
${structure}
</response_structure>
</system>

<context>
${ragBlock}
</context>

${subjectPrompt ? `<subject>\n${subjectPrompt}\n</subject>\n` : ''}
<instruction>
Réponds à ${studentName} en t'adaptant à son niveau ${levelText}.
</instruction>`;
}

/**
 * Formate le contexte RAG avec validation longueur
 * Tronque intelligemment si dépassement
 */
function formatRAGContext(context: string | undefined, levelText: string): string {
  if (!context || context.trim().length === 0) {
    return `<no_curriculum>
Tu peux répondre aux salutations et questions sur toi-même.
Pour le contenu éducatif sans source : "Peux-tu reformuler ta question ?"
</no_curriculum>`;
  }

  // Validation longueur - tronquer si nécessaire
  let safeContext = context;
  if (context.length > MAX_RAG_CHARS) {
    // Tronquer à la dernière phrase complète
    const truncated = context.slice(0, MAX_RAG_CHARS);
    const lastPeriod = truncated.lastIndexOf('.');
    safeContext = lastPeriod > MAX_RAG_CHARS * 0.8
      ? truncated.slice(0, lastPeriod + 1)
      : truncated + '...';
  }

  return `<curriculum source="Éduscol 2024-2025">
${safeContext}
</curriculum>

<rules>
- Utilise UNIQUEMENT le contenu ci-dessus
- Si notion absente : "Cette notion n'est pas au programme de ${levelText}"
</rules>`;
}

/**
 * Vérifie si le prompt nécessite KaTeX
 */
export function promptRequiresKaTeX(subject: string): boolean {
  return requiresKaTeX(subject);
}
