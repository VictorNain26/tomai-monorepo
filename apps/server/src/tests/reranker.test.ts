/**
 * Reranker service tests — mock fetch, no network.
 *
 * Scenarios:
 *  - reranker disabled / unconfigured → passthrough order
 *  - happy path → reorders by cross-encoder score
 *  - HTTP 500 → fallback passthrough (no throw)
 *  - timeout → fallback passthrough
 *  - empty candidates → empty result
 *  - topN truncation
 */

import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';

const mockLogger = createMockLogger();
mock.module('../lib/observability', () => ({ logger: mockLogger }));

// Bypass the OTel span wrapping so the test doesn't pull in the SDK.
mock.module('../lib/otel/index', () => ({
  withGenAiSpan: async <T,>(
    _input: unknown,
    fn: (record: (facts: unknown) => void) => Promise<T>,
  ): Promise<T> => fn(() => {}),
}));

const originalFetch = globalThis.fetch;
const originalUrl = process.env['RERANKER_URL'];
const originalEnabled = process.env['RERANKER_ENABLED'];

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalUrl !== undefined) process.env['RERANKER_URL'] = originalUrl;
  else delete process.env['RERANKER_URL'];
  if (originalEnabled !== undefined) process.env['RERANKER_ENABLED'] = originalEnabled;
  else delete process.env['RERANKER_ENABLED'];
});

beforeEach(() => {
  delete process.env['RERANKER_URL'];
  delete process.env['RERANKER_ENABLED'];
});

async function importFresh() {
  const path = '../services/reranker.service' + `?cache_buster=${Math.random()}`;
  const mod = await import(path);
  return mod.rerankerService;
}

describe('RerankerService', () => {
  it('passthrough when RERANKER_URL is unset', async () => {
    const svc = await importFresh();
    expect(svc.isEnabled()).toBe(false);

    const out = await svc.rerank('q', [
      { id: 'a', text: 'A' },
      { id: 'b', text: 'B' },
    ]);
    expect(out).toEqual([
      { id: 'a', text: 'A', rerankScore: 0, rank: 1 },
      { id: 'b', text: 'B', rerankScore: 0, rank: 2 },
    ]);
  });

  it('reorders by cross-encoder score on happy path', async () => {
    process.env['RERANKER_URL'] = 'http://reranker.test';
    process.env['RERANKER_ENABLED'] = 'true';

    globalThis.fetch = mock(async () =>
      new Response(
        // index 1 is best, index 0 second, index 2 worst
        JSON.stringify([
          { index: 1, score: 0.92 },
          { index: 0, score: 0.71 },
          { index: 2, score: 0.18 },
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    ) as unknown as typeof fetch;

    const svc = await importFresh();
    const out = await svc.rerank('q', [
      { id: 'a', text: 'A' },
      { id: 'b', text: 'B' },
      { id: 'c', text: 'C' },
    ]);

    expect(out.map((c: { id: string }) => c.id)).toEqual(['b', 'a', 'c']);
    expect(out[0].rank).toBe(1);
    expect(out[0].rerankScore).toBeCloseTo(0.92, 2);
  });

  it('falls back to passthrough on HTTP 500', async () => {
    process.env['RERANKER_URL'] = 'http://reranker.test';
    process.env['RERANKER_ENABLED'] = 'true';

    globalThis.fetch = mock(async () =>
      new Response('boom', { status: 500 }),
    ) as unknown as typeof fetch;

    const svc = await importFresh();
    const out = await svc.rerank('q', [
      { id: 'a', text: 'A' },
      { id: 'b', text: 'B' },
    ]);
    // Original order preserved
    expect(out.map((c: { id: string }) => c.id)).toEqual(['a', 'b']);
  });

  it('falls back on AbortError (timeout)', async () => {
    process.env['RERANKER_URL'] = 'http://reranker.test';
    process.env['RERANKER_ENABLED'] = 'true';

    globalThis.fetch = mock(async () => {
      throw new DOMException('aborted', 'AbortError');
    }) as unknown as typeof fetch;

    const svc = await importFresh();
    const out = await svc.rerank('q', [{ id: 'a', text: 'A' }, { id: 'b', text: 'B' }]);
    expect(out.length).toBe(2);
  });

  it('returns empty array for empty input', async () => {
    process.env['RERANKER_URL'] = 'http://reranker.test';
    process.env['RERANKER_ENABLED'] = 'true';

    const svc = await importFresh();
    const out = await svc.rerank('q', []);
    expect(out).toEqual([]);
  });

  it('respects topN truncation', async () => {
    process.env['RERANKER_URL'] = 'http://reranker.test';
    process.env['RERANKER_ENABLED'] = 'true';

    globalThis.fetch = mock(async () =>
      new Response(
        JSON.stringify([
          { index: 0, score: 0.9 },
          { index: 1, score: 0.7 },
          { index: 2, score: 0.5 },
          { index: 3, score: 0.3 },
        ]),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    ) as unknown as typeof fetch;

    const svc = await importFresh();
    const out = await svc.rerank(
      'q',
      [
        { id: 'a', text: 'A' },
        { id: 'b', text: 'B' },
        { id: 'c', text: 'C' },
        { id: 'd', text: 'D' },
      ],
      { topN: 2 },
    );
    expect(out.length).toBe(2);
    expect(out.map((c: { id: string }) => c.id)).toEqual(['a', 'b']);
  });

  it('respects RERANKER_ENABLED=false override', async () => {
    process.env['RERANKER_URL'] = 'http://reranker.test';
    process.env['RERANKER_ENABLED'] = 'false';

    const svc = await importFresh();
    expect(svc.isEnabled()).toBe(false);

    const out = await svc.rerank('q', [{ id: 'a', text: 'A' }]);
    expect(out[0].rerankScore).toBe(0);
  });
});
