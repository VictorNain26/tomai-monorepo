/**
 * Card Generator Service - Structured Output Architecture 2025
 *
 * Utilise @google/genai directement avec responseSchema natif.
 * Gemini GARANTIT un JSON conforme au schéma - plus de normalisation.
 *
 * Best practices 2025:
 * - responseSchema force l'output à être 100% conforme
 * - Zod validation en double-check (ne devrait jamais échouer)
 * - Single-phase generation (~10-15s)
 */

import { GoogleGenAI, Type } from '@google/genai';
import { CardGenerationOutputSchema } from '../../lib/ai/index.js';
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
import { appConfig } from '../../config/app.config.js';
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
// GEMINI CLIENT (Native SDK)
// ============================================================================

const genai = new GoogleGenAI({ apiKey: appConfig.ai.gemini.apiKey ?? '' });

// ============================================================================
// RESPONSE SCHEMA - Gemini Native Structured Output
// ============================================================================

/**
 * JSON Schema for cards - Gemini will ONLY output valid JSON matching this.
 * Using Type.* from @google/genai for proper schema format.
 */
const CARD_TYPE_ENUM = [
  'concept', 'flashcard', 'qcm', 'vrai_faux',
  'matching', 'fill_blank', 'word_order', 'calculation',
  'timeline', 'matching_era', 'cause_effect',
  'classification', 'process_order', 'grammar_transform'
];

const CARDS_RESPONSE_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      cardType: {
        type: Type.STRING,
        enum: CARD_TYPE_ENUM,
        description: 'Type de carte'
      },
      content: {
        type: Type.OBJECT,
        description: 'Contenu de la carte selon le type',
        properties: {
          // Concept
          title: { type: Type.STRING },
          explanation: { type: Type.STRING },
          keyPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
          example: { type: Type.STRING },
          formula: { type: Type.STRING },
          // Flashcard
          front: { type: Type.STRING },
          back: { type: Type.STRING },
          // QCM / Fill Blank / Cause Effect
          question: { type: Type.STRING },
          options: { type: Type.ARRAY, items: { type: Type.STRING } },
          correctIndex: { type: Type.INTEGER },
          // Vrai Faux
          statement: { type: Type.STRING },
          isTrue: { type: Type.BOOLEAN },
          // Common
          instruction: { type: Type.STRING },
          // Matching
          pairs: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                left: { type: Type.STRING },
                right: { type: Type.STRING }
              }
            }
          },
          // Fill Blank
          sentence: { type: Type.STRING },
          grammaticalPoint: { type: Type.STRING },
          // Word Order
          words: { type: Type.ARRAY, items: { type: Type.STRING } },
          correctSentence: { type: Type.STRING },
          translation: { type: Type.STRING },
          // Calculation
          problem: { type: Type.STRING },
          steps: { type: Type.ARRAY, items: { type: Type.STRING } },
          answer: { type: Type.STRING },
          hint: { type: Type.STRING },
          // Timeline
          events: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                event: { type: Type.STRING },
                date: { type: Type.STRING },
                hint: { type: Type.STRING }
              }
            }
          },
          correctOrder: { type: Type.ARRAY, items: { type: Type.INTEGER } },
          // Matching Era
          items: { type: Type.ARRAY, items: { type: Type.STRING } },
          eras: { type: Type.ARRAY, items: { type: Type.STRING } },
          correctPairs: {
            type: Type.ARRAY,
            items: { type: Type.ARRAY, items: { type: Type.INTEGER } }
          },
          // Cause Effect
          context: { type: Type.STRING },
          cause: { type: Type.STRING },
          possibleEffects: { type: Type.ARRAY, items: { type: Type.STRING } },
          // Classification
          categories: { type: Type.ARRAY, items: { type: Type.STRING } },
          correctClassification: { type: Type.OBJECT },
          // Process Order
          processName: { type: Type.STRING },
          // Grammar Transform
          originalSentence: { type: Type.STRING },
          transformationType: { type: Type.STRING },
          correctAnswer: { type: Type.STRING },
          acceptableVariants: { type: Type.ARRAY, items: { type: Type.STRING } }
        }
      }
    },
    required: ['cardType', 'content']
  }
};

// ============================================================================
// PROMPT BUILDER
// ============================================================================

function buildPrompt(params: CardGenerationParams): string {
  const { topic, subject, level, cardCount, ragContext, domaine } = params;
  const requiresKaTeX = subjectRequiresKaTeX(subject);
  const cycle = getEducationCycle(level);
  const recommendedTypes = getRecommendedCardTypes(subject).slice(0, 8);

  const parts: string[] = [];

  // Role et mission
  parts.push(`Tu es un expert pédagogue français. Génère exactement ${cardCount} cartes de révision pour des élèves de niveau ${level}.

**Principes** :
1. Commence par 1-2 cartes 'concept' pour les notions clés
2. Progresse du simple vers le complexe
3. Varie les types d'exercices
4. Chaque carte doit être autonome`);

  // Instructions matière
  parts.push(getSubjectInstructions(subject));

  // Adaptation au cycle
  parts.push(getCycleAdaptationInstructions(cycle));

  // Types disponibles avec structure exacte
  parts.push(`## TYPES DE CARTES (utilise ceux recommandés: ${recommendedTypes.join(', ')})

**concept**: title, explanation, keyPoints[] (2-4), example?, formula?
**flashcard**: front, back
**qcm**: question, options[] (2-6), correctIndex (0-based), explanation
**vrai_faux**: statement, isTrue (boolean), explanation
**matching**: instruction, pairs[{left, right}] (3-6)
**fill_blank**: sentence (avec ___), options[], correctIndex, explanation, grammaticalPoint?
**word_order**: instruction, words[], correctSentence, translation?
**calculation**: problem, steps[], answer, hint?
**timeline**: instruction, events[{event, date?, hint?}], correctOrder[]
**matching_era**: instruction, items[], eras[], correctPairs[[itemIdx, eraIdx]]
**cause_effect**: context, cause, possibleEffects[], correctIndex, explanation
**classification**: instruction, items[], categories[], correctClassification{catégorie: [indices]}
**process_order**: instruction, processName, steps[], correctOrder[], explanation?
**grammar_transform**: instruction, originalSentence, transformationType (tense|voice|form|number), correctAnswer, explanation, acceptableVariants?`);

  // KaTeX si nécessaire
  if (requiresKaTeX) {
    parts.push(KATEX_INSTRUCTIONS);
  }

  // Contenu enrichi
  parts.push(RICH_CONTENT_INSTRUCTIONS);

  // Contexte RAG
  if (ragContext?.trim()) {
    parts.push(`## PROGRAMME OFFICIEL\n${ragContext}`);
  }

  // Demande finale
  parts.push(`## GÉNÉRATION

**Matière**: ${subject}
**Niveau**: ${level}
**Sujet**: ${topic}${domaine ? `\n**Domaine**: ${domaine}` : ''}

Génère exactement ${cardCount} cartes. Structure recommandée:
1. 1-2 cartes 'concept' pour introduire
2. Exercices variés (qcm, vrai_faux, ${recommendedTypes.slice(2, 4).join(', ')}...)
3. Exercices de maîtrise pour finir

IMPORTANT:
- correctIndex est 0-based (première option = 0)
- isTrue est un boolean (true/false)
- Tous les champs requis doivent être présents`);

  return parts.join('\n\n');
}

// ============================================================================
// SERVICE PRINCIPAL
// ============================================================================

/**
 * Génère des cartes avec Gemini Structured Output natif.
 * Le schéma JSON force Gemini à générer du contenu 100% conforme.
 */
export async function generateCards(
  params: CardGenerationParams
): Promise<CardGenerationResult | CardGenerationError> {
  const startTime = Date.now();
  const provider = 'Google Gemini (Structured Output)';

  try {
    logger.info('Starting card generation', {
      operation: 'learning:generate:start',
      topic: params.topic,
      subject: params.subject,
      level: params.level,
      requestedCards: params.cardCount
    });

    const prompt = buildPrompt(params);

    // Appel Gemini avec Structured Output natif
    const { text, tokensUsed } = await withRetry(
      async () => {
        const response = await genai.models.generateContent({
          model: appConfig.ai.gemini.model,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: CARDS_RESPONSE_SCHEMA,
            temperature: 0.7,
            topK: 40,
            topP: 0.95
          }
        });

        const text = response.text ?? '';
        const tokens = response.usageMetadata?.totalTokenCount ?? 0;

        return { text, tokensUsed: tokens };
      },
      {
        operationName: 'card-generation-structured',
        maxAttempts: 3,
        initialDelayMs: 1000,
        nonRetryableErrors: ['INVALID_']
      }
    );

    // Parser le JSON (garanti valide par Gemini)
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(text);
    } catch {
      logger.error('Card generation JSON parse error (unexpected)', {
        operation: 'learning:generate:parse_error',
        topic: params.topic,
        contentPreview: text.substring(0, 300),
        durationMs: Date.now() - startTime,
        _error: 'JSON parse failed despite structured output',
        severity: 'high' as const
      });

      return {
        success: false,
        error: 'Erreur inattendue: JSON invalide malgré Structured Output',
        code: 'INVALID_OUTPUT'
      };
    }

    // Double-check avec Zod (ne devrait jamais échouer avec Structured Output)
    const validation = CardGenerationOutputSchema.safeParse(parsedJson);

    if (!validation.success) {
      logger.error('Card validation failed (unexpected with structured output)', {
        operation: 'learning:generate:validation_error',
        topic: params.topic,
        zodError: validation.error.issues.slice(0, 3),
        durationMs: Date.now() - startTime,
        _error: 'Zod validation failed despite structured output',
        severity: 'high' as const
      });

      return {
        success: false,
        error: 'Erreur de validation inattendue. Veuillez réessayer.',
        code: 'INVALID_OUTPUT'
      };
    }

    const cards = validation.data as ParsedCard[];
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
