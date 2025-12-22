/**
 * Card Generator Service - Architecture Single-Phase 2025
 *
 * Génération de cartes en UN SEUL appel Gemini.
 * Latence optimisée : ~10-15s au lieu de ~25-35s (2 phases).
 *
 * L'IA reçoit toutes les instructions nécessaires pour :
 * - Structurer les notions de façon pédagogique
 * - Choisir les types de cartes adaptés
 * - Générer le contenu directement
 */

import { chat } from '@tanstack/ai';
import { geminiAdapter, AI_MODELS, CardGenerationOutputSchema } from '../../lib/ai/index.js';
import {
  getSubjectInstructions,
  getRecommendedCardTypes,
  subjectRequiresKaTeX,
  getEducationCycle,
  getCycleAdaptationInstructions
} from './prompts/index.js';
import { KATEX_INSTRUCTIONS, RICH_CONTENT_INSTRUCTIONS } from './prompts/base.js';
import { logger } from '../../lib/observability.js';
import { withRetry } from '../../lib/retry.js';
import type { CardGenerationParams, ParsedCard } from './types.js';

// ============================================================================
// TYPES
// ============================================================================

export interface CardGenerationResult {
  cards: ParsedCard[];
  count: number;
  tokensUsed: number;
  provider: string;
}

export interface CardGenerationError {
  success: false;
  error: string;
  code: 'GENERATION_FAILED' | 'INVALID_OUTPUT' | 'SERVICE_UNAVAILABLE';
}

// ============================================================================
// PROMPT BUILDER
// ============================================================================

function buildUnifiedPrompt(params: CardGenerationParams): { systemPrompt: string; userPrompt: string } {
  const { topic, subject, level, cardCount, ragContext, domaine } = params;
  const requiresKaTeX = subjectRequiresKaTeX(subject);
  const cycle = getEducationCycle(level);
  const recommendedTypes = getRecommendedCardTypes(subject).slice(0, 8);

  // System Prompt - Expert pédagogue
  const systemParts: string[] = [];

  systemParts.push(`Tu es un expert pédagogue français spécialisé dans la création de cartes de révision.

**Ta mission** : Générer ${cardCount} cartes de révision pour des élèves de niveau ${level}.

**Principes pédagogiques** :
1. Commence par 1-2 cartes 'concept' pour introduire les notions clés
2. Progresse du simple vers le complexe
3. Varie les types d'exercices pour maintenir l'attention
4. Chaque carte doit être autonome et claire`);

  // Instructions matière
  systemParts.push(getSubjectInstructions(subject));

  // Adaptation au cycle
  systemParts.push(getCycleAdaptationInstructions(cycle));

  // Types de cartes disponibles
  systemParts.push(`## TYPES DE CARTES DISPONIBLES

Types recommandés pour ${subject} : ${recommendedTypes.join(', ')}

**Pédagogique**
- concept: {title, explanation, keyPoints[], example?, formula?}

**Universels**
- flashcard: {front, back}
- qcm: {question, options[], correctIndex, explanation}
- vrai_faux: {statement, isTrue, explanation}

**Langues**
- matching: {instruction, pairs[{left, right}]}
- fill_blank: {sentence, options[], correctIndex, grammaticalPoint?, explanation}
- word_order: {instruction, words[], correctSentence, translation?}

**Maths/Sciences**
- calculation: {problem, steps[], answer, hint?}

**Histoire-Géo**
- timeline: {instruction, events[{event, date?, hint?}], correctOrder[]}
- matching_era: {instruction, items[], eras[], correctPairs[]}
- cause_effect: {context, cause, possibleEffects[], correctIndex, explanation}

**SVT**
- classification: {instruction, items[], categories[], correctClassification{}, explanation?}
- process_order: {instruction, processName, steps[], correctOrder[], explanation?}

**Français**
- grammar_transform: {instruction, originalSentence, transformationType, correctAnswer, acceptableVariants?, explanation}`);

  // KaTeX si nécessaire
  if (requiresKaTeX) {
    systemParts.push(KATEX_INSTRUCTIONS);
  }

  // Contenu enrichi
  systemParts.push(RICH_CONTENT_INSTRUCTIONS);

  // Format de sortie
  systemParts.push(`## FORMAT DE SORTIE

Retourne UNIQUEMENT un tableau JSON valide :
[
  {"cardType": "concept", "content": {...}},
  {"cardType": "qcm", "content": {...}},
  ...
]

**Règles JSON :**
- Pas de texte avant/après le JSON
- Guillemets doubles pour strings
- correctIndex commence à 0${requiresKaTeX ? '\n- KaTeX: double backslash (\\\\pi pour π, \\\\frac{a}{b} pour fractions)' : ''}`);

  const systemPrompt = systemParts.join('\n\n');

  // User Prompt
  const userLines: string[] = [];

  userLines.push('## DEMANDE DE GÉNÉRATION\n');
  userLines.push(`**Matière** : ${subject}`);
  userLines.push(`**Niveau** : ${level}`);
  userLines.push(`**Sujet** : ${topic}`);
  if (domaine) {
    userLines.push(`**Domaine** : ${domaine}`);
  }
  userLines.push(`**Nombre de cartes** : ${cardCount}`);

  if (ragContext?.trim()) {
    userLines.push('\n## PROGRAMME OFFICIEL (contexte)\n');
    userLines.push(ragContext);
  }

  userLines.push(`\n## CONSIGNE

Génère exactement ${cardCount} cartes de révision sur "${topic}".

Structure recommandée :
1. Commence par 1-2 cartes 'concept' pour les notions fondamentales
2. Enchaîne avec des exercices variés (qcm, vrai_faux, ${recommendedTypes.slice(2, 4).join(', ')}...)
3. Termine par des exercices de niveau maîtrise

**Génère le JSON maintenant.**`);

  const userPrompt = userLines.join('\n');

  return { systemPrompt, userPrompt };
}

// ============================================================================
// SERVICE PRINCIPAL
// ============================================================================

/**
 * Génère des cartes de révision en un seul appel Gemini
 */
export async function generateCards(
  params: CardGenerationParams
): Promise<CardGenerationResult | CardGenerationError> {
  const startTime = Date.now();
  const provider = 'TanStack AI + Gemini (Single-Phase)';

  try {
    logger.info('Starting card generation', {
      operation: 'learning:generate:start',
      topic: params.topic,
      subject: params.subject,
      level: params.level,
      requestedCards: params.cardCount
    });

    const { systemPrompt, userPrompt } = buildUnifiedPrompt(params);

    // Appel IA avec retry pour robustesse
    const { fullContent, tokensUsed } = await withRetry(
      async () => {
        const stream = chat({
          adapter: geminiAdapter,
          model: AI_MODELS.cards as 'gemini-2.5-flash',
          messages: [{ role: 'user', content: userPrompt }],
          systemPrompts: [systemPrompt],
          providerOptions: {
            generationConfig: {
              topK: 40,
              responseMimeType: 'application/json'
            }
          }
        });

        let content = '';
        let tokens = 0;

        for await (const chunk of stream) {
          if (chunk.type === 'content') {
            content += chunk.delta ?? '';
          }
          if (chunk.type === 'done' && chunk.usage) {
            tokens = chunk.usage.totalTokens ?? 0;
          }
          if (chunk.type === 'error') {
            throw new Error(chunk.error?.message ?? 'Streaming error');
          }
        }

        return { fullContent: content, tokensUsed: tokens };
      },
      {
        operationName: 'card-generation',
        maxAttempts: 3,
        initialDelayMs: 1000,
        nonRetryableErrors: ['INVALID_']
      }
    );

    // Parser le JSON
    let parsedJson: unknown;
    try {
      const cleanedContent = fullContent
        .replace(/^```json\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();
      parsedJson = JSON.parse(cleanedContent);
    } catch {
      logger.error('Card generation JSON parse error', {
        operation: 'learning:generate:parse_error',
        topic: params.topic,
        contentPreview: fullContent.substring(0, 200),
        durationMs: Date.now() - startTime,
        _error: 'JSON parse failed',
        severity: 'medium' as const
      });

      return {
        success: false,
        error: 'La réponse IA n\'est pas un JSON valide',
        code: 'INVALID_OUTPUT'
      };
    }

    // Valider avec Zod
    const validationResult = CardGenerationOutputSchema.safeParse(parsedJson);

    if (!validationResult.success) {
      logger.error('Card generation Zod validation failed', {
        operation: 'learning:generate:validation_error',
        topic: params.topic,
        durationMs: Date.now() - startTime,
        _error: validationResult.error.message,
        severity: 'medium' as const
      });

      return {
        success: false,
        error: 'Les cartes générées ne respectent pas le format attendu',
        code: 'INVALID_OUTPUT'
      };
    }

    const cards = validationResult.data as ParsedCard[];

    if (cards.length === 0) {
      return {
        success: false,
        error: 'La génération n\'a produit aucune carte',
        code: 'INVALID_OUTPUT'
      };
    }

    const durationMs = Date.now() - startTime;

    logger.info('Card generation completed', {
      operation: 'learning:generate:complete',
      topic: params.topic,
      subject: params.subject,
      level: params.level,
      cardsGenerated: cards.length,
      requestedCards: params.cardCount,
      tokensUsed,
      durationMs
    });

    return {
      cards,
      count: cards.length,
      tokensUsed,
      provider
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('Card generation failed', {
      operation: 'learning:generate:error',
      topic: params.topic,
      subject: params.subject,
      durationMs: Date.now() - startTime,
      _error: errorMessage,
      severity: 'high' as const
    });

    const code = errorMessage.includes('UNAVAILABLE')
      ? 'SERVICE_UNAVAILABLE'
      : 'GENERATION_FAILED';

    return {
      success: false,
      error: 'Échec de la génération des cartes. Veuillez réessayer.',
      code
    };
  }
}

/**
 * Vérifie si le résultat est une erreur
 */
export function isGenerationError(
  result: CardGenerationResult | CardGenerationError
): result is CardGenerationError {
  return 'success' in result && result.success === false;
}
