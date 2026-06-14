import { describe, expect, it } from 'bun:test';
import { computeCostCents } from '../services/cost-tracking.service.js';

// USD_TO_EUR par défaut = 0.92. Pricing : mistral.ai/pricing (juin 2026).
describe('computeCostCents', () => {
  it('facture mistral-medium-latest au tarif réel (pas unknownModel)', () => {
    // 1M input + 1M output : (1.5 + 7.5) USD * 0.92 = 8.28 EUR = 828 cents
    const r = computeCostCents('mistral-medium-latest', 1_000_000, 1_000_000, 0);
    expect(r.unknownModel).toBe(false);
    expect(r.costCents).toBe(828);
  });

  it('matche les IDs versionnés via préfixe (mistral-medium-2508)', () => {
    const r = computeCostCents('mistral-medium-2508', 1_000_000, 0, 0);
    expect(r.unknownModel).toBe(false);
    expect(r.costCents).toBe(138); // 1.5 * 0.92 * 100
  });

  it('distingue ministral-3b et ministral-8b', () => {
    const r3 = computeCostCents('ministral-3b-latest', 1_000_000, 1_000_000, 0);
    const r8 = computeCostCents('ministral-8b-latest', 1_000_000, 1_000_000, 0);
    expect(r3.costCents).toBe(18); // (0.1+0.1)*0.92*100
    expect(r8.costCents).toBe(28); // (0.15+0.15)*0.92*100, arrondi
  });

  it('signale unknownModel sur un modèle non mappé', () => {
    const r = computeCostCents('gpt-4o', 1000, 1000, 0);
    expect(r.unknownModel).toBe(true);
    expect(r.costCents).toBe(0);
  });

  it('ne matche pas magistral-medium-latest sur la clé mistral-medium', () => {
    const r = computeCostCents('magistral-medium-latest', 1_000_000, 1_000_000, 0);
    expect(r.unknownModel).toBe(false);
    // (2.0 + 5.0) * 0.92 * 100 = 644 — tarif magistral-medium, PAS mistral-medium
    expect(r.costCents).toBe(644);
  });
});

describe('computeCostCents — cached tokens', () => {
  it('facture les tokens cached à 10% du tarif input', () => {
    // 1M prompt dont 800k cached, mistral-medium (input 1.5)
    // uncached 200k @1.5 + cached 800k @0.15 = 0.3 + 0.12 = 0.42 USD * 0.92 = 0.3864 EUR = 39 cents
    const r = computeCostCents('mistral-medium-latest', 1_000_000, 0, 800_000);
    expect(r.costCents).toBe(39);
  });
  it('0 cached = plein tarif input (majorant)', () => {
    const r = computeCostCents('mistral-medium-latest', 1_000_000, 0, 0);
    expect(r.costCents).toBe(138);
  });
});
