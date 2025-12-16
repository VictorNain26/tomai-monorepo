/**
 * Card Generator Service - TanStack AI Architecture 2025
 *
 * Génère des cartes de révision avec:
 * - Structured Output natif Gemini via TanStack AI
 * - Validation Zod des 13 types de cartes
 * - RAG context du programme officiel
 *
 * @see https://tanstack.com/ai/latest/docs/guides/structured-output
 */

import { chat } from '@tanstack/ai';
import {
  geminiAdapter,
  AI_MODELS,
  CardGenerationOutputSchema
} from '../../lib/ai/index.js';
import { buildCardGenerationPrompt } from './prompt-builder.service.js';
import { logger } from '../../lib/observability.js';
import type { CardGenerationParams, ParsedCard } from './types.js';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface CardGenerationResult {
  /** Cards générées avec succès */
  cards: ParsedCard[];
  /** Nombre de cards générées */
  count: number;
  /** Tokens utilisés pour la génération */
  tokensUsed: number;
  /** Provider utilisé */
  provider: string;
}

export interface CardGenerationError {
  /** Échec de génération */
  success: false;
  /** Message d'erreur */
  error: string;
  /** Code d'erreur pour le frontend */
  code: 'GENERATION_FAILED' | 'INVALID_OUTPUT' | 'SERVICE_UNAVAILABLE';
}

// ═══════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Génère des cartes de révision avec TanStack AI structured output
 *
 * Utilise le CardGenerationOutputSchema Zod pour garantir
 * la validité des cartes générées par Gemini.
 */
export async function generateCards(
  params: CardGenerationParams
): Promise<CardGenerationResult | CardGenerationError> {
  const startTime = Date.now();
  const provider = 'TanStack AI + Gemini';

  try {
    logger.info('Starting card generation', {
      operation: 'learning:generate:start',
      topic: params.topic,
      subject: params.subject,
      level: params.level,
      requestedCards: params.cardCount
    });

    // 1. Construire le prompt (inclut déjà les instructions JSON)
    const builtPrompt = buildCardGenerationPrompt(params);

    // 2. Générer avec TanStack AI chat (collect full response)
    const stream = chat({
      adapter: geminiAdapter,
      model: AI_MODELS.cards as 'gemini-2.5-flash',
      messages: [
        { role: 'user', content: builtPrompt.userPrompt }
      ],
      systemPrompts: [builtPrompt.systemPrompt],
      providerOptions: {
        generationConfig: {
          topK: 40,
          responseMimeType: 'application/json'
        }
      }
    });

    // 3. Collecter la réponse complète
    let fullContent = '';
    let tokensUsed = 0;

    for await (const chunk of stream) {
      if (chunk.type === 'content') {
        fullContent += chunk.delta ?? '';
      }
      if (chunk.type === 'done' && chunk.usage) {
        tokensUsed = chunk.usage.totalTokens ?? 0;
      }
      if (chunk.type === 'error') {
        throw new Error(chunk.error?.message ?? 'Streaming error');
      }
    }

    // 4. Parser le JSON et valider avec Zod
    let parsedJson: unknown;
    try {
      // Nettoyer le contenu (enlever markdown si présent)
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
        _error: 'JSON parse failed',
        durationMs: Date.now() - startTime,
        severity: 'medium' as const
      });

      return {
        success: false,
        error: 'La réponse IA n\'est pas un JSON valide',
        code: 'INVALID_OUTPUT'
      };
    }

    // 5. Valider avec Zod
    const validationResult = CardGenerationOutputSchema.safeParse(parsedJson);

    if (!validationResult.success) {
      logger.error('Card generation Zod validation failed', {
        operation: 'learning:generate:validation_error',
        topic: params.topic,
        _error: validationResult.error.message,
        durationMs: Date.now() - startTime,
        severity: 'medium' as const
      });

      return {
        success: false,
        error: 'Les cartes générées ne respectent pas le format attendu',
        code: 'INVALID_OUTPUT'
      };
    }

    const cards = validationResult.data;

    // 6. Vérifier que des cartes ont été générées
    if (cards.length === 0) {
      logger.error('Card generation returned empty result', {
        operation: 'learning:generate:empty',
        topic: params.topic,
        _error: 'Empty cards array',
        durationMs: Date.now() - startTime,
        severity: 'medium' as const
      });

      return {
        success: false,
        error: 'La génération n\'a produit aucune carte',
        code: 'INVALID_OUTPUT'
      };
    }

    logger.info('Card generation completed', {
      operation: 'learning:generate:complete',
      topic: params.topic,
      subject: params.subject,
      level: params.level,
      cardsGenerated: cards.length,
      requestedCards: params.cardCount,
      tokensUsed,
      durationMs: Date.now() - startTime
    });

    return {
      cards: cards as ParsedCard[],
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
      _error: errorMessage,
      durationMs: Date.now() - startTime,
      severity: 'high' as const
    });

    // Déterminer le code d'erreur approprié
    const code = errorMessage.includes('Service unavailable') ||
                 errorMessage.includes('UNAVAILABLE')
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
