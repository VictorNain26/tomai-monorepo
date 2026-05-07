/**
 * Cost Tracking Service — persist per-call AI spend.
 *
 * The `cost_tracking` table is populated after each Mistral call (chat,
 * summarization, auto-title, card-generation, intent-classify, document
 * analysis, transcription, TTS).
 *
 * Pricing is expressed in USD per million tokens, as published by Mistral.
 * Converted to cents at insert time using a configurable USD/EUR rate.
 * Cached input is approximated at 10% of standard rate (exact cache hit
 * ratio isn't surfaced in the streaming response — conservative estimate).
 *
 * Unknown models leave a cost_cents=0 row plus billingMetadata.unknownModel
 * flag instead of being silently dropped, so monitoring can alert.
 */

import { db } from '../db/connection.js';
import { costTracking } from '../db/schema.js';
import { logger } from '../lib/observability.js';

export type AiOperation =
  | 'chat'
  | 'summarization'
  | 'auto-title'
  | 'card-generation'
  | 'intent-classify'
  | 'document-analysis'
  | 'transcription'
  | 'tts';

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
 * Mistral pricing (USD per 1M tokens), May 2026.
 * Source : artificialanalysis.ai + docs.mistral.ai/pricing.
 */
const MODEL_PRICING_USD_PER_MILLION: Record<string, { input: number; output: number }> = {
  'mistral-small': { input: 0.15, output: 0.60 },
  'mistral-small-latest': { input: 0.15, output: 0.60 },
  'mistral-medium': { input: 1.50, output: 7.50 },
  'mistral-medium-latest': { input: 1.50, output: 7.50 },
  'mistral-medium-3': { input: 0.40, output: 2.00 },
  'mistral-medium-3-5': { input: 1.50, output: 7.50 },
  'mistral-large': { input: 0.50, output: 1.50 },
  'mistral-large-latest': { input: 0.50, output: 1.50 },
  'mistral-large-3': { input: 0.50, output: 1.50 },
  'magistral-medium': { input: 2.00, output: 5.00 },
  'magistral-medium-latest': { input: 2.00, output: 5.00 },
  'magistral-small': { input: 0.50, output: 1.50 },
  'magistral-small-latest': { input: 0.50, output: 1.50 },
  'mistral-embed': { input: 0.10, output: 0 },
  'voxtral-mini-transcribe': { input: 0, output: 0 },
  'voxtral-mini-transcribe-latest': { input: 0, output: 0 },
  'voxtral-tts': { input: 0, output: 0 },
  'voxtral-tts-latest': { input: 0, output: 0 },
};

const CACHE_DISCOUNT = 0.10;

function resolveUsdRate(): number {
  const raw = Bun.env['USD_TO_EUR_RATE'];
  if (!raw) return 0.92;
  const parsed = parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0.92;
  return parsed;
}

const USD_TO_EUR = resolveUsdRate();

/** Normalize provider-suffixed model IDs down to the pricing key. */
function normalizeModelId(aiModel: string): string {
  // Handle dated previews / variants by prefix-matching against the canonical
  // pricing keys (e.g. mistral-small-2603 → mistral-small).
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
