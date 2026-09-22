import { describe, expect, it } from 'bun:test';
import { computeCostCents, regionalUpcharge } from '../services/cost-tracking.service.js';

// USD_TO_EUR par défaut = 0.92.
describe('computeCostCents', () => {
  it('facture mistral-small-2603 au tarif Small 4 majoré UE', () => {
    // (0.15 + 0.60) USD × 1.1 × 0.92 × 100 = 75.9 → 76
    expect(computeCostCents('mistral-small-2603', 1_000_000, 1_000_000, 0, 1.1)).toEqual({ costCents: 76, unknownModel: false });
  });

  it("ne majore pas sur l'endpoint global", () => {
    // 0.75 × 0.92 × 100 = 69
    expect(computeCostCents('mistral-small-2603', 1_000_000, 1_000_000, 0, 1).costCents).toBe(69);
  });

  it('signale unknownModel sur un alias ou un modèle retiré du casting', () => {
    for (const id of ['mistral-small-latest', 'mistral-medium-latest', 'magistral-medium-latest', 'ministral-3b-latest']) {
      expect(computeCostCents(id, 1_000, 1_000, 0, 1.1)).toEqual({ costCents: 0, unknownModel: true });
    }
  });
});

describe('computeCostCents — cached tokens', () => {
  it('facture les tokens cachés à 10 % du tarif input', () => {
    // 2M × 0.15 + 8M × 0.015 = 0.42 USD × 1.1 × 0.92 = 0.42504 EUR → 43 cents
    expect(computeCostCents('mistral-small-2603', 10_000_000, 0, 8_000_000, 1.1).costCents).toBe(43);
  });

  it('0 caché = plein tarif input', () => {
    // 10M × 0.15 = 1.5 USD × 1.1 × 0.92 = 1.518 EUR → 152 cents
    expect(computeCostCents('mistral-small-2603', 10_000_000, 0, 0, 1.1).costCents).toBe(152);
  });

  it('borne cachedTokens à tokensInput si la valeur API est aberrante', () => {
    // 10M tout caché : 0.15 USD × 1.1 × 0.92 = 0.1518 EUR → 15 cents
    expect(computeCostCents('mistral-small-2603', 10_000_000, 0, 50_000_000, 1.1).costCents).toBe(15);
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
