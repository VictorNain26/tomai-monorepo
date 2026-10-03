import pThrottle from 'p-throttle';
import type { Generate } from './judge.js';

export interface RateBudget {
  requests: number;
  tokens: number;
  intervalMs: number;
}

/**
 * Limits of Small 4 on this workspace, read from the `x-ratelimit-limit-*` headers on
 * 2026-10-03 (100 requests and 100 000 tokens per minute, shared by every key of the
 * workspace), kept at 80 % for the other callers.
 */
const SMALL_4_BUDGET: RateBudget = { requests: 80, tokens: 80_000, intervalMs: 60_000 };

// Mistral counts tokens, the prompt carries characters: about three characters a token in
// French, plus the most the answer may take.
function estimatedTokens({ messages, maxTokens }: Parameters<Generate>[0]): number {
  const characters = messages.reduce((sum, m) => sum + (typeof m.content === 'string' ? m.content.length : 0), 0);
  return Math.ceil(characters / 3) + maxTokens;
}

/** `generate` held under the workspace budget, by requests and by tokens over a sliding window. */
export function throttled(generate: Generate, budget: RateBudget = SMALL_4_BUDGET): Generate {
  const byRequests = pThrottle({ limit: budget.requests, interval: budget.intervalMs, strict: true });
  const byTokens = pThrottle({ limit: budget.tokens, interval: budget.intervalMs, strict: true, weight: (tokens: number) => tokens });
  const gate = byTokens(byRequests((_tokens: number) => Promise.resolve()));
  return async (opts) => {
    await gate(Math.min(estimatedTokens(opts), budget.tokens));
    return generate(opts);
  };
}
