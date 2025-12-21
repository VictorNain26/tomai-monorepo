/**
 * Card Generator Service - Architecture Meta-Planning 2025
 *
 * Génération de cartes en 2 phases :
 * 1. Planning : L'IA structure le deck (deck-planner.service.ts)
 * 2. Génération : L'IA génère les cartes selon son propre plan
 *
 * Cette approche permet :
 * - Une progression pédagogique optimale adaptée au contenu
 * - Une structure flexible sans règles rigides
 * - Des guardrails minimaux validés par Zod
 */

import { chat } from '@tanstack/ai';
import {
  geminiAdapter,
  AI_MODELS,
  CardGenerationOutputSchema,
  type DeckPlan
} from '../../lib/ai/index.js';
import {
  generateDeckPlan,
  isPlanError,
  type DeckPlanResult
} from './deck-planner.service.js';
import { buildCardExecutionPrompt } from './prompt-builder.service.js';
import { logger } from '../../lib/observability.js';
import { withRetry } from '../../lib/retry.js';
import type { CardGenerationParams, ParsedCard } from './types.js';

// ============================================================================
// TYPES
// ============================================================================

export interface CardGenerationResult {
  /** Cards générées avec succès */
  cards: ParsedCard[];
  /** Nombre de cards générées */
  count: number;
  /** Tokens utilisés (planning + génération) */
  tokensUsed: number;
  /** Provider utilisé */
  provider: string;
  /** Plan utilisé pour la génération */
  plan: DeckPlan;
  /** Le plan a-t-il été auto-corrigé */
  planWasAutoFixed: boolean;
}

export interface CardGenerationError {
  /** Échec de génération */
  success: false;
  /** Message d'erreur */
  error: string;
  /** Code d'erreur pour le frontend */
  code: 'GENERATION_FAILED' | 'PLANNING_FAILED' | 'INVALID_OUTPUT' | 'SERVICE_UNAVAILABLE';
}

// ============================================================================
// SERVICE PRINCIPAL
// ============================================================================

/**
 * Génère des cartes de révision avec meta-planning
 *
 * Phase 1: L'IA planifie la structure du deck
 * Phase 2: L'IA génère les cartes selon son plan
 */
export async function generateCards(
  params: CardGenerationParams
): Promise<CardGenerationResult | CardGenerationError> {
  const startTime = Date.now();
  const provider = 'TanStack AI + Gemini (Meta-Planning)';

  try {
    logger.info('Starting meta-planning card generation', {
      operation: 'learning:generate:start',
      topic: params.topic,
      subject: params.subject,
      level: params.level,
      requestedCards: params.cardCount
    });

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 1: PLANNING
    // ═══════════════════════════════════════════════════════════════════════

    const planResult = await generateDeckPlan(params);

    if (isPlanError(planResult)) {
      return {
        success: false,
        error: planResult.error,
        code: 'PLANNING_FAILED'
      };
    }

    const { plan, tokensUsed: planTokens, wasAutoFixed } = planResult as DeckPlanResult;

    logger.info('Phase 1 complete: Plan generated', {
      operation: 'learning:generate:plan_complete',
      topic: params.topic,
      notions: plan.notions.length,
      planTokens
    });

    // ═══════════════════════════════════════════════════════════════════════
    // PHASE 2: GÉNÉRATION DES CARTES
    // ═══════════════════════════════════════════════════════════════════════

    const { systemPrompt, userPrompt } = buildCardExecutionPrompt(params, plan);

    // Appel IA Phase 2 avec retry pour robustesse
    const { fullContent, genTokens } = await withRetry(
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

        return { fullContent: content, genTokens: tokens };
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

    const totalTokens = planTokens + genTokens;

    logger.info('Meta-planning card generation completed', {
      operation: 'learning:generate:complete',
      topic: params.topic,
      subject: params.subject,
      level: params.level,
      cardsGenerated: cards.length,
      requestedCards: params.cardCount,
      planWasAutoFixed: wasAutoFixed,
      tokensUsed: totalTokens,
      durationMs: Date.now() - startTime
    });

    return {
      cards,
      count: cards.length,
      tokensUsed: totalTokens,
      provider,
      plan,
      planWasAutoFixed: wasAutoFixed
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
