/**
 * Tests unitaires — Intent Classifier Service (Mistral aux model).
 * Mock : Mistral client (via setMistralClient) + logger + app config.
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';

const mockLogger = createMockLogger();
mock.module('../lib/observability', () => ({ logger: mockLogger }));

mock.module('../config/app.config', () => ({
  appConfig: {
    ai: {
      mistral: {
        apiKey: 'test-key',
        chatModel: 'mistral-small-latest',
        auxModel: 'mistral-small-latest',
      },
    },
  },
}));

const { intentClassifierService } = await import('../services/chat/intent-classifier.service');
const { setMistralClient } = await import('../lib/mistral-client');

// ---------------------------------------------------------------------------
// Mistral client stub injected via setMistralClient
// ---------------------------------------------------------------------------

let mockMistralResponse: { content: string } | Error = {
  content: '{"intent":"explain-concept","confidence":"high"}',
};

function makeStubClient() {
  return {
    chat: {
      complete: mock(async () => {
        if (mockMistralResponse instanceof Error) throw mockMistralResponse;
        return {
          choices: [{ message: { role: 'assistant', content: mockMistralResponse.content } }],
        };
      }),
    },
  } as unknown as Parameters<typeof setMistralClient>[0];
}

beforeEach(() => {
  mockMistralResponse = { content: '{"intent":"explain-concept","confidence":"high"}' };
  setMistralClient(makeStubClient());
});

describe('Intent Classifier Service', () => {
  describe('classify() — short-circuit paths', () => {
    it('returns unknown/low for empty string', async () => {
      const result = await intentClassifierService.classify('', 'troisieme');
      expect(result.intent).toBe('unknown');
      expect(result.confidence).toBe('low');
    });

    it('returns unknown/low for whitespace-only', async () => {
      const result = await intentClassifierService.classify('   ', 'troisieme');
      expect(result.intent).toBe('unknown');
      expect(result.confidence).toBe('low');
    });

    it('returns unknown/low for 2-char message', async () => {
      const result = await intentClassifierService.classify('ok', 'troisieme');
      expect(result.intent).toBe('unknown');
      expect(result.confidence).toBe('low');
    });

    it('detects a short "bonjour" as chit-chat/high', async () => {
      const result = await intentClassifierService.classify('Bonjour !', 'cm2');
      expect(result.intent).toBe('chit-chat');
      expect(result.confidence).toBe('high');
    });

    it('detects "merci" as chit-chat/high', async () => {
      const result = await intentClassifierService.classify('merci', 'cm2');
      expect(result.intent).toBe('chit-chat');
      expect(result.confidence).toBe('high');
    });

    it('does not short-circuit a longer greeting', async () => {
      mockMistralResponse = { content: '{"intent":"explain-concept","confidence":"medium"}' };
      const result = await intentClassifierService.classify('Bonjour, je bloque sur fractions', 'sixieme');
      expect(result.intent).toBe('explain-concept');
      expect(result.confidence).toBe('medium');
    });
  });

  describe('classify() — Mistral path', () => {
    it('parses a valid Mistral JSON response', async () => {
      mockMistralResponse = { content: '{"intent":"solve-this-for-me","confidence":"high"}' };
      const result = await intentClassifierService.classify(
        'Donne-moi la réponse à 3/4 + 2/5 stp',
        'cinquieme',
      );
      expect(result.intent).toBe('solve-this-for-me');
      expect(result.confidence).toBe('high');
    });

    it('falls back to unknown on invalid intent value', async () => {
      mockMistralResponse = { content: '{"intent":"not-a-real-intent","confidence":"high"}' };
      const result = await intentClassifierService.classify(
        'Explique-moi le théorème de Pythagore',
        'quatrieme',
      );
      expect(result.intent).toBe('unknown');
    });

    it('falls back to low confidence on invalid confidence value', async () => {
      mockMistralResponse = { content: '{"intent":"explain-concept","confidence":"bogus"}' };
      const result = await intentClassifierService.classify(
        'Explique-moi le théorème de Pythagore',
        'quatrieme',
      );
      expect(result.confidence).toBe('low');
    });

    it('returns unknown + error on Mistral throw', async () => {
      mockMistralResponse = new Error('mistral unavailable');
      const result = await intentClassifierService.classify(
        'Explique-moi le théorème de Pythagore',
        'quatrieme',
      );
      expect(result.intent).toBe('unknown');
      expect(result.confidence).toBe('low');
      expect(result.error).toBe('mistral unavailable');
    });

    it('returns unknown + error on malformed JSON', async () => {
      mockMistralResponse = { content: 'not json at all' };
      const result = await intentClassifierService.classify(
        'Explique-moi le théorème de Pythagore',
        'quatrieme',
      );
      expect(result.intent).toBe('unknown');
      expect(result.error).toBeDefined();
    });
  });

  describe('buildReinforcement()', () => {
    it('returns a critical_instruction block for solve-this-for-me / high', () => {
      const block = intentClassifierService.buildReinforcement({
        intent: 'solve-this-for-me',
        confidence: 'high',
      });
      expect(block).not.toBeNull();
      expect(block).toContain('<critical_instruction>');
      expect(block).toContain('</critical_instruction>');
      expect(block).toContain('socratique');
    });

    it('returns reinforcement for solve-this-for-me / medium', () => {
      const block = intentClassifierService.buildReinforcement({
        intent: 'solve-this-for-me',
        confidence: 'medium',
      });
      expect(block).not.toBeNull();
    });

    it('returns null for solve-this-for-me / low confidence', () => {
      expect(intentClassifierService.buildReinforcement({
        intent: 'solve-this-for-me',
        confidence: 'low',
      })).toBeNull();
    });

    it('returns a critical_instruction block for check-my-answer / high', () => {
      const block = intentClassifierService.buildReinforcement({
        intent: 'check-my-answer',
        confidence: 'high',
      });
      expect(block).not.toBeNull();
      expect(block).toContain('<critical_instruction>');
      expect(block).toContain('démarche');
    });

    it('returns null for check-my-answer / low confidence', () => {
      expect(intentClassifierService.buildReinforcement({
        intent: 'check-my-answer',
        confidence: 'low',
      })).toBeNull();
    });

    it('returns null for unknown / explain / chit-chat / clarify intents', () => {
      for (const intent of ['unknown', 'explain-concept', 'chit-chat', 'clarify-question'] as const) {
        expect(intentClassifierService.buildReinforcement({ intent, confidence: 'high' })).toBeNull();
      }
    });
  });
});
