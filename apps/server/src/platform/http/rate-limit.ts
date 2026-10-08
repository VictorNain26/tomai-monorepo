/**
 * A request budget per client address (./client-address.ts), in memory: right while the server
 * runs as one instance.
 */

import type { MiddlewareHandler } from 'hono';
import { RateLimiterMemory, RateLimiterRes } from 'rate-limiter-flexible';
import type { AppEnv } from './env';
import { Problem } from './problem';

export function rateLimit({ points, durationSeconds }: { points: number; durationSeconds: number }): MiddlewareHandler<AppEnv> {
  const limiter = new RateLimiterMemory({ points, duration: durationSeconds });
  return async (c, next) => {
    try {
      await limiter.consume(c.var.clientAddress);
    } catch (rejection) {
      // consume() rejects with a RateLimiterRes when the budget is spent, with an Error otherwise.
      if (!(rejection instanceof RateLimiterRes)) throw rejection;
      c.header('Retry-After', String(Math.ceil(rejection.msBeforeNext / 1000)));
      throw new Problem('RATE_LIMITED');
    }
    await next();
  };
}
