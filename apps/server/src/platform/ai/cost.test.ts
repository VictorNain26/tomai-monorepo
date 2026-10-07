import { describe, expect, it } from 'bun:test';
import { costMicroEur } from './cost';

const EU = 'https://api.eu.mistral.ai';
const usage = (inputTokens: number, cachedInputTokens: number, outputTokens: number) => ({ inputTokens, cachedInputTokens, outputTokens });

describe('costMicroEur', () => {
  it('prices Small 4 on the EU endpoint at its upcharge and the rate Mistral bills at', () => {
    // (1 000 × 0,15 $ + 100 × 0,60 $) / 1 M = 0,00021 $, × 1,1 × 0,85.
    expect(costMicroEur('mistral-small-2603', usage(1000, 0, 100), EU)).toEqual({ costMicroEur: 196, unknownModel: false });
  });

  it('bills cached input at 10 %', () => {
    // (200 + 800 × 0,1) × 0,15 $ + 100 × 0,60 $ = 102 $ per million, × 0,935.
    expect(costMicroEur('mistral-small-2603', usage(1000, 800, 100), EU).costMicroEur).toBe(95);
  });

  it('adds no upcharge outside the EU endpoint', () => {
    expect(costMicroEur('mistral-small-2603', usage(1000, 0, 100), 'https://api.mistral.ai').costMicroEur).toBe(179);
  });

  it('never counts more cached tokens than input tokens', () => {
    expect(costMicroEur('mistral-small-2603', usage(100, 500, 0), EU)).toEqual(costMicroEur('mistral-small-2603', usage(100, 100, 0), EU));
  });

  it('costs nothing for a model missing from the price list, and says so', () => {
    expect(costMicroEur('mistral-small-latest', usage(1000, 0, 100), EU)).toEqual({ costMicroEur: 0, unknownModel: true });
  });
});
