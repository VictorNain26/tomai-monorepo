import { describe, it, expect } from 'bun:test';
import { throttled } from '../eval/judge-rate';
import type { Generate } from '../eval/judge';

const opts = (characters: number): Parameters<Generate>[0] => ({
  messages: [{ role: 'user', content: 'x'.repeat(characters) }],
  schema: { parse: (v: unknown) => v } as never,
  schemaName: 's', functionId: 'f', model: 'm', temperature: 0, maxTokens: 10, safePrompt: false, seed: 1, promptCacheKey: 'k',
});

function recorder() {
  const starts: number[] = [];
  const generate: Generate = () => {
    starts.push(performance.now());
    return Promise.resolve({ object: undefined as never, usage: { inputTokens: 0, cachedInputTokens: 0, outputTokens: 0 } });
  };
  return { generate, starts };
}

describe('throttled', () => {
  it('lets calls through while they fit the budget', async () => {
    const { generate, starts } = recorder();
    const limited = throttled(generate, { requests: 10, tokens: 1000, intervalMs: 200 });
    await Promise.all([limited(opts(30)), limited(opts(30))]);
    expect(starts).toHaveLength(2);
    expect((starts[1] ?? 0) - (starts[0] ?? 0)).toBeLessThan(100);
  });

  it('holds a call that would pass the token budget until the window frees it', async () => {
    const { generate, starts } = recorder();
    // Each call weighs 600 / 3 + 10 = 210 tokens: the third exceeds 500 within the window.
    const limited = throttled(generate, { requests: 10, tokens: 500, intervalMs: 200 });
    await Promise.all([limited(opts(600)), limited(opts(600)), limited(opts(600))]);
    expect((starts[2] ?? 0) - (starts[0] ?? 0)).toBeGreaterThanOrEqual(150);
  });

  it('holds a call past the request budget', async () => {
    const { generate, starts } = recorder();
    const limited = throttled(generate, { requests: 2, tokens: 100_000, intervalMs: 200 });
    await Promise.all([limited(opts(3)), limited(opts(3)), limited(opts(3))]);
    expect((starts[2] ?? 0) - (starts[0] ?? 0)).toBeGreaterThanOrEqual(150);
  });
});
