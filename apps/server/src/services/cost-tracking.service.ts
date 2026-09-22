/**
 * Cost Tracking Service — persist per-call AI spend.
 *
 * The `cost_tracking` table has existed for a while (see
 * progress.service.getCostTracking) but was never populated by the chat
 * pipeline, leaving dashboards empty. This service computes a per-message
 * cost in cents from model pricing and inserts a row after each assistant
 * response.
 *
 * Pricing is expressed in USD per million tokens, as published by Mistral,
 * keyed by dated model id (no aliases: an alias can silently change price).
 * Cached tokens are billed at 10 % of the input rate; the EU regional endpoint
 * adds 10 % to everything (docs.mistral.ai/inference/regional-inference).
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

const MODEL_PRICING_USD_PER_MILLION: Record<string, { input: number; output: number }> = {
  'mistral-small-2603': { input: 0.15, output: 0.60 },
};

const CACHE_DISCOUNT = 0.10;
const EU_REGIONAL_UPCHARGE = 1.1;

const USD_TO_EUR = env.USD_TO_EUR_RATE;

export function regionalUpcharge(serverUrl: string): number {
  return new URL(serverUrl).host === 'api.eu.mistral.ai' ? EU_REGIONAL_UPCHARGE : 1;
}

export function computeCostCents(
  aiModel: string,
  tokensInput: number,
  tokensOutput: number,
  cachedTokens: number,
  upcharge: number,
): { costCents: number; unknownModel: boolean } {
  const pricing = MODEL_PRICING_USD_PER_MILLION[aiModel];
  if (!pricing) {
    return { costCents: 0, unknownModel: true };
  }

  const cached = Math.min(Math.max(cachedTokens, 0), tokensInput);
  const uncachedInput = tokensInput - cached;
  const inputUsd =
    (uncachedInput / 1_000_000) * pricing.input +
    (cached / 1_000_000) * pricing.input * CACHE_DISCOUNT;
  const outputUsd = (tokensOutput / 1_000_000) * pricing.output;
  const totalEur = (inputUsd + outputUsd) * upcharge * USD_TO_EUR;

  return { costCents: Math.round(totalEur * 100), unknownModel: false };
}

class CostTrackingService {
  async record(input: CostRecordInput): Promise<void> {
    const upcharge = regionalUpcharge(env.MISTRAL_SERVER_URL);
    const { costCents, unknownModel } = computeCostCents(
      input.aiModel,
      input.tokensInput,
      input.tokensOutput,
      input.cachedTokens ?? 0,
      upcharge,
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
          regionalUpcharge: upcharge,
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
