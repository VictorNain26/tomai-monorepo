import { describe, expect, it } from 'bun:test';
import { pricing } from './cost';

const usage = (inputTokens: number, cachedInputTokens: number, outputTokens: number) => ({ inputTokens, cachedInputTokens, outputTokens });
const eu = pricing('mistral-small-2603', true);

describe('pricing', () => {
  it('prices Small 4 on the EU endpoint at its upcharge and the rate Mistral bills at', () => {
    // (1 000 × 0,15 $ + 100 × 0,60 $) / 1 M = 0,00021 $, × 1,1 × 0,85.
    expect(eu(usage(1000, 0, 100))).toBe(196);
  });

  it('bills cached input at 10 %', () => {
    // (200 + 800 × 0,1) × 0,15 $ + 100 × 0,60 $ = 102 $ per million, × 0,935.
    expect(eu(usage(1000, 800, 100))).toBe(95);
  });

  it('adds no upcharge outside the EU endpoint', () => {
    expect(pricing('mistral-small-2603', false)(usage(1000, 0, 100))).toBe(179);
  });

  it('never counts more cached tokens than input tokens', () => {
    expect(eu(usage(100, 500, 0))).toBe(eu(usage(100, 100, 0)));
  });

  it('refuses a model without a price', () => {
    expect(() => pricing('mistral-small-2609', true)).toThrow('No price for mistral-small-2609');
  });
});
