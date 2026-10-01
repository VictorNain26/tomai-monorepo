/**
 * Tests unitaires - Rate Limit Middleware
 * Mock: logger, env
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import type { Context } from 'elysia';
import { createMockLogger } from './_helpers/mock-logger';

// ============================================
// MOCKS
// ============================================

const mockLogger = createMockLogger();
mock.module('../lib/observability', () => ({ logger: mockLogger }));

// Mock env — isProduction() is read at middleware creation time
let mockIsProduction = true;
let mockIsDevelopment = false;

mock.module('../config/env', () => ({
  isProduction: () => mockIsProduction,
  isDevelopment: () => mockIsDevelopment,
}));

// Import after mocks
const { createRateLimitMiddleware, defaultKeyGenerator, RateLimitPresets } = await import('../middleware/rate-limit.middleware');

// ============================================
// Test Helpers
// ============================================

/**
 * Create a mock Context with custom request headers
 */
function createMockContext(headers: Record<string, string>): Partial<Context> {
  return {
    request: {
      headers: new Map(Object.entries(headers)),
      url: 'http://localhost/api/test',
    } as unknown as Request,
    set: {
      headers: {},
      status: 200,
    },
  };
}

beforeEach(() => {
  mockIsProduction = true;
  mockIsDevelopment = false;
  mockLogger.error.mockClear?.();
  mockLogger.warn.mockClear?.();
  mockLogger.debug.mockClear?.();
});

describe('Rate Limit Middleware', () => {
  describe('X-Forwarded-For Header - Anti-spoofing (C3a)', () => {
    it('should use RIGHTMOST IP in X-Forwarded-For when in production (trusted proxy)', async () => {
      // Simulates: client forges leftmost IP → proxy adds rightmost IP
      // Client sends: X-Forwarded-For: 1.2.3.4, 9.9.9.9
      // (1.2.3.4 is forged by client, 9.9.9.9 is added by Koyeb proxy — the real client)
      mockIsProduction = true;

      const extractedKeys = new Set<string>();

      const middleware = createRateLimitMiddleware({
        maxRequests: 1000, // Very high limit to avoid rate limit blocking this test
        windowSeconds: 60,
        keyGenerator: (context: Context): string => {
          // Use the real defaultKeyGenerator function
          const key = defaultKeyGenerator(context);
          extractedKeys.add(key);
          return key;
        },
      });

      // First request: forged leftmost IP, rightmost is 9.9.9.9
      const context1 = createMockContext({
        'x-forwarded-for': '1.2.3.4, 9.9.9.9',
      }) as Context;
      const result1 = await middleware(context1);
      expect(result1).toBeUndefined();

      // Second request: different forged leftmost IP, same rightmost 9.9.9.9
      const context2 = createMockContext({
        'x-forwarded-for': '3.3.3.3, 9.9.9.9',
      }) as Context;
      const result2 = await middleware(context2);
      expect(result2).toBeUndefined();

      // Third request: different rightmost IP (8.8.8.8)
      const context3 = createMockContext({
        'x-forwarded-for': '1.2.3.4, 8.8.8.8',
      }) as Context;
      const result3 = await middleware(context3);
      expect(result3).toBeUndefined();

      // Verify that only 2 distinct keys were created (9.9.9.9 and 8.8.8.8)
      // If the leftmost IP was used, we'd have 3 keys
      expect(extractedKeys.size).toBe(2);
      expect(extractedKeys.has('ip:9.9.9.9')).toBe(true);
      expect(extractedKeys.has('ip:8.8.8.8')).toBe(true);
      // Must NOT contain the forged IPs or dev fallback
      expect(extractedKeys.has('ip:1.2.3.4')).toBe(false);
      expect(extractedKeys.has('ip:3.3.3.3')).toBe(false);
      expect(extractedKeys.has('ip:development')).toBe(false);
    });

    it('should NOT use X-Forwarded-For in development (direct connection)', async () => {
      mockIsProduction = false;
      mockIsDevelopment = true;

      const extractedKeys = new Set<string>();

      const middleware = createRateLimitMiddleware({
        maxRequests: 1000,
        windowSeconds: 60,
        keyGenerator: (context: Context): string => {
          // Use the real defaultKeyGenerator function
          const key = defaultKeyGenerator(context);
          extractedKeys.add(key);
          return key;
        },
      });

      // In dev, X-Forwarded-For should be ignored, use development fallback
      const context = createMockContext({
        'x-forwarded-for': '1.2.3.4, 9.9.9.9',
        'cf-connecting-ip': '7.7.7.7',
      }) as Context;

      const result = await middleware(context);
      expect(result).toBeUndefined();
      // In dev mode, when no X-Forwarded-For is present and cfConnectingIp is 7.7.7.7,
      // the key should use cfConnectingIp
      expect(extractedKeys.has('ip:7.7.7.7')).toBe(true);
      expect(extractedKeys.has('ip:9.9.9.9')).toBe(false);
    });

    it('should fail-closed on middleware error (return 503)', async () => {
      mockIsProduction = true;

      // Create middleware with an invalid keyGenerator to trigger an error
      const middleware = createRateLimitMiddleware({
        maxRequests: 10,
        windowSeconds: 60,
        keyGenerator: () => {
          throw new Error('Key generator error');
        },
      });

      const context = createMockContext({
        'x-forwarded-for': '9.9.9.9',
      }) as Context;

      const result = await middleware(context);
      expect(result).not.toBeUndefined();
      expect((result as unknown as { error: string })?.error).toBe('Service Unavailable');
      expect(context.set.status).toBe(503);
    });
  });

  describe('Quota', () => {
    const fixedKey = () => 'ip:1.1.1.1';

    it('lets requests through under the limit and reports the remaining quota', async () => {
      const middleware = createRateLimitMiddleware({ maxRequests: 2, windowSeconds: 60, keyGenerator: fixedKey });
      const context = createMockContext({}) as Context;

      expect(await middleware(context)).toBeUndefined();
      expect((context.set.headers as Record<string, string>)['X-RateLimit-Limit']).toBe('2');
      expect((context.set.headers as Record<string, string>)['X-RateLimit-Remaining']).toBe('1');
    });

    it('answers 429 with Retry-After once the limit is spent', async () => {
      const middleware = createRateLimitMiddleware({ maxRequests: 1, windowSeconds: 60, keyGenerator: fixedKey });
      await middleware(createMockContext({}) as Context);

      const context = createMockContext({}) as Context;
      const result = (await middleware(context)) as { error: string; retryAfter: number };

      expect(context.set.status).toBe(429);
      expect(result.error).toBe('Too Many Requests');
      expect(result.retryAfter).toBeGreaterThan(0);
      expect((context.set.headers as Record<string, string>)['Retry-After']).toBe(String(result.retryAfter));
    });

    it('keeps one counter per limiter for the same key', async () => {
      const strict = createRateLimitMiddleware({ maxRequests: 1, windowSeconds: 60, keyGenerator: fixedKey });
      const loose = createRateLimitMiddleware({ maxRequests: 5, windowSeconds: 60, keyGenerator: fixedKey });

      for (let i = 0; i < 3; i++) {
        expect(await loose(createMockContext({}) as Context)).toBeUndefined();
      }
      expect(await strict(createMockContext({}) as Context)).toBeUndefined();
    });
  });
});

describe('RateLimitPresets — per-user keying', () => {
  // Context shaped the way Elysia exposes it AFTER the auth `resolve` has run:
  // `user` is injected by authMacro. The preset only sees it if the rate-limit
  // runs after .guard({ auth: true }) — see rate-limit-ordering.test.ts.
  function authedCtx(userId: string | undefined): Context {
    return {
      request: {
        headers: new Map<string, string>([['x-forwarded-for', '9.9.9.9']]),
        url: 'http://localhost/api/chat/stream',
      },
      ...(userId ? { user: { id: userId } } : {}),
    } as unknown as Context;
  }

  it('ai keys by authenticated user id (not by shared IP)', () => {
    expect(RateLimitPresets.ai.keyGenerator?.(authedCtx('user-7'))).toBe('ai:user:user-7');
  });

  it('ai falls back to IP only when unauthenticated', () => {
    expect(RateLimitPresets.ai.keyGenerator?.(authedCtx(undefined))).toBe('ip:9.9.9.9');
  });
});
