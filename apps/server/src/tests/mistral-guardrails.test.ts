/**
 * Tests unitaires — Mistral guardrails for minor-facing chat
 * (lib/mistral-guardrails.ts).
 *
 * Pure config-shape tests, no mocks. The Mistral SDK is not invoked: we
 * only verify that the GuardrailConfig array we emit:
 *  - is exactly one entry (a single moderation pass)
 *  - never silently bypasses on provider errors (`blockOnError: true`)
 *  - keeps the moderation action set to `block` (not `flag`)
 *  - keeps the strict per-category thresholds documented for our CP-Terminale
 *    audience (≤ 0.1 for harmful content, ≤ 0.2 for jailbreaking)
 *
 * Regression: any future relaxation of these thresholds (or a swap of
 * `block` to `flag`, or a flip of `blockOnError`) breaks these tests on
 * purpose. Loosening minor-facing safety must be a deliberate review-gated
 * change, not an accidental drift.
 */

import { describe, it, expect } from 'bun:test';
import { studentChatGuardrails } from '../lib/mistral-guardrails';

describe('studentChatGuardrails()', () => {
  it('returns an array with exactly one guardrail entry', () => {
    const guardrails = studentChatGuardrails();
    expect(Array.isArray(guardrails)).toBe(true);
    expect(guardrails).toHaveLength(1);
  });

  it('sets blockOnError: true (no silent bypass on Mistral failure)', () => {
    const [first] = studentChatGuardrails();
    expect(first).toBeDefined();
    expect(first?.blockOnError).toBe(true);
  });

  it('uses moderationLlmV2 with action="block" and ignoreOtherCategories=false', () => {
    const [first] = studentChatGuardrails();
    expect(first?.moderationLlmV2).toBeDefined();
    expect(first?.moderationLlmV2?.action).toBe('block');
    expect(first?.moderationLlmV2?.ignoreOtherCategories).toBe(false);
  });

  describe('strict thresholds for minor-facing audience', () => {
    // Per Mistral guardrailing docs (2026), thresholds are 0..1 with smaller
    // values being stricter. Tom's audience is 6-18 yo so each harmful axis
    // is capped tightly.
    const expectedMaxThresholds: Readonly<Record<string, number>> = {
      sexual: 0.1,
      selfharm: 0.1,
      violenceAndThreats: 0.1,
      hateAndDiscrimination: 0.1,
      dangerous: 0.1,
      criminal: 0.1,
      pii: 0.1,
      jailbreaking: 0.2,
    };

    for (const [category, max] of Object.entries(expectedMaxThresholds)) {
      it(`enforces ${category} <= ${max.toString()}`, () => {
        const [first] = studentChatGuardrails();
        const thresholds = first?.moderationLlmV2?.customCategoryThresholds;
        expect(thresholds).toBeDefined();
        const value = thresholds?.[category as keyof typeof thresholds];
        expect(typeof value).toBe('number');
        expect(value).toBeLessThanOrEqual(max);
      });
    }
  });

  it('returns a fresh config each call (caller may mutate safely)', () => {
    const a = studentChatGuardrails();
    const b = studentChatGuardrails();
    expect(a).not.toBe(b);
  });
});
