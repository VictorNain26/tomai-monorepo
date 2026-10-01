/**
 * Rate Limiting Middleware
 * Un compteur en mémoire par limiteur (rate-limiter-flexible), mono-instance.
 */

import type { Context } from 'elysia';
import { RateLimiterMemory, RateLimiterRes } from 'rate-limiter-flexible';
import { logger } from '../lib/observability';
import { isProduction, isDevelopment } from '../config/env';

interface RateLimitConfig {
  maxRequests: number;
  windowSeconds: number;
  keyGenerator?: (context: Context) => string;
}

/**
 * Configuration par défaut selon best practices
 * Production: Plus strict que développement
 */
const DEFAULT_CONFIG: RateLimitConfig = {
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
 * Développement: L'IP vient directement de la connexion (aucun proxy).
 */
export function defaultKeyGenerator(context: Context): string {
  const forwardedFor = context.request.headers.get('x-forwarded-for');
  const realIp = context.request.headers.get('x-real-ip');
  const cfConnectingIp = context.request.headers.get('cf-connecting-ip');

  const ip = isProduction() && forwardedFor
    ? // Production: take the RIGHTMOST IP from X-Forwarded-For
      // (added by Koyeb proxy), not the leftmost (client-controllable)
      forwardedFor.split(',').map((p) => p.trim()).at(-1) ?? 'unknown'
    : // Development or fallback: use cloudflare > x-real-ip > direct connection
      cfConnectingIp ?? realIp ?? 'unknown';

  return `ip:${ip}`;
}

/**
 * Middleware factory pour rate limiting
 */
export function createRateLimitMiddleware(config: Partial<RateLimitConfig> = {}) {
  const maxRequests = config.maxRequests ?? DEFAULT_CONFIG.maxRequests;
  const windowSeconds = config.windowSeconds ?? DEFAULT_CONFIG.windowSeconds;
  const keyGenerator = config.keyGenerator ?? defaultKeyGenerator;
  const limiter = new RateLimiterMemory({ points: maxRequests, duration: windowSeconds });

  return async function rateLimitMiddleware(context: Context) {
    let identifier: string;
    let allowed: boolean;
    let result: RateLimiterRes;

    try {
      identifier = keyGenerator(context);
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
        _error: error instanceof Error ? error.message : String(error),
        severity: 'high' as const,
      });

      context.set.status = 503;
      return {
        error: 'Service Unavailable',
        message: 'Rate limit check failed. Please try again later.',
      };
    }

    const resetTime = Date.now() + result.msBeforeNext;
    Object.assign(context.set.headers, {
      'X-RateLimit-Limit': maxRequests.toString(),
      'X-RateLimit-Remaining': result.remainingPoints.toString(),
      'X-RateLimit-Reset': Math.ceil(resetTime / 1000).toString(),
    });

    if (!allowed) {
      const retryAfterSeconds = Math.ceil(result.msBeforeNext / 1000);

      logger.warn('Rate limit exceeded', {
        operation: 'rate-limit:exceeded',
        identifier,
        metadata: {
          maxRequests,
          windowSeconds,
          path: new URL(context.request.url).pathname,
        },
      });

      context.set.status = 429;
      context.set.headers['Retry-After'] = retryAfterSeconds.toString();
      return {
        error: 'Too Many Requests',
        message: `Rate limit exceeded. Maximum ${maxRequests} requests per ${windowSeconds} seconds.`,
        retryAfter: retryAfterSeconds,
      };
    }

    if (isDevelopment() && result.remainingPoints < 10) {
      logger.debug('Rate limit check', {
        operation: 'rate-limit:check',
        identifier,
        remaining: result.remainingPoints,
        metadata: { maxRequests },
      });
    }

    return;
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
    keyGenerator: (context: Context) => {
      // Rate limit par user si authentifié - Type assertion pour user custom
      const ctx = context as Context & { user?: { id: string } };
      const userId = ctx.user?.id;
      return userId ? `ai:user:${userId}` : defaultKeyGenerator(context);
    },
  },
} as const;
