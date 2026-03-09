/**
 * Tests unitaires - Token Budget Service (services/chat/token-budget.service.ts)
 * 0 mocks — fonctions pures
 */

import { describe, it, expect } from 'bun:test';
import { estimateTokens, truncateToTokenBudget, calculateBudget } from '../services/chat/token-budget.service';

describe('Token Budget Service', () => {
  describe('estimateTokens', () => {
    it('should return 0 for empty string', () => {
      expect(estimateTokens('')).toBe(0);
    });

    it('should return 0 for null/undefined', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(estimateTokens(null as any)).toBe(0);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(estimateTokens(undefined as any)).toBe(0);
    });

    it('should use 4 chars per token heuristic', () => {
      expect(estimateTokens('abcd')).toBe(1); // 4 / 4 = 1
      expect(estimateTokens('abcdefgh')).toBe(2); // 8 / 4 = 2
      expect(estimateTokens('abcdefghijklmnop')).toBe(4); // 16 / 4 = 4
    });

    it('should ceil non-integer results', () => {
      expect(estimateTokens('abc')).toBe(1); // ceil(3/4) = 1
      expect(estimateTokens('abcde')).toBe(2); // ceil(5/4) = 2
      expect(estimateTokens('a')).toBe(1); // ceil(1/4) = 1
    });

    it('should handle French text with accents', () => {
      const text = 'Les élèves étudient les mathématiques';
      expect(estimateTokens(text)).toBe(Math.ceil(text.length / 4));
    });
  });

  describe('truncateToTokenBudget', () => {
    it('should return empty result for empty text', () => {
      const result = truncateToTokenBudget('', 100);
      expect(result.text).toBe('');
      expect(result.estimatedTokens).toBe(0);
      expect(result.wasTruncated).toBe(false);
    });

    it('should not truncate text within budget', () => {
      const text = 'Short text.';
      const result = truncateToTokenBudget(text, 100);
      expect(result.text).toBe(text);
      expect(result.wasTruncated).toBe(false);
    });

    it('should truncate at sentence boundary (period)', () => {
      const text = 'First sentence. Second sentence. Third sentence that is very long and goes on.';
      // Budget that fits ~first two sentences but not the third
      const budget = Math.ceil('First sentence. Second sentence.'.length / 4);
      const result = truncateToTokenBudget(text, budget);
      expect(result.wasTruncated).toBe(true);
      // Should cut at a sentence end
      expect(result.text.endsWith('.')).toBe(true);
    });

    it('should truncate at sentence boundary (exclamation)', () => {
      const text = 'First part! Second part that is extremely long and goes way beyond the budget.';
      const budget = Math.ceil('First part!'.length / 4) + 2;
      const result = truncateToTokenBudget(text, budget);
      expect(result.wasTruncated).toBe(true);
    });

    it('should truncate at sentence boundary (question mark)', () => {
      const text = 'Is this right? The rest is very very very very very very very very very long.';
      const budget = Math.ceil('Is this right?'.length / 4) + 2;
      const result = truncateToTokenBudget(text, budget);
      expect(result.wasTruncated).toBe(true);
    });

    it('should respect 50% minimum (no extreme truncation)', () => {
      // If sentence boundary is before 50% of maxChars, it falls back to raw truncation
      const text = 'A. ' + 'x'.repeat(1000);
      const budget = 50; // 200 chars
      const result = truncateToTokenBudget(text, budget);
      expect(result.wasTruncated).toBe(true);
      // Should not truncate to just "A." since that's way less than 50% of 200
      expect(result.text.length).toBeGreaterThan(3);
    });

    it('should set wasTruncated correctly', () => {
      const text = 'Hello world';
      expect(truncateToTokenBudget(text, 1000).wasTruncated).toBe(false);
      expect(truncateToTokenBudget(text, 1).wasTruncated).toBe(true);
    });
  });

  describe('calculateBudget', () => {
    it('should return correct available tokens', () => {
      const budget = calculateBudget();
      // 30000 - 2500 - 16384 = 11116
      expect(budget.availableTokens).toBe(11116);
    });

    it('should allocate 15% to summary', () => {
      const budget = calculateBudget();
      expect(budget.summaryMaxTokens).toBe(Math.floor(11116 * 0.15));
    });

    it('should allocate 55% to history', () => {
      const budget = calculateBudget();
      expect(budget.historyMaxTokens).toBe(Math.floor(11116 * 0.55));
    });

    it('should allocate 20% to RAG', () => {
      const budget = calculateBudget();
      expect(budget.ragMaxTokens).toBe(Math.floor(11116 * 0.20));
    });

    it('should allocate 10% to current message', () => {
      const budget = calculateBudget();
      expect(budget.currentMessageMaxTokens).toBe(Math.floor(11116 * 0.10));
    });

    it('should have allocations that sum close to total', () => {
      const budget = calculateBudget();
      const sum = budget.summaryMaxTokens + budget.historyMaxTokens +
                  budget.ragMaxTokens + budget.currentMessageMaxTokens;
      // Floor rounding may lose a few tokens, but should be within 4
      expect(budget.availableTokens - sum).toBeLessThanOrEqual(4);
    });
  });
});
