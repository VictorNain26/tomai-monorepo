/**
 * Tests unitaires - Intent Classifier Service
 * Mock: Gemini client (via setGeminiClient) + logger + app config
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';

// ============================================
// MOCKS — paths relative to src/tests/
// ============================================

const mockLogger = createMockLogger();
mock.module('../lib/observability', () => ({ logger: mockLogger }));

mock.module('../config/app.config', () => ({
  appConfig: {
    ai: {
      gemini: {
        apiKey: 'test-key',
        model: 'gemini-2.5-flash',
      },
    },
  },
}));

// Import after mocks
const { intentClassifierService } = await import('../services/chat/intent-classifier.service');
const { setGeminiClient } = await import('../lib/gemini-client');

// ============================================
// Gemini client stub (injected via setGeminiClient)
// ============================================

let mockGeminiResponse: { text?: string } | Error = { text: '{"intent":"explain-concept","confidence":"high"}' };

function makeStubClient() {
  return {
    models: {
      generateContent: mock(async () => {
        if (mockGeminiResponse instanceof Error) throw mockGeminiResponse;
        return mockGeminiResponse;
      }),
    },
  } as unknown as Parameters<typeof setGeminiClient>[0];
}

beforeEach(() => {
  mockGeminiResponse = { text: '{"intent":"explain-concept","confidence":"high"}' };
  setGeminiClient(makeStubClient());
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
      // Longer messages go through Gemini even if they start with a greeting word.
      mockGeminiResponse = { text: '{"intent":"explain-concept","confidence":"medium"}' };
      const result = await intentClassifierService.classify('Bonjour, je bloque sur fractions', 'sixieme');
      expect(result.intent).toBe('explain-concept');
      expect(result.confidence).toBe('medium');
    });
  });

  describe('classify() — Gemini path', () => {
    it('should parse a valid Gemini JSON response', async () => {
      mockGeminiResponse = { text: '{"intent":"solve-this-for-me","confidence":"high"}' };
      const result = await intentClassifierService.classify(
        'Donne-moi la réponse à 3/4 + 2/5 stp',
        'cinquieme',
      );
      expect(result.intent).toBe('solve-this-for-me');
      expect(result.confidence).toBe('high');
    });

    it('should fall back to unknown on invalid intent value', async () => {
      mockGeminiResponse = { text: '{"intent":"not-a-real-intent","confidence":"high"}' };
      const result = await intentClassifierService.classify(
        "Explique-moi le théorème de Pythagore",
        'quatrieme',
      );
      expect(result.intent).toBe('unknown');
    });

    it('should fall back to low confidence on invalid confidence value', async () => {
      mockGeminiResponse = { text: '{"intent":"explain-concept","confidence":"bogus"}' };
      const result = await intentClassifierService.classify(
        "Explique-moi le théorème de Pythagore",
        'quatrieme',
      );
      expect(result.confidence).toBe('low');
    });

    it('should return unknown + error on Gemini throw', async () => {
      mockGeminiResponse = new Error('gemini unavailable');
      const result = await intentClassifierService.classify(
        "Explique-moi le théorème de Pythagore",
        'quatrieme',
      );
      expect(result.intent).toBe('unknown');
      expect(result.confidence).toBe('low');
      expect(result.error).toBe('gemini unavailable');
    });

    it('should return unknown + error on malformed JSON', async () => {
      mockGeminiResponse = { text: 'not json at all' };
      const result = await intentClassifierService.classify(
        "Explique-moi le théorème de Pythagore",
        'quatrieme',
      );
      expect(result.intent).toBe('unknown');
      expect(result.error).toBeDefined();
    });
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
