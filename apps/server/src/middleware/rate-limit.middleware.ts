/**
 * Rate Limiting Middleware
 * Un compteur en mémoire par limiteur (rate-limiter-flexible), mono-instance.
 */

import type { Context, Env, MiddlewareHandler } from 'hono';
import { getConnInfo } from 'hono/bun';
import type { AuthEnv } from '../lib/http.js';
import { RateLimiterMemory, RateLimiterRes } from 'rate-limiter-flexible';
import { logger } from '../lib/observability';
import { isProduction, isDevelopment } from '../config/env';

interface RateLimitConfig<E extends Env> {
  maxRequests: number;
  windowSeconds: number;
  keyGenerator?: (context: Context<E>) => string;
}

/**
 * Configuration par défaut selon best practices
 * Production: Plus strict que développement
 */
const DEFAULT_CONFIG: RateLimitConfig<Env> = {
  maxRequests: isProduction() ? 100 : 500, // 100 req/min prod, 500 dev
  windowSeconds: 60, // 1 minute
};

/**
 * Générateur de clé par défaut basé sur IP
 *
 * Production: En derrière un unique proxy de confiance (Koyeb), l'IP client réelle
 * est l'entrée RIGHTMOST de X-Forwarded-For (ajoutée par le proxy).
 * Les entrées leftmost sont contrôlables par le client → non fiables en prod.
 *
 * Développement: L'IP vient directement de la connexion (aucun proxy). Sans
 * serveur Bun derrière le contexte (tests via app.request), il n'y en a pas.
 */
function connectionAddress(context: Context): string | undefined {
  return context.env ? getConnInfo(context).remote.address : undefined;
}

export function defaultKeyGenerator(context: Context): string {
  const forwardedFor = context.req.header('x-forwarded-for');
  const realIp = context.req.header('x-real-ip');
  const cfConnectingIp = context.req.header('cf-connecting-ip');

  const ip = isProduction() && forwardedFor
    ? // Production: take the RIGHTMOST IP from X-Forwarded-For
      // (added by Koyeb proxy), not the leftmost (client-controllable)
      forwardedFor.split(',').map((p) => p.trim()).at(-1) ?? 'unknown'
    : // Development or fallback: use cloudflare > x-real-ip > direct connection
      cfConnectingIp ?? realIp ?? connectionAddress(context) ?? 'unknown';

  return `ip:${ip}`;
}

/**
 * Middleware factory pour rate limiting
 */
export function createRateLimitMiddleware<E extends Env>(
  config: Partial<RateLimitConfig<E>> = {},
): MiddlewareHandler<E> {
  const maxRequests = config.maxRequests ?? DEFAULT_CONFIG.maxRequests;
  const windowSeconds = config.windowSeconds ?? DEFAULT_CONFIG.windowSeconds;
  const keyGenerator: (context: Context<E>) => string = config.keyGenerator ?? defaultKeyGenerator;
  const limiter = new RateLimiterMemory({ points: maxRequests, duration: windowSeconds });

  return async function rateLimitMiddleware(c, next) {
    let identifier: string;
    let allowed: boolean;
    let result: RateLimiterRes;

    try {
      identifier = keyGenerator(c);
      ({ allowed, result } = await limiter.consume(identifier).then(
        (res) => ({ allowed: true, result: res }),
        (rejection: unknown) => {
          // consume() rejects with a RateLimiterRes when the quota is spent, with an Error otherwise
          if (rejection instanceof RateLimiterRes) return { allowed: false, result: rejection };
          throw rejection;
        },
      ));
    } catch (error) {
      // Fail-closed: On error, block the request (security > availability)
      logger.error('Rate limit middleware error', {
        operation: 'rate-limit:error',
        err: error,
        severity: 'high' as const,
      });

      return c.json({
        error: 'Service Unavailable',
        message: 'Rate limit check failed. Please try again later.',
      }, 503);
    }

    c.header('X-RateLimit-Limit', maxRequests.toString());
    c.header('X-RateLimit-Remaining', result.remainingPoints.toString());
    c.header('X-RateLimit-Reset', Math.ceil((Date.now() + result.msBeforeNext) / 1000).toString());

    if (!allowed) {
      const retryAfterSeconds = Math.ceil(result.msBeforeNext / 1000);

      logger.warn('Rate limit exceeded', {
        operation: 'rate-limit:exceeded',
        identifier,
        metadata: {
          maxRequests,
          windowSeconds,
          path: c.req.path,
        },
      });

      c.header('Retry-After', retryAfterSeconds.toString());
      return c.json({
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Maximum ${maxRequests} requests per ${windowSeconds} seconds.`,
        retryAfter: retryAfterSeconds,
      }, 429);
    }

    if (isDevelopment() && result.remainingPoints < 10) {
      logger.debug('Rate limit check', {
        operation: 'rate-limit:check',
        identifier,
        remaining: result.remainingPoints,
        metadata: { maxRequests },
      });
    }

    return next();
  };
}

/**
 * Configurations prédéfinies pour différents endpoints
 */
export const RateLimitPresets = {
  // API générale
  api: {
    maxRequests: isProduction() ? 100 : 500,
    windowSeconds: 60,
  },

  // Chat/AI endpoints (modéré car coûteux)
  ai: {
    maxRequests: isProduction() ? 30 : 100,
    windowSeconds: 60,
    // Requires requireUser to run first so c.var.user is set.
    keyGenerator: (context: Context<AuthEnv>) => `ai:user:${context.var.user.id}`,
  },
} as const;
