/**
 * The cost of an AI call in micro-euros (1 µ€ = 0,0001 c). Prices are Mistral's in dollars per
 * million tokens, keyed by dated model: an alias could change price silently. Cached tokens cost
 * 10 % of the input; the EU endpoint adds 10 % to everything
 * (docs.mistral.ai/inference/regional-inference); Mistral bills in euros at its own rate.
 */

export interface Usage {
  inputTokens: number;
  /** Part of `inputTokens` read from the prompt cache. */
  cachedInputTokens: number;
  outputTokens: number;
}

/** Read on docs.mistral.ai/inference/pricing on 2026-10-07. */
const PRICES_USD: Readonly<Record<string, { input: number; output: number } | undefined>> = {
  'mistral-small-2603': { input: 0.15, output: 0.6 },
};

const CACHE_RATE = 0.1;
const EU_UPCHARGE = 1.1;

/**
 * The rate Mistral bills at, read on the organization's cost page (admin.mistral.ai, Usage ›
 * Coûts) on 2026-10-06. To check against each invoice: a gap moves every cost and every quota.
 */
const MISTRAL_USD_TO_EUR = 0.85;

/** The cost of a model's calls; throws for a model without a price, which no quota could bound. */
export function pricing(model: string, euEndpoint: boolean): (usage: Usage) => number {
  const price = PRICES_USD[model];
  if (!price) throw new Error(`No price for ${model}: add it to PRICES_USD (platform/ai/cost.ts)`);
  const rate = (euEndpoint ? EU_UPCHARGE : 1) * MISTRAL_USD_TO_EUR;
  return (usage) => {
    const cached = Math.min(usage.cachedInputTokens, usage.inputTokens);
    const usd = ((usage.inputTokens - cached + cached * CACHE_RATE) * price.input + usage.outputTokens * price.output) / 1_000_000;
    return Math.round(usd * rate * 1_000_000);
  };
}
