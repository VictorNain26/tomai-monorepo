/**
 * Tests unitaires - Intent Classifier Service
 * Mock: Mistral client (lib/ai/mistral-client) + logger + app config
 *
 * Service migré Phase 2B vers `ministral-8b-latest` via
 * `generateStructured` du wrapper Mistral. JSON Schema strict garantit la
 * forme retournée — le test mocke directement la valeur parsée (pas du
 * string JSON brut).
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';

// ============================================
// MOCKS — paths relative to src/tests/
// ============================================

const mockLogger = createMockLogger();
mock.module('../lib/observability', () => ({ logger: mockLogger }));

mock.module('../config/env', () => ({
  env: {
    MISTRAL_API_KEY: 'test-key',
    MISTRAL_MODEL: 'mistral-medium-latest',
    MISTRAL_TEMPERATURE: 0.7,
    MISTRAL_MAX_TOKENS: 16384,
    MISTRAL_TIMEOUT: 60000,
    MISTRAL_RETRY_ATTEMPTS: 3,
    MISTRAL_RETRY_DELAY: 1000,
    NODE_ENV: 'test',
  },
}));

// Mistral client mock — generateStructured retourne directement l'objet parsé
// (JSON Schema strict garantit la forme côté Mistral).
let mockStructuredResponse: { intent?: string; confidence?: string } | Error = {
  intent: 'explain-concept',
  confidence: 'high',
};

// Mock COMPLET du wrapper Mistral (toutes les exports) pour ne pas casser
// d'autres tests qui partagent le même module-mock cache Bun et importeraient
// `generateText`.
mock.module('../lib/ai/mistral-client', () => ({
  generateStructured: mock(async () => {
    if (mockStructuredResponse instanceof Error) throw mockStructuredResponse;
    return mockStructuredResponse;
  }),
  generateText: mock(async () => 'not-used-here'),
}));

// Import after mocks
const { intentClassifierService } = await import('../services/chat/intent-classifier.service');

beforeEach(() => {
  mockStructuredResponse = { intent: 'explain-concept', confidence: 'high' };
});

describe('Intent Classifier Service', () => {
  describe('classify() — short-circuit paths', () => {
    it('should return unknown/low for empty string', async () => {
      const result = await intentClassifierService.classify('', 'troisieme');
      expect(result.intent).toBe('unknown');
      expect(result.confidence).toBe('low');
    });

    it('should return unknown/low for whitespace-only', async () => {
      const result = await intentClassifierService.classify('   ', 'troisieme');
      expect(result.intent).toBe('unknown');
      expect(result.confidence).toBe('low');
    });

    it('should return unknown/low for 2-char message', async () => {
      const result = await intentClassifierService.classify('ok', 'troisieme');
      expect(result.intent).toBe('unknown');
      expect(result.confidence).toBe('low');
    });

    it('should detect a short "bonjour" as chit-chat/high', async () => {
      const result = await intentClassifierService.classify('Bonjour !', 'cm2');
      expect(result.intent).toBe('chit-chat');
      expect(result.confidence).toBe('high');
    });

    it('should detect "merci" as chit-chat/high', async () => {
      const result = await intentClassifierService.classify('merci', 'cm2');
      expect(result.intent).toBe('chit-chat');
      expect(result.confidence).toBe('high');
    });

    it('should not short-circuit a 20-char greeting', async () => {
      // Longer messages go through Mistral even if they start with a greeting word.
      mockStructuredResponse = { intent: 'explain-concept', confidence: 'medium' };
      const result = await intentClassifierService.classify('Bonjour, je bloque sur fractions', 'sixieme');
      expect(result.intent).toBe('explain-concept');
      expect(result.confidence).toBe('medium');
    });
  });

  describe('classify() — Mistral path', () => {
    it('should parse a valid Mistral structured response', async () => {
      mockStructuredResponse = { intent: 'solve-this-for-me', confidence: 'high' };
      const result = await intentClassifierService.classify(
        'Donne-moi la réponse à 3/4 + 2/5 stp',
        'cinquieme',
      );
      expect(result.intent).toBe('solve-this-for-me');
      expect(result.confidence).toBe('high');
    });

    it('should fall back to unknown on invalid intent value', async () => {
      mockStructuredResponse = { intent: 'not-a-real-intent', confidence: 'high' };
      const result = await intentClassifierService.classify(
        "Explique-moi le théorème de Pythagore",
        'quatrieme',
      );
      expect(result.intent).toBe('unknown');
    });

    it('should fall back to low confidence on invalid confidence value', async () => {
      mockStructuredResponse = { intent: 'explain-concept', confidence: 'bogus' };
      const result = await intentClassifierService.classify(
        "Explique-moi le théorème de Pythagore",
        'quatrieme',
      );
      expect(result.confidence).toBe('low');
    });

    it('should return unknown + error on Mistral throw', async () => {
      mockStructuredResponse = new Error('mistral unavailable');
      const result = await intentClassifierService.classify(
        "Explique-moi le théorème de Pythagore",
        'quatrieme',
      );
      expect(result.intent).toBe('unknown');
      expect(result.confidence).toBe('low');
      expect(result.error).toBe('mistral unavailable');
    });

    // Note: avec JSON Schema strict côté Mistral, le payload malformé n'arrive
    // pas au client — l'API rejette en amont. Le cas "intent inconnu" est
    // couvert par le test "fall back to unknown on invalid intent value".
  });

  describe('buildReinforcement()', () => {
    it('should return a critical_instruction block for solve-this-for-me / high', () => {
      const block = intentClassifierService.buildReinforcement({
        intent: 'solve-this-for-me',
        confidence: 'high',
      });
      expect(block).not.toBeNull();
      expect(block).toContain('<critical_instruction>');
      expect(block).toContain('</critical_instruction>');
      expect(block).toContain('socratique');
    });

    it('should return reinforcement for solve-this-for-me / medium', () => {
      const block = intentClassifierService.buildReinforcement({
        intent: 'solve-this-for-me',
        confidence: 'medium',
      });
      expect(block).not.toBeNull();
    });

    it('should return null for solve-this-for-me / low confidence', () => {
      const block = intentClassifierService.buildReinforcement({
        intent: 'solve-this-for-me',
        confidence: 'low',
      });
      expect(block).toBeNull();
    });

    it('should return a critical_instruction block for check-my-answer / high', () => {
      const block = intentClassifierService.buildReinforcement({
        intent: 'check-my-answer',
        confidence: 'high',
      });
      expect(block).not.toBeNull();
      expect(block).toContain('<critical_instruction>');
      expect(block).toContain('démarche');
    });

    it('should return null for check-my-answer / low confidence', () => {
      const block = intentClassifierService.buildReinforcement({
        intent: 'check-my-answer',
        confidence: 'low',
      });
      expect(block).toBeNull();
    });

    it('should return null for unknown intent', () => {
      const block = intentClassifierService.buildReinforcement({
        intent: 'unknown',
        confidence: 'high',
      });
      expect(block).toBeNull();
    });

    it('should return null for explain-concept', () => {
      const block = intentClassifierService.buildReinforcement({
        intent: 'explain-concept',
        confidence: 'high',
      });
      expect(block).toBeNull();
    });

    it('should return null for chit-chat', () => {
      const block = intentClassifierService.buildReinforcement({
        intent: 'chit-chat',
        confidence: 'high',
      });
      expect(block).toBeNull();
    });

    it('should return null for clarify-question', () => {
      const block = intentClassifierService.buildReinforcement({
        intent: 'clarify-question',
        confidence: 'high',
      });
      expect(block).toBeNull();
    });
  });
});
