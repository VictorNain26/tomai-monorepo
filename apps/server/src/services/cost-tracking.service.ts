/**
 * Cost Tracking Service — persist per-call AI spend.
 *
 * The `cost_tracking` table has existed for a while (see
 * progress.service.getCostTracking) but was never populated by the chat
 * pipeline, leaving dashboards empty. This service computes a per-message
 * cost in cents from model pricing and inserts a row after each assistant
 * response.
 *
 * Pricing is expressed in USD per million tokens, as published by each
 * provider. We convert to cents at insert time using a fixed USD/EUR rate
 * (configurable via env). Cached tokens (from prompt_tokens_details.cached_tokens
 * in the Mistral SSE response) are billed at 10% of the standard input rate.
 *
 * Unknown models: we insert a row with cost_cents=0 and a
 * billingMetadata.unknownModel flag rather than silently dropping the call.
 * Monitoring can alert on these.
 */

import { db } from '../db/connection.js';
import { costTracking } from '../db/schema.js';
import { logger } from '../lib/observability.js';
import { env } from '../config/env.js';

type AiOperation = 'chat' | 'summarization' | 'auto-title' | 'card-generation' | 'intent-classify' | 'document-analysis';

interface CostRecordInput {
  userId: string;
  sessionId?: string;
  aiModel: string;
  operation: AiOperation;
  tokensInput: number;
  tokensOutput: number;
  /** Tokens served from the prompt cache (billed at 10% of input rate). */
  cachedTokens?: number;
}

/**
 * Published Mistral pricing in USD per million tokens (input / output),
 * as published at mistral.ai/pricing (juin 2026). Keys are prefixes:
 * normalizeModelId matches via startsWith, so "mistral-medium" covers
 * "mistral-medium-latest", "mistral-medium-2508", etc. Longer prefixes
 * (ministral-3b, ministral-8b) must come before shorter ones to avoid
 * shadowing.
 */
const MODEL_PRICING_USD_PER_MILLION: Record<string, { input: number; output: number }> = {
  'magistral-medium':  { input: 2.00,  output: 5.00  },
  'magistral-small':   { input: 0.50,  output: 1.50  },
  'ministral-3b':      { input: 0.10,  output: 0.10  },
  'ministral-8b':      { input: 0.15,  output: 0.15  },
  'mistral-medium':    { input: 1.50,  output: 7.50  },
  'mistral-small':     { input: 0.15,  output: 0.60  }, // Small 4 (mistral.ai/pricing 2026)
  'mistral-large':     { input: 0.50,  output: 1.50  },
};

const CACHE_DISCOUNT = 0.10;

const USD_TO_EUR = env.USD_TO_EUR_RATE;

/** Normalize provider-suffixed model IDs down to the pricing key. */
function normalizeModelId(aiModel: string): string {
  // Normalize provider-suffixed model IDs to their pricing prefix
  // (e.g. "mistral-medium-latest" → "mistral-medium").
  const lower = aiModel.toLowerCase();
  for (const key of Object.keys(MODEL_PRICING_USD_PER_MILLION)) {
    if (lower.startsWith(key)) return key;
  }
  return lower;
}

export function computeCostCents(
  aiModel: string,
  tokensInput: number,
  tokensOutput: number,
  cachedTokens: number,
): { costCents: number; unknownModel: boolean } {
  const key = normalizeModelId(aiModel);
  const pricing = MODEL_PRICING_USD_PER_MILLION[key];
  if (!pricing) {
    return { costCents: 0, unknownModel: true };
  }

  const cached = Math.min(Math.max(cachedTokens, 0), tokensInput);
  const uncachedInput = tokensInput - cached;
  const inputUsd =
    (uncachedInput / 1_000_000) * pricing.input +
    (cached / 1_000_000) * pricing.input * CACHE_DISCOUNT;
  const outputUsd = (tokensOutput / 1_000_000) * pricing.output;
  const totalEur = (inputUsd + outputUsd) * USD_TO_EUR;

  return { costCents: Math.round(totalEur * 100), unknownModel: false };
}

class CostTrackingService {
  async record(input: CostRecordInput): Promise<void> {
    const { costCents, unknownModel } = computeCostCents(
      input.aiModel,
      input.tokensInput,
      input.tokensOutput,
      input.cachedTokens ?? 0,
    );

    if (unknownModel) {
      // Ligne à $0 intentionnelle — signale au monitoring de mettre à jour MODEL_PRICING_USD_PER_MILLION.
      logger.warn('Cost tracking: unknown model pricing', {
        operation: 'cost-tracking:unknown-model',
        aiModel: input.aiModel,
        severity: 'medium' as const,
      });
    }

    try {
      await db.insert(costTracking).values({
        userId: input.userId,
        sessionId: input.sessionId ?? null,
        aiModel: input.aiModel,
        operation: input.operation,
        tokensInput: input.tokensInput,
        tokensOutput: input.tokensOutput,
        costCents,
        billingMetadata: {
          cachedTokens: input.cachedTokens ?? 0,
          unknownModel,
          usdToEur: USD_TO_EUR,
        },
      });
    } catch (err) {
      // Cost tracking insert failure should NOT break the request path.
      // Log at high severity so ops can repair the pipeline.
      logger.error('Cost tracking insert failed', {
        operation: 'cost-tracking:insert-failed',
        aiModel: input.aiModel,
        _error: err instanceof Error ? err.message : String(err),
        severity: 'high' as const,
      });
    }
  }
}

export const costTrackingService = new CostTrackingService();
