/**
 * Rate Limiting Middleware - Production-Ready
 * Protection DDoS et brute-force avec Redis backend
 */

import type { Context } from 'elysia';
import { CacheHelpers } from '../lib/redis.service';
import { logger } from '../lib/observability';
import { envUtils } from '../config/environment.config';

export interface RateLimitConfig {
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
  maxRequests: envUtils.isProduction ? 100 : 500, // 100 req/min prod, 500 dev
  windowSeconds: 60, // 1 minute
  skipSuccessfulRequests: false,
};

/**
 * Générateur de clé par défaut basé sur IP
 */
function defaultKeyGenerator(context: Context): string {
  // Essayer d'obtenir la vraie IP (derrière proxy/CDN)
  const forwardedFor = context.request.headers.get('x-forwarded-for');
  const realIp = context.request.headers.get('x-real-ip');
  const cfConnectingIp = context.request.headers.get('cf-connecting-ip');

  const ip = cfConnectingIp ?? realIp ?? forwardedFor?.split(',')[0] ?? 'unknown';

  return `ip:${ip}`;
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

  return async function rateLimitMiddleware(context: Context) {
    try {
      // Générer clé unique pour cet identifiant
      const identifier = finalConfig.keyGenerator!(context);

      // Vérifier rate limit
      const { allowed, remaining, degraded } = await CacheHelpers.checkRateLimit(
        identifier,
        finalConfig.maxRequests,
        finalConfig.windowSeconds
      );

      // Ajouter headers rate limit (standard HTTP) - Cast explicite pour typage Elysia
      const headers: Record<string, string> = {
        ...(context.set.headers as Record<string, string>),
        'X-RateLimit-Limit': finalConfig.maxRequests.toString(),
        'X-RateLimit-Remaining': remaining.toString(),
        'X-RateLimit-Reset': (Date.now() + finalConfig.windowSeconds * 1000).toString(),
      };

      // ✅ Ajouter header si mode dégradé
      if (degraded) {
        headers['X-RateLimit-Degraded'] = 'true';
      }

      (context.set.headers as Record<string, string>) = headers;

      // Si limite dépassée, bloquer la requête
      if (!allowed) {
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
        return {
          error: 'Too Many Requests',
          message: `Rate limit exceeded. Maximum ${finalConfig.maxRequests} requests per ${finalConfig.windowSeconds} seconds.`,
          retryAfter: finalConfig.windowSeconds,
        };
      }

      // Logger les requêtes en développement
      if (envUtils.isDevelopment && remaining < 10) {
        logger.debug('Rate limit check', {
          operation: 'rate-limit:check',
          identifier,
          remaining,
          metadata: { maxRequests: finalConfig.maxRequests },
        });
      }

      // Retour explicite pour tous les chemins de code
      return;

    } catch (error) {
      // En cas d'erreur Redis, permettre la requête (fail-open)
      logger.error('Rate limit middleware error', {
        operation: 'rate-limit:error',
        _error: error instanceof Error ? error.message : String(error),
        severity: 'medium' as const,
      });

      // Continuer sans bloquer (graceful degradation)
      return;
    }
  };
}

/**
 * Configurations prédéfinies pour différents endpoints
 */
export const RateLimitPresets = {
  // API générale
  api: {
    maxRequests: envUtils.isProduction ? 100 : 500,
    windowSeconds: 60,
  },

  // Auth endpoints (plus strict pour éviter brute-force)
  auth: {
    maxRequests: envUtils.isProduction ? 10 : 50,
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
    maxRequests: envUtils.isProduction ? 30 : 100,
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
    maxRequests: envUtils.isProduction ? 5 : 20,
    windowSeconds: 60,
  },

  // Public endpoints (plus permissif)
  public: {
    maxRequests: envUtils.isProduction ? 200 : 1000,
    windowSeconds: 60,
  },

  // Pronote connection (très strict - brute force protection)
  // 5 tentatives par 15 minutes en prod, clé basée sur userId
  pronote: {
    maxRequests: envUtils.isProduction ? 5 : 20,
    windowSeconds: 900, // 15 minutes
    keyGenerator: (context: Context) => {
      // Rate limit par user authentifié
      const ctx = context as Context & { student?: { id: string } };
      const userId = ctx.student?.id;
      return userId ? `pronote:user:${userId}` : defaultKeyGenerator(context);
    },
  },
} as const;
