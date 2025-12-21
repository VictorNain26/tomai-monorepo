/**
 * Deck Planner Service - Phase 1 du meta-planning
 *
 * Génère un plan structuré avant la création des cartes.
 * L'IA analyse le sujet et propose une progression pédagogique
 * optimale, validée par des guardrails minimaux.
 */

import { chat } from '@tanstack/ai';
import { geminiAdapter, AI_MODELS } from '../../lib/ai/index.js';
import {
  DeckPlanSchema,
  validateDeckPlan,
  autoFixPlan,
  type DeckPlan,
  type PlanValidationResult
} from '../../lib/ai/schemas/deck-planner.schema.js';
import { buildDeckPlannerPrompt } from './prompts/deck-planner.prompt.js';
import { getRecommendedCardTypes } from './prompts/by-subject.js';
import { logger } from '../../lib/observability.js';
import { withRetry } from '../../lib/retry.js';
import type { CardGenerationParams } from './types.js';

// ============================================================================
// TYPES
// ============================================================================

export interface DeckPlanResult {
  plan: DeckPlan;
  validation: PlanValidationResult;
  tokensUsed: number;
  wasAutoFixed: boolean;
}

export interface DeckPlanError {
  success: false;
  error: string;
  code: 'PLANNING_FAILED' | 'INVALID_PLAN' | 'SERVICE_UNAVAILABLE';
}

// ============================================================================
// SERVICE
// ============================================================================

/**
 * Génère un plan de deck avec TanStack AI
 * Phase 1 du meta-planning : l'IA structure le deck avant génération
 */
export async function generateDeckPlan(
  params: CardGenerationParams
): Promise<DeckPlanResult | DeckPlanError> {
  const startTime = Date.now();

  try {
    logger.info('Starting deck planning', {
      operation: 'learning:plan:start',
      topic: params.topic,
      subject: params.subject,
      level: params.level,
      requestedCards: params.cardCount
    });

    // 1. Récupérer les types suggérés pour la matière
    const suggestedCardTypes = getRecommendedCardTypes(params.subject);

    // 2. Construire le prompt de planification
    const { systemPrompt, userPrompt } = buildDeckPlannerPrompt({
      topic: params.topic,
      subject: params.subject,
      level: params.level,
      cardCount: params.cardCount,
      ragContext: params.ragContext,
      suggestedCardTypes
    });

    // 3. Appel IA avec retry pour robustesse
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
        operationName: 'deck-planning',
        maxAttempts: 3,
        initialDelayMs: 1000,
        nonRetryableErrors: ['INVALID_']
      }
    );

    // 5. Parser le JSON
    let parsedJson: unknown;
    try {
      const cleanedContent = fullContent
        .replace(/^```json\s*/i, '')
        .replace(/```\s*$/i, '')
        .trim();
      parsedJson = JSON.parse(cleanedContent);
    } catch {
      logger.error('Deck plan JSON parse error', {
        operation: 'learning:plan:parse_error',
        topic: params.topic,
        contentPreview: fullContent.substring(0, 200),
        durationMs: Date.now() - startTime,
        _error: 'JSON parse failed',
        severity: 'medium' as const
      });

      return {
        success: false,
        error: 'Le plan généré n\'est pas un JSON valide',
        code: 'INVALID_PLAN'
      };
    }

    // 6. Valider avec Zod
    const zodResult = DeckPlanSchema.safeParse(parsedJson);

    if (!zodResult.success) {
      logger.error('Deck plan Zod validation failed', {
        operation: 'learning:plan:validation_error',
        topic: params.topic,
        durationMs: Date.now() - startTime,
        _error: zodResult.error.message,
        severity: 'medium' as const
      });

      return {
        success: false,
        error: 'Le plan ne respecte pas le format attendu',
        code: 'INVALID_PLAN'
      };
    }

    let plan = zodResult.data;
    let wasAutoFixed = false;

    // 7. Valider avec guardrails
    const validation = validateDeckPlan(plan);

    // 8. Auto-fix si nécessaire et possible
    if (!validation.isValid) {
      logger.warn('Deck plan invalid, attempting auto-fix', {
        operation: 'learning:plan:autofix',
        topic: params.topic,
        errors: validation.errors
      });

      plan = autoFixPlan(plan);
      wasAutoFixed = true;

      // Re-valider après fix
      const revalidation = validateDeckPlan(plan);
      if (!revalidation.isValid) {
        return {
          success: false,
          error: `Plan invalide: ${revalidation.errors.join(', ')}`,
          code: 'INVALID_PLAN'
        };
      }
    }

    logger.info('Deck planning completed', {
      operation: 'learning:plan:complete',
      topic: params.topic,
      notions: plan.notions.length,
      totalCards: plan.totalCards,
      wasAutoFixed,
      tokensUsed,
      durationMs: Date.now() - startTime
    });

    return {
      plan,
      validation,
      tokensUsed,
      wasAutoFixed
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    logger.error('Deck planning failed', {
      operation: 'learning:plan:error',
      topic: params.topic,
      durationMs: Date.now() - startTime,
      _error: errorMessage,
      severity: 'high' as const
    });

    const code = errorMessage.includes('UNAVAILABLE')
      ? 'SERVICE_UNAVAILABLE'
      : 'PLANNING_FAILED';

    return {
      success: false,
      error: 'Échec de la planification du deck',
      code
    };
  }
}

/**
 * Vérifie si le résultat est une erreur
 */
export function isPlanError(
  result: DeckPlanResult | DeckPlanError
): result is DeckPlanError {
  return 'success' in result && result.success === false;
}
