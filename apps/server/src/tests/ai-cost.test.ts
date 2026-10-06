import { describe, expect, it, mock, beforeEach } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';

const inserted: Record<string, unknown>[] = [];
mock.module('../db/connection', () => ({
  db: { insert: () => ({ values: async (row: Record<string, unknown>) => { inserted.push(row); } }) },
}));
mock.module('../platform/observability/logger', () => ({ logger: createMockLogger() }));

const { computeCostMicroEur, recordAiCost, regionalUpcharge } = await import('../platform/ai/cost.js');

beforeEach(() => {
  inserted.length = 0;
});

// USD_TO_EUR defaults to 0.92; 1 € = 1,000,000 µ€.
describe('computeCostMicroEur — tokens', () => {
  it('bills mistral-small-2603 at the Small 4 rate, EU endpoint upcharge included', () => {
    // (0.15 + 0.60) USD × 1.1 × 0.92 = 0.759 EUR
    expect(computeCostMicroEur('mistral-small-2603', { inputTokens: 1_000_000, outputTokens: 1_000_000 }, 1.1))
      .toEqual({ costMicroEur: 759_000, unknownModel: false });
  });

  it('adds no upcharge on the global endpoint', () => {
    expect(computeCostMicroEur('mistral-small-2603', { inputTokens: 1_000_000, outputTokens: 1_000_000 }, 1).costMicroEur).toBe(690_000);
  });

  it('keeps the cost of a text turn, which cents rounded to 0', () => {
    // (1,000 × 0.15 + 6,000 × 0.015 + 300 × 0.60) / 1M USD × 1.1 × 0.92 = 0.00042504 EUR
    expect(computeCostMicroEur('mistral-small-2603', { inputTokens: 7_000, cachedInputTokens: 6_000, outputTokens: 300 }, 1.1).costMicroEur).toBe(425);
  });

  it('flags unknownModel for an alias or a model without a price', () => {
    for (const id of ['mistral-small-latest', 'mistral-medium-latest', 'mistral-embed-2312', 'mistral-moderation-2603']) {
      expect(computeCostMicroEur(id, { inputTokens: 1_000, outputTokens: 1_000 }, 1.1)).toEqual({ costMicroEur: 0, unknownModel: true });
    }
  });
});

describe('computeCostMicroEur — cached tokens', () => {
  it('bills cached tokens at 10 % of the input rate', () => {
    // 2M × 0.15 + 8M × 0.015 = 0.42 USD × 1.1 × 0.92 = 0.42504 EUR
    expect(computeCostMicroEur('mistral-small-2603', { inputTokens: 10_000_000, cachedInputTokens: 8_000_000 }, 1.1).costMicroEur).toBe(425_040);
  });

  it('bills the full input rate without cached tokens', () => {
    expect(computeCostMicroEur('mistral-small-2603', { inputTokens: 10_000_000 }, 1.1).costMicroEur).toBe(1_518_000);
  });

  it('bounds the cached tokens by the input tokens when the API value is off', () => {
    expect(computeCostMicroEur('mistral-small-2603', { inputTokens: 10_000_000, cachedInputTokens: 50_000_000 }, 1.1).costMicroEur).toBe(151_800);
  });
});

describe('computeCostMicroEur — voice', () => {
  it('bills a transcription per minute of audio', () => {
    // 90 s = 1.5 min × 0.003 USD × 1.1 × 0.92 = 0.004554 EUR
    expect(computeCostMicroEur('voxtral-mini-2602', { audioSeconds: 90 }, 1.1).costMicroEur).toBe(4_554);
  });

  it('bills speech per character of the text read', () => {
    // 1,000 characters × 16 USD / M × 1.1 × 0.92 = 0.016192 EUR
    expect(computeCostMicroEur('voxtral-mini-tts-2603', { characters: 1_000 }, 1.1).costMicroEur).toBe(16_192);
  });
});

describe('recordAiCost', () => {
  it('writes the call for its owner, with its units', async () => {
    await recordAiCost({ userId: 'u1', sessionId: 's1' }, { model: 'voxtral-mini-2602', operation: 'speech-to-text', audioSeconds: 90 });
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      userId: 'u1', sessionId: 's1', aiModel: 'voxtral-mini-2602', operation: 'speech-to-text', tokensInput: 0, tokensOutput: 0,
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
