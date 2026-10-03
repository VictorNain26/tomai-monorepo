import type { LanguageModelUsage } from 'ai';

export interface StructuredUsage {
  inputTokens: number;
  /** Part of `inputTokens` read from the prompt cache, billed at 10 %. */
  cachedInputTokens: number;
  outputTokens: number;
}

/** Tokens of a structured call, also read from the error of an answer outside the schema. */
export function structuredUsage(usage: LanguageModelUsage | undefined): StructuredUsage {
  return {
    inputTokens: usage?.inputTokens ?? 0,
    cachedInputTokens: usage?.inputTokenDetails.cacheReadTokens ?? 0,
    outputTokens: usage?.outputTokens ?? 0,
  };
}
