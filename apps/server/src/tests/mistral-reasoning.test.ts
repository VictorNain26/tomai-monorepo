/**
 * Tests unitaires — Mistral reasoning_effort routing (lib/mistral-reasoning.ts)
 *
 * Pure logic, no mocks needed. Covers:
 *  - chat-turn routing path (`routeReasoningEffort` with intent)
 *  - card-generation routing path (same function, intent omitted)
 *
 * Regression coverage for bug C2: a chit-chat turn in 4ᵉ math must NOT
 * trigger reasoning_effort: 'high' (3-5× latency + extra token cost for
 * literally "bonjour").
 */

import { describe, it, expect } from 'bun:test';
import { routeReasoningEffort, routeCardReasoningEffort } from '../lib/mistral-reasoning';

describe('routeReasoningEffort — chat turns', () => {
  describe('primary school never gets high reasoning', () => {
    it('returns "none" for cp + mathematiques + solve-this-for-me', () => {
      const effort = routeReasoningEffort({
        schoolLevel: 'cp',
        subject: 'mathematiques',
        intent: 'solve-this-for-me',
      });
      expect(effort).toBe('none');
    });

    it('returns "none" for cm2 + nsi + check-my-answer', () => {
      const effort = routeReasoningEffort({
        schoolLevel: 'cm2',
        subject: 'nsi',
        intent: 'check-my-answer',
      });
      expect(effort).toBe('none');
    });

    it('returns "none" for cm2 + physique-chimie + explain-concept', () => {
      const effort = routeReasoningEffort({
        schoolLevel: 'cm2',
        subject: 'physique-chimie',
        intent: 'explain-concept',
      });
      expect(effort).toBe('none');
    });
  });

  describe('collège+ STEM with hard intents triggers high', () => {
    it('returns "high" for quatrieme + mathematiques + solve-this-for-me', () => {
      const effort = routeReasoningEffort({
        schoolLevel: 'quatrieme',
        subject: 'mathematiques',
        intent: 'solve-this-for-me',
      });
      expect(effort).toBe('high');
    });

    it('returns "high" for troisieme + mathematiques + check-my-answer', () => {
      const effort = routeReasoningEffort({
        schoolLevel: 'troisieme',
        subject: 'mathematiques',
        intent: 'check-my-answer',
      });
      expect(effort).toBe('high');
    });

    it('returns "high" for troisieme + mathematiques + explain-concept', () => {
      const effort = routeReasoningEffort({
        schoolLevel: 'troisieme',
        subject: 'mathematiques',
        intent: 'explain-concept',
      });
      expect(effort).toBe('high');
    });

    it('returns "high" for terminale + nsi + solve-this-for-me', () => {
      const effort = routeReasoningEffort({
        schoolLevel: 'terminale',
        subject: 'nsi',
        intent: 'solve-this-for-me',
      });
      expect(effort).toBe('high');
    });
  });

  describe('low-stakes intents stay on "none" — bug C2 regression', () => {
    it('returns "none" for quatrieme + mathematiques + chit-chat', () => {
      // "Bonjour !" in 4ᵉ math should NOT trigger 3-5× latency.
      const effort = routeReasoningEffort({
        schoolLevel: 'quatrieme',
        subject: 'mathematiques',
        intent: 'chit-chat',
      });
      expect(effort).toBe('none');
    });

    it('returns "none" for quatrieme + mathematiques + clarify-question', () => {
      const effort = routeReasoningEffort({
        schoolLevel: 'quatrieme',
        subject: 'mathematiques',
        intent: 'clarify-question',
      });
      expect(effort).toBe('none');
    });

    it('returns "none" for quatrieme + mathematiques + unknown', () => {
      const effort = routeReasoningEffort({
        schoolLevel: 'quatrieme',
        subject: 'mathematiques',
        intent: 'unknown',
      });
      expect(effort).toBe('none');
    });

    it('returns "none" for quatrieme + mathematiques + intent undefined (fail-closed)', () => {
      // Regression for bug C2: a missing/unclassified intent must NOT escalate.
      // The chat path always provides an intent from the classifier; if for any
      // reason it doesn't (classifier failure, classifier output 'unknown'),
      // we want to default to the cheap mode rather than burn 3-5× latency on
      // every STEM collège+ turn including a "bonjour".
      const effort = routeReasoningEffort({
        schoolLevel: 'quatrieme',
        subject: 'mathematiques',
        intent: undefined,
      });
      expect(effort).toBe('none');
    });
  });

  describe('non-STEM subjects always stay on "none"', () => {
    it('returns "none" for terminale + francais + solve-this-for-me', () => {
      const effort = routeReasoningEffort({
        schoolLevel: 'terminale',
        subject: 'francais',
        intent: 'solve-this-for-me',
      });
      expect(effort).toBe('none');
    });

    it('returns "none" for premiere + histoire + explain-concept', () => {
      const effort = routeReasoningEffort({
        schoolLevel: 'premiere',
        subject: 'histoire',
        intent: 'explain-concept',
      });
      expect(effort).toBe('none');
    });
  });

  describe('subject undefined → "none"', () => {
    it('returns "none" for terminale + subject undefined + solve-this-for-me', () => {
      const effort = routeReasoningEffort({
        schoolLevel: 'terminale',
        subject: undefined,
        intent: 'solve-this-for-me',
      });
      expect(effort).toBe('none');
    });

    it('returns "none" for terminale (subject omitted) + solve-this-for-me', () => {
      const effort = routeReasoningEffort({
        schoolLevel: 'terminale',
        intent: 'solve-this-for-me',
      });
      expect(effort).toBe('none');
    });
  });
});

describe('routeCardReasoningEffort — deck generation (no student intent)', () => {
  // The card generator has no student "intent" to classify (the user just
  // asked for a deck on a topic). This dedicated helper routes on
  // STEM-subject + college+ only, distinct from the chat helper which
  // requires a known hard intent.

  it('returns "none" for STEM + cinquieme (lower collège excluded from COLLEGE_AND_UP)', () => {
    // cinquieme is collège but NOT in COLLEGE_AND_UP (set starts at quatrieme).
    const effort = routeCardReasoningEffort({
      schoolLevel: 'cinquieme',
      subject: 'mathematiques',
    });
    expect(effort).toBe('none');
  });

  it('returns "high" for STEM + quatrieme card generation', () => {
    const effort = routeCardReasoningEffort({
      schoolLevel: 'quatrieme',
      subject: 'mathematiques',
    });
    expect(effort).toBe('high');
  });

  it('returns "high" for STEM + terminale card generation', () => {
    const effort = routeCardReasoningEffort({
      schoolLevel: 'terminale',
      subject: 'physique-chimie',
    });
    expect(effort).toBe('high');
  });

  it('returns "none" for non-STEM + terminale card generation', () => {
    const effort = routeCardReasoningEffort({
      schoolLevel: 'terminale',
      subject: 'francais',
    });
    expect(effort).toBe('none');
  });

  it('returns "none" for STEM + primary card generation', () => {
    const effort = routeCardReasoningEffort({
      schoolLevel: 'cm2',
      subject: 'mathematiques',
    });
    expect(effort).toBe('none');
  });

  it('returns "none" when subject is undefined for card generation', () => {
    const effort = routeCardReasoningEffort({
      schoolLevel: 'terminale',
      subject: undefined,
    });
    expect(effort).toBe('none');
  });
});
