/**
 * A request budget per client address (./client-address.ts), an IPv6 one by its /64, the block a
 * single connection holds, as better-auth counts it; in memory: right while the server runs as one
 * instance.
 */

import { normalizeIP } from '@better-auth/core/utils/ip';
import type { MiddlewareHandler } from 'hono';
import { RateLimiterMemory, RateLimiterRes } from 'rate-limiter-flexible';
import type { AppEnv } from './env';
import { Problem } from './problem';

export function rateLimit({ points, durationSeconds }: { points: number; durationSeconds: number }): MiddlewareHandler<AppEnv> {
  const limiter = new RateLimiterMemory({ points, duration: durationSeconds });
  return async (c, next) => {
    try {
      await limiter.consume(normalizeIP(c.var.clientAddress));
    } catch (rejection) {
      // consume() rejects with a RateLimiterRes when the budget is spent, with an Error otherwise.
      if (!(rejection instanceof RateLimiterRes)) throw rejection;
      c.header('Retry-After', String(Math.ceil(rejection.msBeforeNext / 1000)));
      throw new Problem('RATE_LIMITED');
    }
    await next();
  };
}
