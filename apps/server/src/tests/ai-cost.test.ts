import { describe, expect, it, mock, beforeEach } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';

const inserted: Record<string, unknown>[] = [];
mock.module('../db/connection', () => ({
  db: {
    insert: () => ({
      values: async (row: Record<string, unknown>) => {
        inserted.push(row);
      },
    }),
  },
}));
mock.module('../platform/observability/logger', () => ({ logger: createMockLogger() }));

const { computeCostMicroEur, recordAiCost, regionalUpcharge } = await import('../platform/ai/cost.js');

beforeEach(() => {
  inserted.length = 0;
});

// Mistral bills in euros at 0.85 to the dollar; 1 € = 1,000,000 µ€.
describe('computeCostMicroEur — tokens', () => {
  it('bills mistral-small-2603 at the Small 4 rate, EU endpoint upcharge included', () => {
    // (0.15 + 0.60) USD × 1.1 × 0.85 = 0.70125 EUR
    expect(computeCostMicroEur('mistral-small-2603', { inputTokens: 1_000_000, outputTokens: 1_000_000 }, 1.1)).toEqual({
      costMicroEur: 701_250,
      unknownModel: false,
    });
  });

  it('adds no upcharge on the global endpoint', () => {
    expect(computeCostMicroEur('mistral-small-2603', { inputTokens: 1_000_000, outputTokens: 1_000_000 }, 1).costMicroEur).toBe(637_500);
  });

  it('keeps the cost of a text turn, which cents rounded to 0', () => {
    // (1,000 × 0.15 + 6,000 × 0.015 + 300 × 0.60) / 1M USD × 1.1 × 0.85 = 0.0003927 EUR
    expect(computeCostMicroEur('mistral-small-2603', { inputTokens: 7_000, cachedInputTokens: 6_000, outputTokens: 300 }, 1.1).costMicroEur).toBe(
      393,
    );
  });

  it('flags unknownModel for an alias or a model without a price', () => {
    for (const id of ['mistral-small-latest', 'mistral-medium-latest', 'mistral-embed-2312', 'mistral-moderation-2603']) {
      expect(computeCostMicroEur(id, { inputTokens: 1_000, outputTokens: 1_000 }, 1.1)).toEqual({ costMicroEur: 0, unknownModel: true });
    }
  });
});

describe('computeCostMicroEur — the cost page, to its precision (2026-10-06)', () => {
  it('bills Small 4 on the EU endpoint at 0,14 € and 0,56 € per million tokens, rounded to the cent', () => {
    const perMillion = (usage: { inputTokens?: number; outputTokens?: number }) =>
      Math.round(computeCostMicroEur('mistral-small-2603', usage, 1.1).costMicroEur / 10_000) / 100;
    expect(perMillion({ inputTokens: 1_000_000 })).toBe(0.14);
    expect(perMillion({ outputTokens: 1_000_000 })).toBe(0.56);
  });

  it('bills Small 4 on the global endpoint at 0,13 € and 0,51 €', () => {
    const perMillion = (usage: { inputTokens?: number; outputTokens?: number }) =>
      Math.round(computeCostMicroEur('mistral-small-2603', usage, 1).costMicroEur / 10_000) / 100;
    expect(perMillion({ inputTokens: 1_000_000 })).toBe(0.13);
    expect(perMillion({ outputTokens: 1_000_000 })).toBe(0.51);
  });
});

describe('computeCostMicroEur — cached tokens', () => {
  it('bills cached tokens at 10 % of the input rate', () => {
    // 2M × 0.15 + 8M × 0.015 = 0.42 USD × 1.1 × 0.85 = 0.3927 EUR
    expect(computeCostMicroEur('mistral-small-2603', { inputTokens: 10_000_000, cachedInputTokens: 8_000_000 }, 1.1).costMicroEur).toBe(392_700);
  });

  it('bills the full input rate without cached tokens', () => {
    expect(computeCostMicroEur('mistral-small-2603', { inputTokens: 10_000_000 }, 1.1).costMicroEur).toBe(1_402_500);
  });

  it('bounds the cached tokens by the input tokens when the API value is off', () => {
    expect(computeCostMicroEur('mistral-small-2603', { inputTokens: 10_000_000, cachedInputTokens: 50_000_000 }, 1.1).costMicroEur).toBe(140_250);
  });
});

describe('computeCostMicroEur — voice', () => {
  it('bills a transcription at the price on the cost page: 0,00004675 € a second', () => {
    expect(computeCostMicroEur('voxtral-mini-2602', { audioSeconds: 1_000 }, 1.1).costMicroEur).toBe(46_750);
  });

  it('bills speech at the price on the cost page: 0,00001496 € a character', () => {
    expect(computeCostMicroEur('voxtral-mini-tts-2603', { characters: 1_000 }, 1.1).costMicroEur).toBe(14_960);
  });
});

describe('recordAiCost', () => {
  it('writes the call for its owner, with its units', async () => {
    await recordAiCost({ userId: 'u1', sessionId: 's1' }, { model: 'voxtral-mini-2602', operation: 'speech-to-text', audioSeconds: 90 });
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      userId: 'u1',
      sessionId: 's1',
      aiModel: 'voxtral-mini-2602',
      operation: 'speech-to-text',
      tokensInput: 0,
      tokensOutput: 0,
      billingMetadata: { audioSeconds: 90, unknownModel: false },
    });
    expect(inserted[0]?.['costMicroEur']).toBeGreaterThan(0);
  });

  it('writes nothing without an owner (eval, live tests)', async () => {
    await recordAiCost(null, { model: 'mistral-small-2603', operation: 'eval-judge', inputTokens: 1_000 });
    expect(inserted).toEqual([]);
  });

  it('writes a flagged row at 0 for an unknown model, or a usage the API did not report', async () => {
    await recordAiCost({ userId: 'u1' }, { model: 'mistral-small-latest', operation: 'chat', inputTokens: 1_000 });
    await recordAiCost({ userId: 'u1' }, { model: 'voxtral-mini-2602', operation: 'speech-to-text', usageUnknown: true });
    expect(inserted[0]).toMatchObject({ sessionId: null, costMicroEur: 0, billingMetadata: { unknownModel: true } });
    expect(inserted[1]).toMatchObject({ costMicroEur: 0, billingMetadata: { usageUnknown: true, unknownModel: false } });
  });
});

describe('regionalUpcharge', () => {
  it('is 1.1 on the EU endpoint', () => {
    expect(regionalUpcharge('https://api.eu.mistral.ai')).toBe(1.1);
  });

  it('is 1 on the global endpoint', () => {
    expect(regionalUpcharge('https://api.mistral.ai')).toBe(1);
  });

  it('is 1 on an unknown host (local dev), never the EU upcharge by default', () => {
    expect(regionalUpcharge('http://localhost:1234')).toBe(1);
  });
});
