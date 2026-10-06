/**
 * A request budget per client address, in memory: right while the server runs as one instance.
 * The address is the connection's own, never a forwarding header a client could write; behind
 * the host's proxy, its trusted hops are configured at the preproduction step.
 */

import { getConnInfo } from '@hono/bun';
import type { Context, MiddlewareHandler } from 'hono';
import { RateLimiterMemory, RateLimiterRes } from 'rate-limiter-flexible';
import type { AppEnv } from './env';
import { Problem } from './problem';

// Under app.request, in tests, there is no Bun server behind the context and no address.
function clientAddress(c: Context<AppEnv>): string {
  return c.env ? (getConnInfo(c).remote.address ?? 'unknown') : 'unknown';
}

export function rateLimit({ points, durationSeconds }: { points: number; durationSeconds: number }): MiddlewareHandler<AppEnv> {
  const limiter = new RateLimiterMemory({ points, duration: durationSeconds });
  return async (c, next) => {
    try {
      await limiter.consume(clientAddress(c));
    } catch (rejection) {
      // consume() rejects with a RateLimiterRes when the budget is spent, with an Error otherwise.
      if (!(rejection instanceof RateLimiterRes)) throw rejection;
      c.header('Retry-After', String(Math.ceil(rejection.msBeforeNext / 1000)));
      throw new Problem('RATE_LIMITED');
    }
    await next();
  };
}
