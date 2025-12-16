/**
 * Rate Limiter natif Elysia - Protection DDoS professionnelle
 * Implémentation clean avec Redis et stratégies adaptatives
 */

import type { Context } from 'elysia';
import { CacheHelpers } from './redis.service';
import { logger } from './observability';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  message?: string;
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  totalHits: number;
}

// Configuration par endpoint
export const rateLimitConfigs = {
  // API Standard
  standard: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
    message: 'Too many requests from this IP, please try again later'
  },
  
  // Chat IA - Plus restrictif
  aiChat: {
    windowMs: 1 * 60 * 1000, // 1 minute
    maxRequests: 10,
    message: 'AI chat rate limit exceeded. Please wait before sending another message'
  },
  
  // Authentification - Très restrictif
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    message: 'Too many authentication attempts. Please try again later'
  },
  
  // Streaming - Modéré
  streaming: {
    windowMs: 1 * 60 * 1000, // 1 minute
    maxRequests: 5,
    message: 'Streaming rate limit exceeded. Please wait before starting another stream'
  },
  
  // Registration - Très restrictif
  registration: {
    windowMs: 60 * 60 * 1000, // 1 heure
    maxRequests: 3,
    message: 'Too many registration attempts. Please try again later'
  }
} as const;

/**
 * Store in-memory simple pour le rate limiting
 * En production, utiliser Redis pour une vraie scalabilité
 */
class MemoryRateLimitStore {
  private store = new Map<string, { count: number; resetTime: number }>();
  
  async get(key: string): Promise<{ count: number; resetTime: number } | null> {
    const now = Date.now();
    const record = this.store.get(key);
    
    if (!record) return null;
    
    // Nettoyer les entrées expirées
    if (record.resetTime <= now) {
      this.store.delete(key);
      return null;
    }
    
    return record;
  }
  
  async set(key: string, count: number, windowMs: number): Promise<void> {
    const resetTime = Date.now() + windowMs;
    this.store.set(key, { count, resetTime });
  }
  
  async increment(key: string, windowMs: number): Promise<{ count: number; resetTime: number }> {
    const now = Date.now();
    const existing = await this.get(key);
    
    if (!existing) {
      const resetTime = now + windowMs;
      const record = { count: 1, resetTime };
      this.store.set(key, record);
      return record;
    }
    
    existing.count++;
    this.store.set(key, existing);
    return existing;
  }
  
  // Nettoyage périodique
  cleanup(): void {
    const now = Date.now();
    for (const [key, record] of this.store.entries()) {
      if (record.resetTime <= now) {
        this.store.delete(key);
      }
    }
  }
}

const store = new MemoryRateLimitStore();

// Nettoyage toutes les 5 minutes
setInterval(() => store.cleanup(), 5 * 60 * 1000);

/**
 * Génère la clé unique pour le rate limiting
 */
function generateKey(request: Request, identifier?: string): string {
  // Utiliser identifier personnalisé (userId) ou IP
  if (identifier) {
    return `ratelimit:user:${identifier}`;
  }
  
  // Extraire l'IP depuis les headers (Cloudflare, nginx, etc.)
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIP = request.headers.get('x-real-ip');
  const remoteAddr = request.headers.get('x-remote-addr');
  
  const ip = forwardedFor?.split(',')[0]?.trim() ?? 
            realIP ?? 
            remoteAddr ?? 
            'unknown';
            
  return `ratelimit:ip:${ip}`;
}

/**
 * Fonction principale de rate limiting avec Redis
 */
export async function checkRateLimit(
  request: Request,
  config: RateLimitConfig,
  identifier?: string
): Promise<RateLimitResult> {
  const key = generateKey(request, identifier);
  const windowSeconds = Math.ceil(config.windowMs / 1000);
  
  try {
    // Utiliser Redis pour le rate limiting en production
    const result = await CacheHelpers.checkRateLimit(key, config.maxRequests, windowSeconds);
    
    const resetTime = Date.now() + config.windowMs;
    const totalHits = config.maxRequests - result.remaining + (result.allowed ? 0 : 1);
    
    return {
      allowed: result.allowed,
      remaining: result.remaining,
      resetTime,
      totalHits
    };
  } catch (_error) {
    // Fallback vers le store en mémoire si Redis échoue
    logger.warn('Redis rate limit failed, using memory fallback', {
      operation: 'ratelimit:fallback',
      key,
      _error: _error instanceof Error ? _error.message : String(_error)
    });
    
    const record = await store.increment(key, config.windowMs);
    const allowed = record.count <= config.maxRequests;
    const remaining = Math.max(0, config.maxRequests - record.count);
    
    return {
      allowed,
      remaining,
      resetTime: record.resetTime,
      totalHits: record.count
    };
  }
}

/**
 * Plugin Elysia pour rate limiting
 */
export function createRateLimitResponse(
  result: RateLimitResult,
  config: RateLimitConfig,
  set: Context['set']
) {
  // Headers standard rate limit
  if (config.standardHeaders !== false) {
    set.headers['X-RateLimit-Limit'] = config.maxRequests.toString();
    set.headers['X-RateLimit-Remaining'] = result.remaining.toString();
    set.headers['X-RateLimit-Reset'] = Math.ceil(result.resetTime / 1000).toString();
  }
  
  // Headers legacy pour compatibilité
  if (config.legacyHeaders !== false) {
    set.headers['X-Rate-Limit-Limit'] = config.maxRequests.toString();
    set.headers['X-Rate-Limit-Remaining'] = result.remaining.toString();
    set.headers['X-Rate-Limit-Reset'] = Math.ceil(result.resetTime / 1000).toString();
  }
  
  if (!result.allowed) {
    set.status = 429;
    set.headers['Retry-After'] = Math.ceil((result.resetTime - Date.now()) / 1000).toString();
    
    return {
      _error: 'Rate Limit Exceeded',
      message: config.message ?? 'Too many requests',
      retryAfter: result.resetTime,
      limit: config.maxRequests,
      remaining: result.remaining,
      resetTime: result.resetTime
    };
  }
  
  return null; // Allowed, continue
}

/**
 * Types pour TypeScript strict
 */
export type RateLimitConfigKey = keyof typeof rateLimitConfigs;
export type { RateLimitConfig, RateLimitResult };