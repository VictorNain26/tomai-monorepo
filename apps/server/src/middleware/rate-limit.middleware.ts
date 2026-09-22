/**
 * Rate Limiting Middleware - Production-Ready
 * Protection DDoS et brute-force avec in-memory backend
 */

import type { Context } from 'elysia';
import { logger } from '../lib/observability';
import { isProduction, isDevelopment } from '../config/env';

interface RateLimitConfig {
  maxRequests: number;
  windowSeconds: number;
  skipSuccessfulRequests?: boolean;
  keyGenerator?: (context: Context) => string;
}

/**
 * Configuration par défaut selon best practices
 * Production: Plus strict que développement
 */
const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequests: isProduction() ? 100 : 500, // 100 req/min prod, 500 dev
  windowSeconds: 60, // 1 minute
  skipSuccessfulRequests: false,
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
 * In-memory rate limit store (mono-instance)
 */
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Cleanup expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (record.resetTime <= now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

/**
 * Check rate limit (in-memory)
 */
function checkRateLimit(
  identifier: string,
  maxRequests: number,
  windowSeconds: number
): { allowed: boolean; remaining: number; resetTime: number } {
  const now = Date.now();
  const key = `ratelimit:${identifier}`;
  const record = rateLimitStore.get(key);

  // No record or expired
  if (!record || record.resetTime <= now) {
    const resetTime = now + windowSeconds * 1000;
    rateLimitStore.set(key, { count: 1, resetTime });
    return { allowed: true, remaining: maxRequests - 1, resetTime };
  }

  // Increment
  record.count++;
  const allowed = record.count <= maxRequests;
  const remaining = Math.max(0, maxRequests - record.count);

  return { allowed, remaining, resetTime: record.resetTime };
}

/**
 * Middleware factory pour rate limiting
 */
export function createRateLimitMiddleware(config: Partial<RateLimitConfig> = {}) {
  const finalConfig: RateLimitConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    keyGenerator: config.keyGenerator ?? defaultKeyGenerator,
  };

  return function rateLimitMiddleware(context: Context) {
    try {
      // Générer clé unique pour cet identifiant
      const identifier = finalConfig.keyGenerator!(context);

      // Vérifier rate limit (in-memory, synchrone)
      const { allowed, remaining, resetTime } = checkRateLimit(
        identifier,
        finalConfig.maxRequests,
        finalConfig.windowSeconds
      );

      // Ajouter headers rate limit (standard HTTP)
      const headers: Record<string, string> = {
        ...(context.set.headers as Record<string, string>),
        'X-RateLimit-Limit': finalConfig.maxRequests.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': Math.ceil(resetTime / 1000).toString(),
      };

      (context.set.headers as Record<string, string>) = headers;

      // Si limite dépassée, bloquer la requête
      if (!allowed) {
        const retryAfterSeconds = Math.ceil((resetTime - Date.now()) / 1000);

        logger.warn('Rate limit exceeded', {
          operation: 'rate-limit:exceeded',
          identifier,
          metadata: {
            maxRequests: finalConfig.maxRequests,
            windowSeconds: finalConfig.windowSeconds,
            path: new URL(context.request.url).pathname,
          },
        });

        context.set.status = 429;
        (context.set.headers as Record<string, string>)['Retry-After'] = retryAfterSeconds.toString();
        return {
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Maximum ${finalConfig.maxRequests} requests per ${finalConfig.windowSeconds} seconds.`,
          retryAfter: retryAfterSeconds,
        };
      }

      // Logger les requêtes en développement
      if (isDevelopment() && remaining < 10) {
        logger.debug('Rate limit check', {
          operation: 'rate-limit:check',
          identifier,
          remaining,
          metadata: { maxRequests: finalConfig.maxRequests },
        });
      }

      return;

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

  // Auth endpoints (plus strict pour éviter brute-force)
  auth: {
    maxRequests: isProduction() ? 10 : 50,
    windowSeconds: 60,
    keyGenerator: (context: Context) => {
      // Type assertion pour body qui contient potentiellement email
      const body = context.body as { email?: string } | undefined;
      const email = body?.email;
      return email ? `auth:email:${email}` : defaultKeyGenerator(context);
    },
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

  // File upload (très strict)
  upload: {
    maxRequests: isProduction() ? 5 : 20,
    windowSeconds: 60,
  },

  // Public endpoints (plus permissif)
  public: {
    maxRequests: isProduction() ? 200 : 1000,
    windowSeconds: 60,
  },

  // Pronote connection - OWASP/Cloudflare best practice
  // QR code auth = already 2FA (QR + PIN), less strict than password auth
  // Cloudflare recommends: 10 req / 10 min for auth tier 2
  // @see https://developers.cloudflare.com/waf/rate-limiting-rules/best-practices/
  pronote: {
    maxRequests: isProduction() ? 10 : 50,
    windowSeconds: 300, // 5 minutes
    keyGenerator: (context: Context) => {
      // Rate limit par user authentifié (injecté par authMacro `resolve`).
      // Requiert que ce middleware tourne APRÈS `.guard({ auth: true })`.
      const ctx = context as Context & { user?: { id: string } };
      const userId = ctx.user?.id;
      return userId ? `pronote:user:${userId}` : defaultKeyGenerator(context);
    },
  },
} as const;
