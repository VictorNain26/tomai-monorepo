import { describe, it, expect } from 'bun:test';
import { APICallError } from 'ai';
import { throttled } from '../eval/judge-rate';
import { z } from 'zod';
import { NO_USAGE, type Generate } from '../eval/judge-config';

const opts = (characters: number): Parameters<Generate>[0] => ({
  messages: [{ role: 'user', content: 'x'.repeat(characters) }],
  schema: z.unknown(),
  schemaName: 's', functionId: 'f', model: 'm', temperature: 0, maxTokens: 10, maxRetries: 0, safePrompt: false, seed: 1, promptCacheKey: 'k', repairInvalid: false,
});

// What a call resolves to once through: the schema read on an empty answer.
const answered: Generate = (o) => Promise.resolve({ object: o.schema.parse(undefined), usage: NO_USAGE });

function recorder() {
  const starts: number[] = [];
  const generate: Generate = (o) => {
    starts.push(performance.now());
    return answered(o);
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

  it('waits out a rate limit or an outage and tries again, a few times at most', async () => {
    const limit = () => new APICallError({ message: 'Rate limit exceeded', url: 'u', requestBodyValues: {}, statusCode: 429 });
    let calls = 0;
    const flaky: Generate = (o) => {
      calls += 1;
      return calls < 3 ? Promise.reject(limit()) : answered(o);
    };
    await throttled(flaky, { requests: 10, tokens: 1000, intervalMs: 20 })(opts(3));
    expect(calls).toBe(3);

    let attempts = 0;
    const always: Generate = () => { attempts += 1; return Promise.reject(limit()); };
    const outcome = await throttled(always, { requests: 10, tokens: 1000, intervalMs: 20 })(opts(3)).then(() => 'resolved', (e: unknown) => String(e));
    expect(outcome).toContain('Rate limit exceeded');
    expect(attempts).toBe(4);

    let unavailable = 0;
    const outage: Generate = (o) => {
      unavailable += 1;
      return unavailable < 2
        ? Promise.reject(new APICallError({ message: 'Service unavailable', url: 'u', requestBodyValues: {}, statusCode: 503 }))
        : answered(o);
    };
    await throttled(outage, { requests: 10, tokens: 1000, intervalMs: 20 })(opts(3));
    expect(unavailable).toBe(2);

    let rejected = 0;
    const invalid: Generate = () => { rejected += 1; return Promise.reject(new APICallError({ message: 'Bad request', url: 'u', requestBodyValues: {}, statusCode: 400 })); };
    await throttled(invalid, { requests: 10, tokens: 1000, intervalMs: 20 })(opts(3)).catch(() => undefined);
    expect(rejected).toBe(1);

    let other = 0;
    const broken: Generate = () => { other += 1; return Promise.reject(new Error('500')); };
    await throttled(broken, { requests: 10, tokens: 1000, intervalMs: 20 })(opts(3)).catch(() => undefined);
    expect(other).toBe(1);
  });
});
