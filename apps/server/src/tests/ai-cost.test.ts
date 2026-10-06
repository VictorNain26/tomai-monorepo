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

// USD_TO_EUR par défaut = 0.92 ; 1 € = 1 000 000 µ€.
describe('computeCostMicroEur — tokens', () => {
  it('facture mistral-small-2603 au tarif Small 4 majoré UE', () => {
    // (0.15 + 0.60) USD × 1.1 × 0.92 = 0.759 EUR
    expect(computeCostMicroEur('mistral-small-2603', { tokensInput: 1_000_000, tokensOutput: 1_000_000 }, 1.1))
      .toEqual({ costMicroEur: 759_000, unknownModel: false });
  });

  it("ne majore pas sur l'endpoint global", () => {
    expect(computeCostMicroEur('mistral-small-2603', { tokensInput: 1_000_000, tokensOutput: 1_000_000 }, 1).costMicroEur).toBe(690_000);
  });

  it("garde le coût d'un tour de texte, que les centimes arrondissaient à 0", () => {
    // (1 000 × 0.15 + 6 000 × 0.015 + 300 × 0.60) / 1M USD × 1.1 × 0.92 = 0.00042504 EUR
    expect(computeCostMicroEur('mistral-small-2603', { tokensInput: 7_000, cachedTokens: 6_000, tokensOutput: 300 }, 1.1).costMicroEur).toBe(425);
  });

  it('signale unknownModel sur un alias ou un modèle retiré du casting', () => {
    for (const id of ['mistral-small-latest', 'mistral-medium-latest', 'mistral-embed-2312', 'mistral-moderation-2603']) {
      expect(computeCostMicroEur(id, { tokensInput: 1_000, tokensOutput: 1_000 }, 1.1)).toEqual({ costMicroEur: 0, unknownModel: true });
    }
  });
});

describe('computeCostMicroEur — cached tokens', () => {
  it('facture les tokens cachés à 10 % du tarif input', () => {
    // 2M × 0.15 + 8M × 0.015 = 0.42 USD × 1.1 × 0.92 = 0.42504 EUR
    expect(computeCostMicroEur('mistral-small-2603', { tokensInput: 10_000_000, cachedTokens: 8_000_000 }, 1.1).costMicroEur).toBe(425_040);
  });

  it('0 caché = plein tarif input', () => {
    expect(computeCostMicroEur('mistral-small-2603', { tokensInput: 10_000_000 }, 1.1).costMicroEur).toBe(1_518_000);
  });

  it('borne cachedTokens à tokensInput si la valeur API est aberrante', () => {
    expect(computeCostMicroEur('mistral-small-2603', { tokensInput: 10_000_000, cachedTokens: 50_000_000 }, 1.1).costMicroEur).toBe(151_800);
  });
});

describe('computeCostMicroEur — voix', () => {
  it('facture la transcription à la minute d’audio', () => {
    // 90 s = 1.5 min × 0.003 USD × 1.1 × 0.92 = 0.004554 EUR
    expect(computeCostMicroEur('voxtral-mini-2602', { audioSeconds: 90 }, 1.1).costMicroEur).toBe(4_554);
  });

  it('facture la lecture aux caractères du texte lu', () => {
    // 1 000 caractères × 16 USD / M × 1.1 × 0.92 = 0.016192 EUR
    expect(computeCostMicroEur('voxtral-mini-tts-2603', { characters: 1_000 }, 1.1).costMicroEur).toBe(16_192);
  });
});

describe('recordAiCost', () => {
  it("écrit l'appel pour son propriétaire, avec ses unités", async () => {
    await recordAiCost({ userId: 'u1', sessionId: 's1' }, { model: 'voxtral-mini-2602', operation: 'speech-to-text', audioSeconds: 90 });
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({
      userId: 'u1', sessionId: 's1', aiModel: 'voxtral-mini-2602', operation: 'speech-to-text', tokensInput: 0, tokensOutput: 0,
      billingMetadata: { audioSeconds: 90, unknownModel: false },
    });
    expect(inserted[0]?.['costMicroEur']).toBeGreaterThan(0);
  });

  it("n'écrit rien sans propriétaire (évaluation, tests réels)", async () => {
    await recordAiCost(null, { model: 'mistral-small-2603', operation: 'eval-judge', tokensInput: 1_000 });
    expect(inserted).toEqual([]);
  });

  it('écrit une ligne à 0 marquée pour un modèle inconnu', async () => {
    await recordAiCost({ userId: 'u1' }, { model: 'mistral-small-latest', operation: 'chat', tokensInput: 1_000 });
    expect(inserted[0]).toMatchObject({ sessionId: null, costMicroEur: 0, billingMetadata: { unknownModel: true } });
  });
});

describe('regionalUpcharge', () => {
  it("vaut 1.1 sur l'endpoint UE", () => {
    expect(regionalUpcharge('https://api.eu.mistral.ai')).toBe(1.1);
  });

  it("vaut 1 sur l'endpoint global", () => {
    expect(regionalUpcharge('https://api.mistral.ai')).toBe(1);
  });

  it('vaut 1 sur un hôte inconnu (dev local), jamais la majoration UE par défaut', () => {
    expect(regionalUpcharge('http://localhost:1234')).toBe(1);
  });
});
