/**
 * Tests unitaires - Cohere Rerank Service (services/rerank-cohere.service.ts)
 * Mock: fetch global + logger + Bun.env.COHERE_API_KEY
 */

import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';
import type { RerankedResult } from '../services/rerank.service';

// ============================================
// MOCKS
// ============================================

const mockLogger = createMockLogger();
mock.module('../lib/observability', () => ({ logger: mockLogger }));

// Import after mocks
const { isCohereRerankConfigured, rerankWithCohere } = await import('../services/rerank-cohere.service');

// ============================================
// Helpers
// ============================================

function makeDoc(id: string, title: string, content: string, score = 0.5): RerankedResult {
  return {
    id,
    title,
    content,
    score,
    rrf_score: score,
    final_score: score,
    matiere: 'mathematiques',
    niveau: 'troisieme',
  } as RerankedResult;
}

const originalKey = Bun.env['COHERE_API_KEY'];
const originalFetch = globalThis.fetch;

beforeEach(() => {
  Bun.env['COHERE_API_KEY'] = 'test-cohere-key';
});

afterEach(() => {
  // Restore env + fetch after each test so we don't pollute other suites
  if (originalKey === undefined) delete Bun.env['COHERE_API_KEY'];
  else Bun.env['COHERE_API_KEY'] = originalKey;
  globalThis.fetch = originalFetch;
});

// ============================================
// TESTS
// ============================================

describe('Cohere Rerank Service', () => {
  describe('isCohereRerankConfigured()', () => {
    it('should return true when COHERE_API_KEY is set', () => {
      Bun.env['COHERE_API_KEY'] = 'abc123';
      expect(isCohereRerankConfigured()).toBe(true);
    });

    it('should return false when COHERE_API_KEY is unset', () => {
      delete Bun.env['COHERE_API_KEY'];
      expect(isCohereRerankConfigured()).toBe(false);
    });

    it('should return false when COHERE_API_KEY is empty string', () => {
      Bun.env['COHERE_API_KEY'] = '';
      expect(isCohereRerankConfigured()).toBe(false);
    });
  });

  describe('rerankWithCohere() — short-circuits', () => {
    it('should throw when API key is missing', async () => {
      delete Bun.env['COHERE_API_KEY'];
      await expect(rerankWithCohere('query', [makeDoc('a', 'A', 'a')], 5))
        .rejects.toThrow('COHERE_API_KEY is not configured');
    });

    it('should return empty array for empty documents (no fetch call)', async () => {
      const fetchSpy = mock(async () => new Response(null, { status: 500 }));
      globalThis.fetch = fetchSpy as unknown as typeof fetch;

      const result = await rerankWithCohere('query', [], 5);
      expect(result).toEqual([]);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('should short-circuit single doc (no fetch call)', async () => {
      const fetchSpy = mock(async () => new Response(null, { status: 500 }));
      globalThis.fetch = fetchSpy as unknown as typeof fetch;

      const doc = makeDoc('a', 'A', 'alpha content');
      const result = await rerankWithCohere('query', [doc], 5);
      expect(result).toEqual([doc]);
      expect(fetchSpy).not.toHaveBeenCalled();
    });
  });

  describe('rerankWithCohere() — happy path', () => {
    it('should re-order docs by Cohere relevance_score and overwrite final_score', async () => {
      globalThis.fetch = (mock(async () => new Response(
        JSON.stringify({
          results: [
            { index: 2, relevance_score: 0.95 },
            { index: 0, relevance_score: 0.72 },
            { index: 1, relevance_score: 0.31 },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )) as unknown) as typeof fetch;

      const input = [
        makeDoc('a', 'First', 'alpha content', 0.1),
        makeDoc('b', 'Second', 'beta content', 0.2),
        makeDoc('c', 'Third', 'gamma content', 0.3),
      ];
      const result = await rerankWithCohere('test query', input, 10);

      expect(result).toHaveLength(3);
      // Ordering follows the Cohere response, not the input order
      expect(result[0]?.id).toBe('c');
      expect(result[1]?.id).toBe('a');
      expect(result[2]?.id).toBe('b');
      // final_score is overwritten with Cohere score
      expect(result[0]?.final_score).toBe(0.95);
      expect(result[1]?.final_score).toBe(0.72);
      expect(result[2]?.final_score).toBe(0.31);
    });

    it('should call fetch with proper URL, headers and body', async () => {
      const fetchSpy = mock(async () => new Response(
        JSON.stringify({ results: [{ index: 0, relevance_score: 0.9 }, { index: 1, relevance_score: 0.5 }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ));
      globalThis.fetch = fetchSpy as unknown as typeof fetch;

      const input = [makeDoc('a', 'A', 'x'), makeDoc('b', 'B', 'y')];
      await rerankWithCohere('query', input, 2);

      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
      expect(url).toBe('https://api.cohere.com/v2/rerank');
      expect(init.method).toBe('POST');
      const headers = init.headers as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer test-cohere-key');
      expect(headers['Content-Type']).toBe('application/json');

      const body = JSON.parse(init.body as string) as {
        model: string;
        query: string;
        documents: string[];
        top_n: number;
      };
      expect(body.model).toBe('rerank-v3.5');
      expect(body.query).toBe('query');
      expect(body.documents).toHaveLength(2);
      expect(body.top_n).toBe(2);
    });

    it('should truncate per-doc text to ~2000 chars', async () => {
      const fetchSpy = mock(async () => new Response(
        JSON.stringify({ results: [{ index: 0, relevance_score: 0.9 }, { index: 1, relevance_score: 0.5 }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ));
      globalThis.fetch = fetchSpy as unknown as typeof fetch;

      const longContent = 'x'.repeat(5000);
      const input = [
        makeDoc('a', 'A', longContent),
        makeDoc('b', 'B', 'short'),
      ];
      await rerankWithCohere('query', input, 5);

      const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
      const body = JSON.parse(init.body as string) as { documents: string[] };
      expect(body.documents[0]?.length).toBeLessThanOrEqual(2000);
      expect(body.documents[1]?.length).toBeLessThanOrEqual(2000);
    });

    it('should cap top_n at documents.length', async () => {
      const fetchSpy = mock(async () => new Response(
        JSON.stringify({ results: [{ index: 0, relevance_score: 0.9 }, { index: 1, relevance_score: 0.5 }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ));
      globalThis.fetch = fetchSpy as unknown as typeof fetch;

      const input = [makeDoc('a', 'A', 'x'), makeDoc('b', 'B', 'y')];
      await rerankWithCohere('query', input, 100);
      const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
      const body = JSON.parse(init.body as string) as { top_n: number };
      expect(body.top_n).toBe(2);
    });
  });

  describe('rerankWithCohere() — error surfaces', () => {
    it('should throw on non-200 HTTP status', async () => {
      globalThis.fetch = (mock(async () => new Response('server exploded', { status: 500 })) as unknown) as typeof fetch;
      const input = [makeDoc('a', 'A', 'x'), makeDoc('b', 'B', 'y')];
      await expect(rerankWithCohere('q', input, 5)).rejects.toThrow(/Cohere rerank HTTP 500/);
    });

    it('should throw on 401 Unauthorized', async () => {
      globalThis.fetch = (mock(async () => new Response('unauthorized', { status: 401 })) as unknown) as typeof fetch;
      const input = [makeDoc('a', 'A', 'x'), makeDoc('b', 'B', 'y')];
      await expect(rerankWithCohere('q', input, 5)).rejects.toThrow(/Cohere rerank HTTP 401/);
    });

    it('should throw when results is not an array', async () => {
      globalThis.fetch = (mock(async () => new Response(
        JSON.stringify({ results: 'not-an-array' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )) as unknown) as typeof fetch;
      const input = [makeDoc('a', 'A', 'x'), makeDoc('b', 'B', 'y')];
      await expect(rerankWithCohere('q', input, 5)).rejects.toThrow(/results.*array/);
    });

    it('should propagate a JSON parse error on malformed body', async () => {
      globalThis.fetch = (mock(async () => new Response(
        'not json!!!',
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )) as unknown) as typeof fetch;
      const input = [makeDoc('a', 'A', 'x'), makeDoc('b', 'B', 'y')];
      await expect(rerankWithCohere('q', input, 5)).rejects.toThrow();
    });

    it('should skip out-of-range indices returned by Cohere', async () => {
      globalThis.fetch = (mock(async () => new Response(
        JSON.stringify({
          results: [
            { index: 99, relevance_score: 0.99 }, // out of range — dropped
            { index: 0, relevance_score: 0.9 },
            { index: 1, relevance_score: 0.5 },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )) as unknown) as typeof fetch;

      const input = [makeDoc('a', 'A', 'x'), makeDoc('b', 'B', 'y')];
      const result = await rerankWithCohere('q', input, 5);
      expect(result).toHaveLength(2);
      expect(result[0]?.id).toBe('a');
      expect(result[1]?.id).toBe('b');
    });
  });
});
