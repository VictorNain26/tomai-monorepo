import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { Hono, type Context, type MiddlewareHandler } from 'hono';
import { createMockLogger } from './_helpers/mock-logger';

const mockLogger = createMockLogger();
mock.module('../lib/observability', () => ({ logger: mockLogger }));

// isProduction() is read when a key is generated
let mockIsProduction = true;
mock.module('../config/env', () => ({
  isProduction: () => mockIsProduction,
  isDevelopment: () => !mockIsProduction,
}));

const { createRateLimitMiddleware, defaultKeyGenerator, RateLimitPresets } = await import('../middleware/rate-limit.middleware');

function appWith(middleware: MiddlewareHandler) {
  return new Hono().use(middleware).get('/t', (c) => c.text('ok'));
}

function capturingKeys() {
  const keys = new Set<string>();
  return { keys, keyGenerator: (c: Context) => { const key = defaultKeyGenerator(c); keys.add(key); return key; } };
}

beforeEach(() => {
  mockIsProduction = true;
  mockLogger.error.mockClear();
});

describe('defaultKeyGenerator', () => {
  it('uses the RIGHTMOST X-Forwarded-For entry in production (added by the trusted proxy)', async () => {
    const { keys, keyGenerator } = capturingKeys();
    const app = appWith(createRateLimitMiddleware({ maxRequests: 1000, keyGenerator }));

    await app.request('/t', { headers: { 'x-forwarded-for': '1.2.3.4, 9.9.9.9' } });
    await app.request('/t', { headers: { 'x-forwarded-for': '3.3.3.3, 9.9.9.9' } });
    await app.request('/t', { headers: { 'x-forwarded-for': '1.2.3.4, 8.8.8.8' } });

    expect([...keys].sort()).toEqual(['ip:8.8.8.8', 'ip:9.9.9.9']);
  });

  it('ignores X-Forwarded-For in development', async () => {
    mockIsProduction = false;
    const { keys, keyGenerator } = capturingKeys();
    const app = appWith(createRateLimitMiddleware({ maxRequests: 1000, keyGenerator }));

    await app.request('/t', { headers: { 'x-forwarded-for': '1.2.3.4, 9.9.9.9', 'cf-connecting-ip': '7.7.7.7' } });

    expect([...keys]).toEqual(['ip:7.7.7.7']);
  });
});

describe('createRateLimitMiddleware', () => {
  const fixedKey = () => 'ip:1.1.1.1';

  it('lets requests through under the limit and reports the remaining quota', async () => {
    const res = await appWith(createRateLimitMiddleware({ maxRequests: 2, keyGenerator: fixedKey })).request('/t');

    expect(res.status).toBe(200);
    expect(res.headers.get('X-RateLimit-Limit')).toBe('2');
    expect(res.headers.get('X-RateLimit-Remaining')).toBe('1');
  });

  it('answers 429 with Retry-After once the limit is spent', async () => {
    const app = appWith(createRateLimitMiddleware({ maxRequests: 1, keyGenerator: fixedKey }));
    await app.request('/t');

    const res = await app.request('/t');
    const body = (await res.json()) as { error: string; retryAfter: number };

    expect(res.status).toBe(429);
    expect(body.error).toBe('Too Many Requests');
    expect(body.retryAfter).toBeGreaterThan(0);
    expect(res.headers.get('Retry-After')).toBe(String(body.retryAfter));
  });

  it('keeps one counter per limiter for the same key', async () => {
    const strict = appWith(createRateLimitMiddleware({ maxRequests: 1, keyGenerator: fixedKey }));
    const loose = appWith(createRateLimitMiddleware({ maxRequests: 5, keyGenerator: fixedKey }));

    for (let i = 0; i < 3; i++) {
      expect((await loose.request('/t')).status).toBe(200);
    }
    expect((await strict.request('/t')).status).toBe(200);
  });

  it('fails closed with 503 when the key cannot be computed', async () => {
    const app = appWith(createRateLimitMiddleware({
      keyGenerator: () => {
        throw new Error('Key generator error');
      },
    }));

    const res = await app.request('/t');

    expect(res.status).toBe(503);
    expect(((await res.json()) as { error: string }).error).toBe('Service Unavailable');
  });
});

describe('RateLimitPresets.ai', () => {
  it('keys by the authenticated user, never by the shared IP', async () => {
    const keys: string[] = [];
    const app = new Hono<{ Variables: { user: { id: string } } }>()
      .use(async (c, next) => {
        c.set('user', { id: 'user-7' });
        await next();
      })
      .get('/t', (c) => {
        keys.push(RateLimitPresets.ai.keyGenerator(c as never));
        return c.text('ok');
      });

    await app.request('/t', { headers: { 'x-forwarded-for': '9.9.9.9' } });

    expect(keys).toEqual(['ai:user:user-7']);
  });
});
