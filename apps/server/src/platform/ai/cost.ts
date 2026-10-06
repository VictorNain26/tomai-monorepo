/**
 * The cost of each AI call, in micro-euros, written to `cost_tracking` (table of `billing`).
 *
 * Pricing is expressed in USD as published by Mistral — per million tokens, per minute of
 * audio, per million characters — keyed by dated model id (no aliases: an alias can silently
 * change price). Cached tokens are billed at 10 % of the input rate; the EU regional endpoint
 * adds 10 % to everything (docs.mistral.ai/inference/regional-inference). Mistral bills in euros
 * at its own conversion, `MISTRAL_USD_TO_EUR`. Moderation is free
 * (docs.mistral.ai/models/mistral-moderation-26-03) and not recorded.
 *
 * Unknown models: a row with cost_micro_eur=0 and a billingMetadata.unknownModel flag rather
 * than silently dropping the call. Monitoring can alert on these.
 */

import { db } from '../../db/connection.js';
import { costTracking } from '../../db/schema.js';
import { logger } from '../observability/logger.js';
import { env } from '../config/env.js';
import type { StructuredUsage } from './usage.js';

/** Who an AI call is billed to: a student and their session, or null outside a student (eval, live tests). */
export type CostOwner = { userId: string; sessionId?: string | undefined } | null;

/** Tokens as the client reads them (`cachedInputTokens`, part of `inputTokens`, billed at 10 %), or the voice units. */
interface CallUsage extends Partial<StructuredUsage> {
  /** Speech-to-text: the audio's length, as the API reports it (`usage.promptAudioSeconds`). */
  audioSeconds?: number;
  /** Text-to-speech: the characters of the text read. */
  characters?: number;
  /** The API reported no usage: the row costs 0 and says so. */
  usageUnknown?: true;
}

interface AiCall extends CallUsage {
  model: string;
  /** The call's `functionId`, or the voice operation. */
  operation: string;
}

/** USD list prices of the dated models, read on their pages on 2026-10-06. */
const MODEL_PRICING_USD: Record<string, { inputPerMTokens?: number; outputPerMTokens?: number; perMinute?: number; perMChars?: number }> = {
  'mistral-small-2603': { inputPerMTokens: 0.15, outputPerMTokens: 0.6 },
  // https://docs.mistral.ai/models/voxtral-mini-transcribe-26-02
  'voxtral-mini-2602': { perMinute: 0.003 },
  // https://mistral.ai/news/voxtral-tts/ : « $0.016 per 1k characters »
  'voxtral-mini-tts-2603': { perMChars: 16 },
};

const CACHE_DISCOUNT = 0.1;

const EU_REGIONAL_UPCHARGE = 1.1;

/**
 * The conversion Mistral bills at: on the organization's cost page (admin.mistral.ai, Usage ›
 * Coûts, read on 2026-10-06), speech is 0,00001496 € a character = 16 $ per million × 1,1 × 0,85,
 * and transcription 0,00004675 € a second = 0,003 $ a minute × 1,1 × 0,85 / 60.
 */
const MISTRAL_USD_TO_EUR = 0.85;

export function regionalUpcharge(serverUrl: string): number {
  return new URL(serverUrl).host === 'api.eu.mistral.ai' ? EU_REGIONAL_UPCHARGE : 1;
}

const UPCHARGE = regionalUpcharge(env.MISTRAL_SERVER_URL);

/** The call's cost in micro-euros (1 µ€ = 0.0001 c): a text turn costs a few hundred. */
export function computeCostMicroEur(model: string, usage: CallUsage, upcharge: number): { costMicroEur: number; unknownModel: boolean } {
  const pricing = MODEL_PRICING_USD[model];
  if (!pricing) {
    return { costMicroEur: 0, unknownModel: true };
  }

  const tokensInput = usage.inputTokens ?? 0;
  const cached = Math.min(Math.max(usage.cachedInputTokens ?? 0, 0), tokensInput);
  const inputRate = pricing.inputPerMTokens ?? 0;
  const usd =
    ((tokensInput - cached) / 1_000_000) * inputRate +
    (cached / 1_000_000) * inputRate * CACHE_DISCOUNT +
    ((usage.outputTokens ?? 0) / 1_000_000) * (pricing.outputPerMTokens ?? 0) +
    ((usage.audioSeconds ?? 0) / 60) * (pricing.perMinute ?? 0) +
    ((usage.characters ?? 0) / 1_000_000) * (pricing.perMChars ?? 0);

  return { costMicroEur: Math.round(usd * upcharge * MISTRAL_USD_TO_EUR * 1_000_000), unknownModel: false };
}

/** What a call costs, in micro-euros, at this server's endpoint; known beforehand for speech. */
export function costOf(model: string, usage: CallUsage): number {
  return computeCostMicroEur(model, usage, UPCHARGE).costMicroEur;
}

/** Writes the call's cost for its owner; nothing without one. A failed write is logged, never thrown. */
export async function recordAiCost(owner: CostOwner, call: AiCall): Promise<void> {
  if (!owner) return;
  const { costMicroEur, unknownModel } = computeCostMicroEur(call.model, call, UPCHARGE);

  if (unknownModel) {
    logger.warn('Cost tracking: unknown model pricing', {
      operation: 'cost-tracking:unknown-model',
      aiModel: call.model,
      severity: 'medium' as const,
    });
  }

  try {
    await db.insert(costTracking).values({
      userId: owner.userId,
      sessionId: owner.sessionId ?? null,
      aiModel: call.model,
      operation: call.operation,
      tokensInput: call.inputTokens ?? 0,
      tokensOutput: call.outputTokens ?? 0,
      costMicroEur,
      billingMetadata: {
        cachedTokens: call.cachedInputTokens ?? 0,
        ...(call.audioSeconds !== undefined && { audioSeconds: call.audioSeconds }),
        ...(call.characters !== undefined && { characters: call.characters }),
        ...(call.usageUnknown && { usageUnknown: true }),
        unknownModel,
        usdToEur: MISTRAL_USD_TO_EUR,
        regionalUpcharge: UPCHARGE,
      },
    });
  } catch (err) {
    logger.error('Cost tracking insert failed', {
      operation: 'cost-tracking:insert-failed',
      aiModel: call.model,
      err: err,
      severity: 'high' as const,
    });
  }
}
