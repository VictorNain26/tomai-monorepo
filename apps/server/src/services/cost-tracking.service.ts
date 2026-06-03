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
 * (configurable via env). Cached-input pricing is approximated at 10% of
 * standard input — the exact cache hit ratio is not available in the
 * Gemini streaming response so we treat cache savings conservatively.
 *
 * Unknown models: we insert a row with cost_cents=0 and a
 * billingMetadata.unknownModel flag rather than silently dropping the call.
 * Monitoring can alert on these.
 */

import { db } from '../db/connection.js';
import { costTracking } from '../db/schema.js';
import { logger } from '../lib/observability.js';
import { env } from '../config/env.js';

export type AiOperation = 'chat' | 'summarization' | 'auto-title' | 'card-generation' | 'intent-classify' | 'document-analysis';

export interface CostRecordInput {
  userId: string;
  sessionId?: string;
  aiModel: string;
  operation: AiOperation;
  tokensInput: number;
  tokensOutput: number;
  /** True when this call benefited from prompt caching; applies the cached rate. */
  cacheHit?: boolean;
}

/**
 * Published pricing in USD per million tokens (input / output) as of April
 * 2026. Update when vendors change pricing; values are source-of-truth for
 * accounting. Cached input is charged at ~10% of standard input across all
 * major vendors.
 */
const MODEL_PRICING_USD_PER_MILLION: Record<string, { input: number; output: number }> = {
  'mistral-medium-3': { input: 0.40, output: 2.00 },
  'mistral-large-3': { input: 2.00, output: 6.00 },
};

const CACHE_DISCOUNT = 0.10;

const USD_TO_EUR = env.USD_TO_EUR_RATE;

/** Normalize provider-suffixed model IDs down to the pricing key. */
function normalizeModelId(aiModel: string): string {
  // Handle Mistral variant with version suffix (e.g. mistral-medium-3-2024 → mistral-medium-3).
  const lower = aiModel.toLowerCase();
  for (const key of Object.keys(MODEL_PRICING_USD_PER_MILLION)) {
    if (lower.startsWith(key)) return key;
  }
  return lower;
}

function computeCostCents(
  aiModel: string,
  tokensInput: number,
  tokensOutput: number,
  cacheHit: boolean,
): { costCents: number; unknownModel: boolean } {
  const key = normalizeModelId(aiModel);
  const pricing = MODEL_PRICING_USD_PER_MILLION[key];
  if (!pricing) {
    return { costCents: 0, unknownModel: true };
  }

  const effectiveInputRate = cacheHit ? pricing.input * CACHE_DISCOUNT : pricing.input;
  const inputUsd = (tokensInput / 1_000_000) * effectiveInputRate;
  const outputUsd = (tokensOutput / 1_000_000) * pricing.output;
  const totalEur = (inputUsd + outputUsd) * USD_TO_EUR;

  // Store as cents (integer) — Math.round to nearest cent.
  return { costCents: Math.round(totalEur * 100), unknownModel: false };
}

class CostTrackingService {
  async record(input: CostRecordInput): Promise<void> {
    const { costCents, unknownModel } = computeCostCents(
      input.aiModel,
      input.tokensInput,
      input.tokensOutput,
      input.cacheHit ?? false,
    );

    if (unknownModel) {
      // Observability: an unmapped model leaves a $0 row but alerts us to
      // update the pricing table. Do not silently discard the call.
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
          cacheHit: input.cacheHit ?? false,
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
