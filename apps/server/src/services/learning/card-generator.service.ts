/**
 * Card Generator Service - Single-Phase Architecture 2025
 *
 * Génération de cartes en UN SEUL appel Gemini.
 * - responseMimeType: 'application/json' → JSON syntaxiquement valide
 * - Prompt détaillé → structure correcte par type de carte
 * - Validation Zod → conformité métier stricte
 */

import { GoogleGenAI } from '@google/genai';
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
// GEMINI CLIENT
// ============================================================================

const genai = new GoogleGenAI({ apiKey: appConfig.ai.gemini.apiKey ?? '' });

// ============================================================================
// PROMPT BUILDER
// ============================================================================

function buildPrompt(params: CardGenerationParams): string {
  const { topic, subject, level, cardCount, ragContext, domaine } = params;
  const requiresKaTeX = subjectRequiresKaTeX(subject);
  const cycle = getEducationCycle(level);
  const recommendedTypes = getRecommendedCardTypes(subject).slice(0, 8);

  const parts: string[] = [];

  parts.push(`Tu es un expert pédagogue français. Génère exactement ${cardCount} cartes de révision pour des élèves de niveau ${level}.

**Principes** :
1. Commence par 1-2 cartes 'concept' pour les notions clés
2. Progresse du simple vers le complexe
3. Varie les types d'exercices
4. Chaque carte doit être autonome`);

  parts.push(getSubjectInstructions(subject));
  parts.push(getCycleAdaptationInstructions(cycle));

  // Structure EXACTE par type - guide Gemini
  parts.push(`## TYPES DE CARTES ET STRUCTURE EXACTE

Utilise les types recommandés: ${recommendedTypes.join(', ')}

**concept** (REQUIS: title, explanation, keyPoints[2-4])
{"cardType": "concept", "content": {"title": "...", "explanation": "...", "keyPoints": ["...", "..."], "example?": "...", "formula?": "..."}}

**flashcard** (REQUIS: front, back)
{"cardType": "flashcard", "content": {"front": "...", "back": "..."}}

**qcm** (REQUIS: question, options[2-6], correctIndex, explanation)
{"cardType": "qcm", "content": {"question": "...", "options": ["...", "..."], "correctIndex": 0, "explanation": "..."}}

**vrai_faux** (REQUIS: statement, isTrue, explanation)
{"cardType": "vrai_faux", "content": {"statement": "...", "isTrue": true, "explanation": "..."}}

**matching** (REQUIS: instruction, pairs[3-6])
{"cardType": "matching", "content": {"instruction": "...", "pairs": [{"left": "...", "right": "..."}]}}

**fill_blank** (REQUIS: sentence, options, correctIndex, explanation)
{"cardType": "fill_blank", "content": {"sentence": "La ___ est...", "options": ["...", "..."], "correctIndex": 0, "explanation": "...", "grammaticalPoint?": "..."}}

**word_order** (REQUIS: instruction, words, correctSentence)
{"cardType": "word_order", "content": {"instruction": "...", "words": ["...", "..."], "correctSentence": "...", "translation?": "..."}}

**calculation** (REQUIS: problem, steps, answer)
{"cardType": "calculation", "content": {"problem": "...", "steps": ["..."], "answer": "...", "hint?": "..."}}

**timeline** (REQUIS: instruction, events[3-6], correctOrder)
{"cardType": "timeline", "content": {"instruction": "...", "events": [{"event": "...", "date?": "...", "hint?": "..."}], "correctOrder": [0, 1, 2]}}

**matching_era** (REQUIS: instruction, items, eras, correctPairs)
{"cardType": "matching_era", "content": {"instruction": "...", "items": ["..."], "eras": ["..."], "correctPairs": [[0, 1]]}}

**cause_effect** (REQUIS: context, cause, possibleEffects, correctIndex, explanation)
{"cardType": "cause_effect", "content": {"context": "...", "cause": "...", "possibleEffects": ["...", "..."], "correctIndex": 0, "explanation": "..."}}

**classification** (REQUIS: instruction, items, categories, correctClassification)
{"cardType": "classification", "content": {"instruction": "...", "items": ["..."], "categories": ["..."], "correctClassification": {"catégorie": [0, 1]}, "explanation?": "..."}}

**process_order** (REQUIS: instruction, processName, steps, correctOrder)
{"cardType": "process_order", "content": {"instruction": "...", "processName": "...", "steps": ["..."], "correctOrder": [0, 1, 2], "explanation?": "..."}}

**grammar_transform** (REQUIS: instruction, originalSentence, transformationType, correctAnswer, explanation)
{"cardType": "grammar_transform", "content": {"instruction": "...", "originalSentence": "...", "transformationType": "tense|voice|form|number", "correctAnswer": "...", "explanation": "...", "acceptableVariants?": ["..."]}}`);

  if (requiresKaTeX) {
    parts.push(KATEX_INSTRUCTIONS);
  }

  parts.push(RICH_CONTENT_INSTRUCTIONS);

  if (ragContext?.trim()) {
    parts.push(`## PROGRAMME OFFICIEL\n${ragContext}`);
  }

  parts.push(`## GÉNÉRATION

**Matière**: ${subject}
**Niveau**: ${level}
**Sujet**: ${topic}${domaine ? `\n**Domaine**: ${domaine}` : ''}

Génère exactement ${cardCount} cartes. Retourne UNIQUEMENT un tableau JSON valide.

RÈGLES CRITIQUES:
- correctIndex est 0-based (première option = 0)
- isTrue est un boolean (true ou false, PAS une string)
- Tous les champs REQUIS doivent être présents pour chaque type
- Pas de texte avant/après le JSON`);

  return parts.join('\n\n');
}

// ============================================================================
// SERVICE PRINCIPAL
// ============================================================================

export async function generateCards(
  params: CardGenerationParams
): Promise<CardGenerationResult | CardGenerationError> {
  const startTime = Date.now();
  const provider = 'Google Gemini';

  try {
    logger.info('Starting card generation', {
      operation: 'learning:generate:start',
      topic: params.topic,
      subject: params.subject,
      level: params.level,
      requestedCards: params.cardCount
    });

    const prompt = buildPrompt(params);

    const { text, tokensUsed } = await withRetry(
      async () => {
        const response = await genai.models.generateContent({
          model: appConfig.ai.gemini.model,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            temperature: 0.7,
            topK: 40,
            topP: 0.95
          }
        });

        return {
          text: response.text ?? '',
          tokensUsed: response.usageMetadata?.totalTokenCount ?? 0
        };
      },
      {
        operationName: 'card-generation',
        maxAttempts: 3,
        initialDelayMs: 1000,
        nonRetryableErrors: ['INVALID_']
      }
    );

    // Parse JSON
    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(text);
    } catch {
      logger.error('Card generation JSON parse error', {
        operation: 'learning:generate:parse_error',
        topic: params.topic,
        contentPreview: text.substring(0, 300),
        durationMs: Date.now() - startTime,
        _error: 'JSON parse failed',
        severity: 'high' as const
      });

      return {
        success: false,
        error: 'La réponse IA n\'est pas un JSON valide',
        code: 'INVALID_OUTPUT'
      };
    }

    // Validation Zod stricte
    const validation = CardGenerationOutputSchema.safeParse(parsedJson);

    if (!validation.success) {
      const errors = validation.error.issues.slice(0, 5).map(i => `${i.path.join('.')}: ${i.message}`);

      logger.error('Card validation failed', {
        operation: 'learning:generate:validation_error',
        topic: params.topic,
        errors,
        durationMs: Date.now() - startTime,
        _error: errors.join('; '),
        severity: 'high' as const
      });

      return {
        success: false,
        error: `Cartes invalides: ${errors[0]}`,
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

    return {
      success: false,
      error: 'Échec de la génération des cartes. Veuillez réessayer.',
      code: errorMessage.includes('UNAVAILABLE') ? 'SERVICE_UNAVAILABLE' : 'GENERATION_FAILED'
    };
  }
}

export function isGenerationError(
  result: CardGenerationResult | CardGenerationError
): result is CardGenerationError {
  return 'success' in result && result.success === false;
}
