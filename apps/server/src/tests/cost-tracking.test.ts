import { describe, expect, it } from 'bun:test';
import { computeCostCents } from '../services/cost-tracking.service.js';

// USD_TO_EUR par défaut = 0.92. Pricing : mistral.ai/pricing (juin 2026).
describe('computeCostCents', () => {
  it('facture mistral-medium-latest au tarif réel (pas unknownModel)', () => {
    // 1M input + 1M output : (1.5 + 7.5) USD * 0.92 = 8.28 EUR = 828 cents
    const r = computeCostCents('mistral-medium-latest', 1_000_000, 1_000_000, false);
    expect(r.unknownModel).toBe(false);
    expect(r.costCents).toBe(828);
  });

  it('matche les IDs versionnés via préfixe (mistral-medium-2508)', () => {
    const r = computeCostCents('mistral-medium-2508', 1_000_000, 0, false);
    expect(r.unknownModel).toBe(false);
    expect(r.costCents).toBe(138); // 1.5 * 0.92 * 100
  });

  it('distingue ministral-3b et ministral-8b', () => {
    const r3 = computeCostCents('ministral-3b-latest', 1_000_000, 1_000_000, false);
    const r8 = computeCostCents('ministral-8b-latest', 1_000_000, 1_000_000, false);
    expect(r3.costCents).toBe(18); // (0.1+0.1)*0.92*100
    expect(r8.costCents).toBe(28); // (0.15+0.15)*0.92*100, arrondi
  });

  it('signale unknownModel sur un modèle non mappé', () => {
    const r = computeCostCents('gpt-4o', 1000, 1000, false);
    expect(r.unknownModel).toBe(true);
    expect(r.costCents).toBe(0);
  });
});
