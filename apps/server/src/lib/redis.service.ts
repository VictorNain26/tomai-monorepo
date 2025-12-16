/**
 * Redis Service - Production-Ready Cache Implementation
 * Service Redis optimisé pour TomAI avec support Upstash/Redis Cloud/Redis standard
 */

import { logger } from './observability';

// Types pour les clients Redis adaptés aux implémentations réelles
interface StandardRedisClient {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<string>;
  del: (key: string) => Promise<number>;
  exists: (key: string) => Promise<number>;
  incr: (key: string) => Promise<number>;
  incrby: (key: string, increment: number) => Promise<number>;
  setex: (key: string, seconds: number, value: string) => Promise<string>;
  hget: (key: string, field: string) => Promise<string | null>;
  hset: (key: string, field: string, value: string) => Promise<number>;
  expire: (key: string, seconds: number) => Promise<number>;
  flushall: () => Promise<string>;
  ping: () => Promise<string>;
  disconnect: () => Promise<void>;
}

interface UpstashRedisClient {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<string | null>;
  del: (key: string) => Promise<number>;
  exists: (key: string) => Promise<number>;
  incr: (key: string) => Promise<number>;
  incrby: (key: string, increment: number) => Promise<number>;
  setex: (key: string, seconds: number, value: string) => Promise<string | null>;
  hget: (key: string, field: string) => Promise<string | null>;
  hset: <TData>(key: string, kv: Record<string, TData>) => Promise<number>;
  expire: (key: string, seconds: number) => Promise<number>;
  flushall: () => Promise<string>;
  ping: () => Promise<string>;
  // Upstash n'a pas disconnect
}

type RedisClient = StandardRedisClient | UpstashRedisClient;

// Detect Upstash using proper URL hostname validation (CWE-20 compliant)
function isUpstashHost(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname.endsWith('.upstash.io') ||
           parsed.hostname === 'upstash.io';
  } catch {
    return false;
  }
}

// Interface pour les opérations Redis
export interface RedisService {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  increment(key: string, value?: number): Promise<number>;
  setex(key: string, ttlSeconds: number, value: unknown): Promise<void>;
  hget(key: string, field: string): Promise<string | null>;
  hset(key: string, field: string, value: string): Promise<void>;
  expire(key: string, ttlSeconds: number): Promise<void>;
  flushAll(): Promise<void>;
  ping(): Promise<string>;
  disconnect(): Promise<void>;
}

// Implémentation Redis native pour production
class ProductionRedisService implements RedisService {
  private client: RedisClient | null = null;
  private isConnected = false;
  private clientType: 'upstash' | 'standard' | null = null;

  constructor(private redisUrl: string) {}

  private async ensureConnection(): Promise<void> {
    if (this.isConnected && this.client) return;

    try {
      // Priorité 1: Configuration Upstash avec fromEnv() (pattern officiel)
      const upstashRestUrl = process.env.UPSTASH_REDIS_REST_URL;
      const upstashRestToken = process.env.UPSTASH_REDIS_REST_TOKEN;

      if (upstashRestUrl && upstashRestToken) {
        // Configuration Upstash REST (optimal pour serverless) - Pattern officiel
        const { Redis } = await import('@upstash/redis');

        // Utiliser fromEnv() si les variables sont correctement nommées
        this.client = Redis.fromEnv();
        this.clientType = 'upstash';

        logger.info('Redis configured for Upstash REST API (fromEnv)', {
          operation: 'redis:init',
          provider: 'upstash-rest',
          telemetry: process.env.UPSTASH_DISABLE_TELEMETRY ? 'disabled' : 'enabled'
        });
      } else if (this.redisUrl) {
        // Priorité 2: URL Redis standard ou Upstash via URL
        const isUpstash = isUpstashHost(this.redisUrl);

        if (isUpstash) {
          // Configuration Upstash via URL (moins recommandé que REST)
          logger.warn('Using Upstash URL pattern - REST API (UPSTASH_REDIS_REST_URL/TOKEN) is preferred', {
            operation: 'redis:init:upstash-url'
          });

          const { Redis } = await import('@upstash/redis');
          this.client = new Redis({
            url: this.redisUrl,
            token: process.env.UPSTASH_REDIS_REST_TOKEN,
          });
          this.clientType = 'upstash';
        } else {
          // Pour Redis standard (ioredis)
          const IORedis = (await import('ioredis')).default;
          this.client = new IORedis(this.redisUrl, {
            maxRetriesPerRequest: 3,
            lazyConnect: true,
            connectTimeout: 10000,
          });
          this.clientType = 'standard';
        }
      } else {
        throw new Error('No Redis configuration found (UPSTASH_REDIS_REST_URL/TOKEN or REDIS_URL required)');
      }

      // ✅ FIX: Upstash est HTTP-based (connectionless) - pas besoin de ping
      // Pattern officiel Upstash: init directe sans test de connexion
      // Suppression de await this.ping() qui causait récursion infinie:
      //   ensureConnection() → ping() → ensureConnection() → LOOP
      this.isConnected = true;

      logger.info('Redis service initialized successfully', {
        operation: 'redis:init',
        provider: this.clientType,
        url: this.redisUrl ? this.redisUrl.replace(/:\/\/.*@/, '://***@') : 'upstash-rest'
      });

    } catch (_error) {
      logger.error('Redis connection failed', {
        operation: 'redis:connect:failed',
        _error: _error instanceof Error ? _error.message : String(_error),
        severity: 'high' as const
      });
      throw _error;
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      await this.ensureConnection();
      
      if (!this.client) {
        throw new Error('Redis client not initialized');
      }

      const result = await this.client.get(key);
      
      if (result === null || result === undefined) {
        return null;
      }

      // Essayer de parser le JSON, sinon retourner la chaîne brute
      try {
        return JSON.parse(result) as T;
      } catch {
        return result as T;
      }
    } catch (_error) {
      logger.error('Redis GET operation failed', {
        operation: 'redis:get',
        key,
        _error: _error instanceof Error ? _error.message : String(_error),
        severity: 'medium' as const
      });
      return null;
    }
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    try {
      await this.ensureConnection();

      if (!this.client) {
        throw new Error('Redis client not initialized');
      }

      const serializedValue = typeof value === 'string' ? value : JSON.stringify(value);

      if (ttlSeconds) {
        await this.client.setex(key, ttlSeconds, serializedValue);
      } else {
        await this.client.set(key, serializedValue);
      }
    } catch (_error) {
      const errorMsg = _error instanceof Error ? _error.message : String(_error);

      // Détection erreur NOPERM Upstash
      if (errorMsg.includes('NOPERM') || errorMsg.includes('no permission')) {
        logger.error('🚨 UPSTASH REDIS NOPERM ERROR DETECTED', {
          operation: 'redis:set:noperm',
          key,
          ttl: ttlSeconds,
          _error: errorMsg,
          severity: 'critical' as const,
          solution: 'You are using a READ-ONLY token. Solution: 1. Go to https://console.upstash.com/redis, 2. Copy the STANDARD token (not Read Only), 3. Update UPSTASH_REDIS_REST_TOKEN in .env, 4. Restart: docker compose restart backend. Run diagnostic: bun run redis:diagnose'
        });

        console.error('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('🚨 UPSTASH REDIS NOPERM ERROR');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.error('');
        console.error('❌ Problem: You are using a READ-ONLY token for write operations');
        console.error('');
        console.error('✅ Solution:');
        console.error('   1. Go to: https://console.upstash.com/redis');
        console.error('   2. Select your Redis database');
        console.error('   3. Copy the STANDARD token (green) - NOT the Read Only token (red)');
        console.error('   4. Update your .env file:');
        console.error('      UPSTASH_REDIS_REST_TOKEN=<your-standard-token>');
        console.error('   5. Restart: docker compose restart backend');
        console.error('');
        console.error('🔍 Run diagnostic: bun run redis:diagnose');
        console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
      } else {
        logger.error('Redis SET operation failed', {
          operation: 'redis:set',
          key,
          ttl: ttlSeconds,
          _error: errorMsg,
          severity: 'medium' as const
        });
      }

      throw _error;
    }
  }

  async del(key: string): Promise<void> {
    try {
      await this.ensureConnection();
      
      if (!this.client) {
        throw new Error('Redis client not initialized');
      }

      await this.client.del(key);
    } catch (_error) {
      logger.error('Redis DEL operation failed', {
        operation: 'redis:del',
        key,
        _error: _error instanceof Error ? _error.message : String(_error),
        severity: 'medium' as const
      });
      throw _error;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.ensureConnection();
      
      if (!this.client) {
        throw new Error('Redis client not initialized');
      }

      const result = await this.client.exists(key);
      return result === 1;
    } catch (_error) {
      logger.error('Redis EXISTS operation failed', {
        operation: 'redis:exists',
        key,
        _error: _error instanceof Error ? _error.message : String(_error),
        severity: 'medium' as const
      });
      return false;
    }
  }

  async increment(key: string, value: number = 1): Promise<number> {
    try {
      await this.ensureConnection();

      if (!this.client) {
        throw new Error('Redis client not initialized');
      }

      if (value === 1) {
        return await this.client.incr(key);
      } else {
        return await this.client.incrby(key, value);
      }
    } catch (_error) {
      const errorMsg = _error instanceof Error ? _error.message : String(_error);

      // Détection erreur NOPERM Upstash (utilisé par rate limiting)
      if (errorMsg.includes('NOPERM') || errorMsg.includes('no permission')) {
        logger.error('🚨 UPSTASH REDIS NOPERM ERROR DETECTED (Rate Limiting)', {
          operation: 'redis:incr:noperm',
          key,
          value,
          _error: errorMsg,
          severity: 'critical' as const,
          solution: 'READ-ONLY token detected. Run: bun run redis:diagnose'
        });

        console.error('\n🚨 UPSTASH REDIS NOPERM ERROR (Rate Limiting affected)');
        console.error('🔍 Run diagnostic: bun run redis:diagnose\n');
      } else {
        logger.error('Redis INCREMENT operation failed', {
          operation: 'redis:incr',
          key,
          value,
          _error: errorMsg,
          severity: 'medium' as const
        });
      }

      throw _error;
    }
  }

  async setex(key: string, ttlSeconds: number, value: unknown): Promise<void> {
    await this.set(key, value, ttlSeconds);
  }

  async hget(key: string, field: string): Promise<string | null> {
    try {
      await this.ensureConnection();
      
      if (!this.client) {
        throw new Error('Redis client not initialized');
      }

      return await this.client.hget(key, field);
    } catch (_error) {
      logger.error('Redis HGET operation failed', {
        operation: 'redis:hget',
        key,
        field,
        _error: _error instanceof Error ? _error.message : String(_error),
        severity: 'medium' as const
      });
      return null;
    }
  }

  async hset(key: string, field: string, value: string): Promise<void> {
    try {
      await this.ensureConnection();
      
      if (!this.client) {
        throw new Error('Redis client not initialized');
      }

      if (this.clientType === 'upstash') {
        await (this.client as UpstashRedisClient).hset(key, { [field]: value });
      } else {
        await (this.client as StandardRedisClient).hset(key, field, value);
      }
    } catch (_error) {
      logger.error('Redis HSET operation failed', {
        operation: 'redis:hset',
        key,
        field,
        _error: _error instanceof Error ? _error.message : String(_error),
        severity: 'medium' as const
      });
      throw _error;
    }
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    try {
      await this.ensureConnection();
      
      if (!this.client) {
        throw new Error('Redis client not initialized');
      }

      await this.client.expire(key, ttlSeconds);
    } catch (_error) {
      logger.error('Redis EXPIRE operation failed', {
        operation: 'redis:expire',
        key,
        ttl: ttlSeconds,
        _error: _error instanceof Error ? _error.message : String(_error),
        severity: 'medium' as const
      });
      throw _error;
    }
  }

  async flushAll(): Promise<void> {
    try {
      await this.ensureConnection();
      
      if (!this.client) {
        throw new Error('Redis client not initialized');
      }

      await this.client.flushall();
      
      logger.info('Redis cache cleared', {
        operation: 'redis:flush'
      });
    } catch (_error) {
      logger.error('Redis FLUSHALL operation failed', {
        operation: 'redis:flush',
        _error: _error instanceof Error ? _error.message : String(_error),
        severity: 'medium' as const
      });
      throw _error;
    }
  }

  async ping(): Promise<string> {
    try {
      await this.ensureConnection();
      
      if (!this.client) {
        throw new Error('Redis client not initialized');
      }

      const result = await this.client.ping();
      return String(result);
    } catch (_error) {
      logger.error('Redis PING failed', {
        operation: 'redis:ping',
        _error: _error instanceof Error ? _error.message : String(_error),
        severity: 'medium' as const
      });
      throw _error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client && this.isConnected) {
      try {
        if (this.clientType === 'standard') {
          await (this.client as StandardRedisClient).disconnect();
        }
        // Upstash n'a pas de méthode disconnect
        
        this.isConnected = false;
        
        logger.info('Redis disconnected', {
          operation: 'redis:disconnect'
        });
      } catch (_error) {
        logger.error('Redis disconnect failed', {
          operation: 'redis:disconnect',
          _error: _error instanceof Error ? _error.message : String(_error),
          severity: 'low' as const
        });
      }
    }
  }
}

// Implémentation fallback en mémoire pour développement
class InMemoryRedisService implements RedisService {
  private store = new Map<string, { value: unknown; expiry?: number }>();
  private hashStore = new Map<string, Map<string, string>>();

  constructor() {
    logger.info('Using in-memory Redis fallback for development', {
      operation: 'redis:fallback:init'
    });
  }

  private isExpired(entry: { expiry?: number }): boolean {
    return entry.expiry !== undefined && Date.now() > entry.expiry;
  }

  private cleanup(): void {
    for (const [key, entry] of this.store.entries()) {
      if (this.isExpired(entry)) {
        this.store.delete(key);
      }
    }
  }

  async get<T>(key: string): Promise<T | null> {
    this.cleanup();
    const entry = this.store.get(key);
    
    if (!entry || this.isExpired(entry)) {
      return null;
    }

    return entry.value as T;
  }

  async set(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
    const expiry = ttlSeconds ? Date.now() + (ttlSeconds * 1000) : undefined;
    this.store.set(key, { value, expiry });
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
    this.hashStore.delete(key);
  }

  async exists(key: string): Promise<boolean> {
    this.cleanup();
    const entry = this.store.get(key);
    return !!(entry && !this.isExpired(entry));
  }

  async increment(key: string, value: number = 1): Promise<number> {
    const current = await this.get<number>(key) ?? 0;
    const newValue = current + value;
    await this.set(key, newValue);
    return newValue;
  }

  async setex(key: string, ttlSeconds: number, value: unknown): Promise<void> {
    await this.set(key, value, ttlSeconds);
  }

  async hget(key: string, field: string): Promise<string | null> {
    const hash = this.hashStore.get(key);
    return hash?.get(field) ?? null;
  }

  async hset(key: string, field: string, value: string): Promise<void> {
    if (!this.hashStore.has(key)) {
      this.hashStore.set(key, new Map());
    }
    this.hashStore.get(key)!.set(field, value);
  }

  async expire(key: string, ttlSeconds: number): Promise<void> {
    const entry = this.store.get(key);
    if (entry) {
      entry.expiry = Date.now() + (ttlSeconds * 1000);
    }
  }

  async flushAll(): Promise<void> {
    this.store.clear();
    this.hashStore.clear();
  }

  async ping(): Promise<string> {
    return 'PONG';
  }

  async disconnect(): Promise<void> {
    this.store.clear();
    this.hashStore.clear();
  }
}

// Factory pour créer le service Redis approprié
function createRedisService(): RedisService {
  const redisUrl = process.env.REDIS_URL ?? '';
  const upstashRestUrl = process.env.UPSTASH_REDIS_REST_URL;
  const upstashRestToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const hasUpstashConfig = !!(upstashRestUrl && upstashRestToken);

  // En production : utiliser UNIQUEMENT Upstash configuré dans Koyeb
  if (process.env.NODE_ENV === 'production') {
    if (!hasUpstashConfig && !redisUrl) {
      throw new Error('Production requires Redis configuration: Set UPSTASH_REDIS_REST_URL/TOKEN or REDIS_URL in Koyeb environment variables');
    }

    return new ProductionRedisService(redisUrl);
  }

  // En développement : fallback seulement si aucune config
  if (!redisUrl && !hasUpstashConfig) {
    logger.warn('No Redis configuration found, using in-memory fallback for development', {
      operation: 'redis:service:create',
      environment: 'development',
      fallback: true
    });
    return new InMemoryRedisService();
  }

  return new ProductionRedisService(redisUrl);
}

// Export du service Redis singleton
export const redisService = createRedisService();

// Export redis client pour compatibilité avec le code existant
export const redis = {
  async get(key: string): Promise<string | null> {
    return await redisService.get<string>(key);
  },

  async set(key: string, value: string): Promise<string | null> {
    await redisService.set(key, value);
    return 'OK';
  },

  async setEx(key: string, seconds: number, value: string): Promise<string | null> {
    await redisService.setex(key, seconds, value);
    return 'OK';
  },

  async del(key: string): Promise<number> {
    await redisService.del(key);
    return 1;
  },

  async exists(key: string): Promise<number> {
    const exists = await redisService.exists(key);
    return exists ? 1 : 0;
  },

  async ping(): Promise<string> {
    return await redisService.ping();
  },

  async connect(): Promise<void> {
    // redisService gère la connexion automatiquement
    logger.info('Redis compatibility layer initialized', {
      operation: 'redis:compat:init'
    });
  }
};

// Utilitaires pour le cache
export const CacheKeys = {
  // Rate limiting
  rateLimit: (identifier: string) => `rate_limit:${identifier}`,
} as const;

// Helpers pour opérations courantes
export const CacheHelpers = {
  // Rate limiting helper
  async checkRateLimit(identifier: string, maxRequests: number, windowSeconds: number): Promise<{ allowed: boolean; remaining: number; degraded?: boolean }> {
    const key = CacheKeys.rateLimit(identifier);

    try {
      const current = await redisService.increment(key);

      if (current === 1) {
        // Premier appel, définir l'expiration
        await redisService.expire(key, windowSeconds);
      }

      const remaining = Math.max(0, maxRequests - current);
      const allowed = current <= maxRequests;

      return { allowed, remaining };
    } catch (_error) {
      logger.error('Rate limit check failed - ENTERING DEGRADED MODE', {
        operation: 'cache:rate-limit',
        identifier,
        _error: _error instanceof Error ? _error.message : String(_error),
        severity: 'critical' as const  // ✅ Critical au lieu de medium
      });

      // Graceful fallback AVEC visibilité
      return {
        allowed: true,
        remaining: maxRequests - 1,
        degraded: true  // ✅ Flag visible
      };
    }
  }
} as const;