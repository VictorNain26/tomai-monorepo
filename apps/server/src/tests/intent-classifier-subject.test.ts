/**
 * Tests unitaires — détection de matière dans IntentClassifierService (Task 3)
 *
 * Suit le pattern de intent-classifier.test.ts :
 * - mock.module avec chemins relatifs à src/tests/ sans extension .js
 * - variable partagée mutée par chaque test
 * - import du service à la racine du module (après les mocks)
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';

// ============================================
// MOCKS — paths relative to src/tests/
// ============================================

mock.module('../lib/observability', () => ({
  logger: { debug: () => {}, error: () => {}, info: () => {}, warn: () => {} },
}));

mock.module('../config/env', () => ({
  env: { MISTRAL_MODEL: 'mistral-small-2603' },
}));

let mockStructuredResponse: { intent?: string; confidence?: string; subject?: string } | Error = {
  intent: 'explain-concept',
  confidence: 'high',
  subject: 'mathematiques',
};

mock.module('../lib/ai/mistral-client', () => ({
  generateStructured: mock(async () => {
    if (mockStructuredResponse instanceof Error) throw mockStructuredResponse;
    return mockStructuredResponse;
  }),
  generateText: mock(async () => 'not-used-here'),
}));

// Import after mocks
import { STUDENT_SUBJECTS } from '../config/prompts/adaptation/subjects';
const { intentClassifierService } = await import('../services/chat/intent-classifier.service');

beforeEach(() => {
  mockStructuredResponse = { intent: 'explain-concept', confidence: 'high', subject: 'mathematiques' };
});

// --- STUDENT_SUBJECTS enum ---

describe('STUDENT_SUBJECTS enum', () => {
  it('contains mathematiques', () => {
    expect(STUDENT_SUBJECTS).toContain('mathematiques');
  });

  it('contains histoire-geo', () => {
    expect(STUDENT_SUBJECTS).toContain('histoire-geo');
  });

  it('contains all 6 expected values', () => {
    expect(STUDENT_SUBJECTS).toHaveLength(6);
    expect(STUDENT_SUBJECTS).toContain('francais');
    expect(STUDENT_SUBJECTS).toContain('langues');
    expect(STUDENT_SUBJECTS).toContain('sciences');
    expect(STUDENT_SUBJECTS).toContain('general');
  });
});

// --- ClassifiedIntent.subject propagation ---

describe('IntentClassifier subject propagation', () => {
  it('returns subject from LLM when valid', async () => {
    mockStructuredResponse = { intent: 'explain-concept', confidence: 'high', subject: 'mathematiques' };
    const result = await intentClassifierService.classify('Explique les fractions', 'sixieme');

    expect(result.subject).toBe('mathematiques');
    expect(result.intent).toBe('explain-concept');
    expect(result.confidence).toBe('high');
  });

  it('falls back to general when subject is invalid', async () => {
    mockStructuredResponse = { intent: 'explain-concept', confidence: 'medium', subject: 'physique-chimie' };
    const result = await intentClassifierService.classify("C'est quoi l'énergie ?", 'seconde');

    expect(result.subject).toBe('general');
    expect(result.intent).toBe('explain-concept');
  });

  it('returns subject:general on short-circuit (empty message)', async () => {
    const result = await intentClassifierService.classify('ab', 'sixieme');

    expect(result.intent).toBe('unknown');
    expect(result.subject).toBe('general');
  });

  it('returns subject:general on short-circuit (chit-chat greeting)', async () => {
    const result = await intentClassifierService.classify('bonjour', 'premiere');

    expect(result.intent).toBe('chit-chat');
    expect(result.subject).toBe('general');
  });

  it('returns subject:general when classifier errors', async () => {
    mockStructuredResponse = new Error('Mistral timeout');
    const result = await intentClassifierService.classify('Résous cette équation', 'terminale');

    expect(result.intent).toBe('unknown');
    expect(result.subject).toBe('general');
    expect(result.error).toBeDefined();
  });

  it('propagates francais subject from LLM', async () => {
    mockStructuredResponse = { intent: 'explain-concept', confidence: 'medium', subject: 'francais' };
    const result = await intentClassifierService.classify('Explique la métaphore', 'quatrieme');

    expect(result.subject).toBe('francais');
  });
});
