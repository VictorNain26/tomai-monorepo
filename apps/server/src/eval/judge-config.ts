import { createHash } from 'node:crypto';
import type { z } from 'zod';
import type { MistralMessage } from '../platform/ai/mistral-client.js';

/**
 * Pinned by its dated id, never by an alias: a new model, prompt or sampling is a new judge
 * to measure again (`judge-version.ts`). Small 4, the tutor's model (`docs/agent.md`); several
 * samples at a temperature above 0 align better with human grades than one deterministic
 * call (`etudes/2026-10-03/refonte-harnais.md`).
 */
export const JUDGE = {
  model: 'mistral-small-2603',
  samples: 5,
  temperature: 0.7,
  firstSeed: 20261003,
  answerMaxTokens: 1024,
  extractionMaxTokens: 2048,
} as const;

// A verdict must rest on most of the samples drawn, not on what is left after losses.
export const MIN_SAMPLES = Math.floor(JUDGE.samples / 2) + 1;
/** Judge calls at once, after the first has written the shared prefix to the cache. */
export const CONCURRENCY = 4;

/** The structured call the judge needs; `generateStructured` of the server satisfies it. */
export type Generate = <T>(opts: {
  messages: MistralMessage[];
  schema: z.ZodType<T>;
  schemaName: string;
  functionId: string;
  model: string;
  temperature: number;
  maxTokens: number;
  maxRetries: number;
  seed: number;
  promptCacheKey: string;
  /** Whether an answer outside the schema is asked again once; a judge sample never is. */
  repairInvalid: boolean;
}) => Promise<{ object: T; usage: JudgeUsage }>;

export interface JudgeUsage {
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
}

export const NO_USAGE: JudgeUsage = { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 };

export function addUsage(a: JudgeUsage, b: JudgeUsage): JudgeUsage {
  return { inputTokens: a.inputTokens + b.inputTokens, cachedInputTokens: a.cachedInputTokens + b.cachedInputTokens, outputTokens: a.outputTokens + b.outputTokens };
}

/**
 * Mistral's cache key for calls that share a prompt prefix
 * (https://docs.mistral.ai/api/endpoint/chat, `prompt_cache_key`): taken from the prefix
 * itself, it changes exactly when the prompt does.
 */
export function cacheKey(name: string, prefix: readonly MistralMessage[]): string {
  return `${name}-${createHash('sha256').update(JSON.stringify(prefix)).digest('hex').slice(0, 16)}`;
}
