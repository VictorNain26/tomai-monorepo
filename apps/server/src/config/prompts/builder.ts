/**
 * Prompt Builder - Compositeur de prompts optimisé
 * Assemble : Core (identité) + Subject (matière) + Context (RAG)
 * Réduction tokens : ~50% vs ancienne architecture
 */

import { generateIdentityPrompt, generateAdaptiveRules } from './core/index.js';
import { generateSubjectPrompt, requiresKaTeX } from './subjects/index.js';
import { getVocabularyGuide } from '../../config/learning-config.js';
import { getStructuredResponseGuide } from '../../config/education/education-mapping.js';
import type { EducationLevelType } from '../../types/index.js';

export interface PromptBuilderParams {
  /** Niveau scolaire */
  level: EducationLevelType;
  /** Texte du niveau (ex: "5ème") */
  levelText: string;
  /** Matière */
  subject: string;
  /** Prénom élève */
  firstName?: string;
  /** Query utilisateur (pour détection sous-matière) */
  userQuery: string;
  /** Contexte RAG (programmes officiels) */
  ragContext?: string;
  /** Type d'activité détecté */
  isExercice?: boolean;
  isProduction?: boolean;
}

/**
 * Construit le prompt système complet
 * Architecture : Core + Vocabulaire + Structure + RAG + Subject
 */
export function buildSystemPrompt(params: PromptBuilderParams): string {
  const {
    level,
    levelText,
    subject,
    firstName,
    userQuery,
    ragContext,
    isExercice,
    isProduction
  } = params;

  const studentName = firstName ?? "l'élève";

  // 1. CORE : Identité Tom (~200 tokens)
  const identityPrompt = generateIdentityPrompt({
    studentName,
    levelText,
    subject
  });

  // 2. CORE : Règles d'adaptation (~100 tokens)
  const adaptiveRules = generateAdaptiveRules();

  // 3. VOCABULAIRE : Adaptation au cycle scolaire (~50 tokens)
  const vocabularyGuide = getVocabularyGuide(level);
  const vocabularyBlock = `## ADAPTATION VOCABULAIRE (OBLIGATOIRE)
${vocabularyGuide}`;

  // 4. STRUCTURE : Guide de réponse par cycle (~50 tokens)
  const structuredGuide = getStructuredResponseGuide(level);
  const structureBlock = `## STRUCTURE DES RÉPONSES
${structuredGuide}`;

  // 5. RAG : Contexte programmes officiels (variable)
  const ragBlock = ragContext ? formatRAGContext(ragContext, levelText) : '';

  // 6. SUBJECT : Règles spécifiques matière (~300-500 tokens)
  // Peut être null si matière non reconnue (conversation hors-sujet)
  // Passe le level pour adaptation KaTeX par niveau scolaire
  const subjectPrompt = generateSubjectPrompt({
    subject,
    query: userQuery,
    isExercice,
    isProduction,
    level
  });

  // 7. COMPOSITION FINALE
  const subjectBlock = subjectPrompt ? `\n${subjectPrompt}` : '';

  return `${identityPrompt}

${adaptiveRules}

${vocabularyBlock}

${structureBlock}

${ragBlock}${subjectBlock}

---
**Réponds maintenant à ${studentName} en t'adaptant à son niveau ${levelText}.**`;
}

/**
 * Formate le contexte RAG pour inclusion dans le prompt
 * SÉCURITÉ: Si contexte vide, instruction explicite de NE PAS inventer de contenu éducatif
 */
function formatRAGContext(context: string, levelText: string): string {
  if (!context || context.trim().length === 0) {
    // SÉCURITÉ: Guard-rail pour empêcher Gemini d'inventer du contenu éducatif
    // MAIS permet les interactions sociales (bonjour, merci, questions sur Tom...)
    return `## ⚠️ AUCUN CONTEXTE PROGRAMME OFFICIEL DISPONIBLE

**INTERACTIONS SOCIALES AUTORISÉES** :
Tu peux répondre normalement aux salutations, remerciements, questions sur toi-même.
Exemples : "Bonjour !" → "Bonjour ! Comment puis-je t'aider aujourd'hui ?"

**CONTENU ÉDUCATIF INTERDIT sans source** :
Si l'élève pose une question sur le programme scolaire, réponds :
"Je n'ai pas accès aux informations du programme officiel pour cette question.
Peux-tu me donner plus de détails ou reformuler ta question ?"

**Tu ne dois JAMAIS** :
- Inventer du contenu éducatif sans source officielle
- Supposer le contenu du programme
- Donner des exercices ou explications non vérifiés

`;
  }

  return `## PROGRAMMES OFFICIELS 2024-2025 (SOURCE DE VÉRITÉ)

${context}

**RÈGLES ABSOLUES** :
- Tu dois UNIQUEMENT utiliser les informations ci-dessus pour répondre
- Tu ne dois JAMAIS inventer ou ajouter d'informations non présentes dans ce contexte
- Si notion absente du contexte : "Cette notion n'est pas au programme de ${levelText}"

`;
}

/**
 * Estime le nombre de tokens du prompt
 * Approximation : 1 token ≈ 4 caractères en français
 */
export function estimateTokens(prompt: string): number {
  return Math.ceil(prompt.length / 4);
}

/**
 * Vérifie si le prompt nécessite KaTeX
 */
export function promptRequiresKaTeX(subject: string): boolean {
  return requiresKaTeX(subject);
}

