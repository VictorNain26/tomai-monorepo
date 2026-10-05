import { NoObjectGeneratedError } from 'ai';
import pMap from 'p-map';
import type { z } from 'zod';
import type { MistralMessage } from '../platform/ai/mistral-client.js';
import { structuredUsage } from '../platform/ai/usage.js';
import { CONCURRENCY, JUDGE, type Generate, type JudgeUsage } from './judge-config.js';

export interface SampleRequest<T> {
  messages: MistralMessage[];
  schema: z.ZodType<T>;
  schemaName: string;
  functionId: string;
  maxTokens: number;
  seed: number;
  promptCacheKey: string;
}

/**
 * One sample of the judge's model: its object, or null when the model wrote no valid object,
 * its tokens spent all the same. An API error throws.
 */
export async function sampleObject<T>(generate: Generate, request: SampleRequest<T>, spend: (usage: JudgeUsage) => void): Promise<T | null> {
  try {
    const result = await generate({
      ...request,
      model: JUDGE.model,
      temperature: JUDGE.temperature,
      // Rate limits are waited out by the caller's throttle, not retried at once by the SDK.
      maxRetries: 0,
      repairInvalid: false,
    });
    spend(result.usage);
    return result.object;
  } catch (error) {
    if (!NoObjectGeneratedError.isInstance(error)) throw error;
    spend(structuredUsage(error.usage));
    return null;
  }
}

/** Each sample's seed, from the judge's first one. */
export const SEEDS = Array.from({ length: JUDGE.samples }, (_, index) => JUDGE.firstSeed + index);

/**
 * Every draw, the first alone so that it writes the shared prefix to the cache before the
 * others read it; after a failure, no new draw starts.
 */
export async function drawAll<T, R>(items: readonly T[], draw: (item: T) => Promise<R>): Promise<R[]> {
  const [first, ...rest] = items;
  if (first === undefined) return [];
  return [await draw(first), ...await pMap(rest, draw, { concurrency: CONCURRENCY })];
}
