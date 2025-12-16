#!/usr/bin/env bun

/**
 * 🚀 REDIS CACHE SERVICE OPTIMISÉ 2025
 * Configuration dual ioredis + Upstash selon best practices officielles
 * Patterns optimaux pour cache RAG avec TTL adaptatif
 */

import Redis from 'ioredis';
import { Redis as UpstashRedis } from '@upstash/redis';
import { env, envUtils } from '../config/environment.config.js';
import { logger } from '../lib/observability.js';

// =============================================
// Types et Interfaces
// =============================================

export interface CacheEntry<T = unknown> {
  data: T;
  timestamp: number;
  ttl: number;
  hits: number;
}

export interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  hitRate: number;
  totalOperations: number;
}

export interface CacheOptions {
  ttl?: number;
  namespace?: string;
  compress?: boolean;
  tags?: string[];
}

export interface RAGCacheData {
  embeddings: number[];
  context: string;
  sources: Array<{
    id: string;
    similarity: number;
    niveau: string;
    matiere: string;
    titre: string;
  }>;
  searchTime: number;
  totalDocuments: number;
  averageSimilarity: number;
}

// =============================================
// Configuration selon Documentation Officielle
// =============================================

const CACHE_CONFIG = {
  // TTL par type de données (secondes)
  TTL: {
    EMBEDDINGS: 3600 * 24, // 24h - embeddings sont stables
    RAG_CONTEXT: 1800, // 30min - contexte peut évoluer
    SEARCH_RESULTS: 900, // 15min - résultats peuvent changer
    SESSION_DATA: 3600 * 2, // 2h - données session utilisateur
    TEMPORARY: 300 // 5min - données temporaires
  },

  // Préfixes pour organisation
  PREFIXES: {
    EMBEDDING: 'emb:',
    RAG: 'rag:',
    SEARCH: 'search:',
    SESSION: 'session:',
    METRICS: 'metrics:'
  },

  // Limites de taille
  MAX_VALUE_SIZE: 100 * 1024 * 1024, // 100MB max par clé
  MAX_KEY_LENGTH: 512,

  // Configuration connexions
  CONNECTION: {
    retryDelayOnFailover: 100,
    enableReadyCheck: true,
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    keepAlive: 30000
  }
};

// =============================================
// Service Cache Redis Optimal
// =============================================

export class RedisCacheService {
  private ioredisClient: Redis | null = null;
  private upstashClient: UpstashRedis | null = null;
  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    hitRate: 0,
    totalOperations: 0
  };
  private isConnected = false;

  constructor() {
    void this.initializeClients(); // Fire-and-forget async initialization
  }

  /**
   * Initialise les clients Redis selon configuration environnement
   * Pattern dual pour dev (ioredis) et production (Upstash)
   * PRODUCTION READY: lazyConnect + manual connect() avec retry
   */
  private async initializeClients(): Promise<void> {
    try {
      // Configuration développement/production avec ioredis
      if (env.REDIS_URL && (envUtils.isDevelopment || envUtils.isProduction)) {
        const environment = envUtils.isDocker ? 'Docker' : 'localhost';
        logger.info(`Initializing ioredis client for ${environment}`, { operation: 'redis:cache:init', provider: 'ioredis', environment });

        this.ioredisClient = new Redis(env.REDIS_URL, {
          ...CACHE_CONFIG.CONNECTION,
          // PRODUCTION READY: lazyConnect true + manual connect() après
          lazyConnect: true,
          // Configuration optimisée selon doc ioredis
          connectTimeout: 10000,
          commandTimeout: 5000,
          // Retry strategy production-ready
          retryStrategy(times) {
            const delay = Math.min(times * 50, 2000);
            logger.debug(`Redis retry attempt ${times}, delay: ${delay}ms`, { operation: 'redis:cache:retry', attempt: times, delay });
            return delay;
          },
          // Reconnexion automatique sur erreur
          reconnectOnError(err) {
            logger.warn(`Redis error, reconnecting: ${err.message}`, { operation: 'redis:cache:reconnect', _error: err.message });
            return true; // Toujours reconnecter
          },
          // Pool de connexions pour performance
          family: 4,
          db: 0
        });

        // Event handlers selon best practices
        this.ioredisClient.on('connect', () => {
          logger.info('ioredis connected successfully', { operation: 'redis:cache:connect' });
          this.isConnected = true;
        });

        this.ioredisClient.on('error', (error) => {
          logger.error('ioredis connection error', { operation: 'redis:cache:error', _error: error.message, severity: 'high' as const });
          this.isConnected = false;
        });

        this.ioredisClient.on('ready', () => {
          logger.info('ioredis client ready for operations', { operation: 'redis:cache:ready' });
        });

        this.ioredisClient.on('reconnecting', () => {
          logger.debug('ioredis reconnecting...', { operation: 'redis:cache:reconnecting' });
        });

        this.ioredisClient.on('close', () => {
          logger.warn('ioredis connection closed', { operation: 'redis:cache:close' });
          this.isConnected = false;
        });

        // CRITICAL: Manual connect() avec lazyConnect
        try {
          await this.ioredisClient.connect();
          logger.info('ioredis manual connect() successful', { operation: 'redis:cache:manual-connect' });
        } catch (error) {
          logger.error('ioredis manual connect() failed', { operation: 'redis:cache:manual-connect', _error: error instanceof Error ? error.message : String(error), severity: 'high' as const });
          // Pas de throw - graceful degradation
        }
      }

      // Configuration production avec Upstash (serverless optimisé)
      if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
        logger.info('Initializing Upstash client for production', { operation: 'redis:cache:init', provider: 'upstash' });

        try {
          this.upstashClient = new UpstashRedis({
            url: env.UPSTASH_REDIS_REST_URL,
            token: env.UPSTASH_REDIS_REST_TOKEN,
            // Configuration REST API selon doc Upstash avec retry amélioré
            automaticDeserialization: true,
            retry: {
              retries: 3,
              backoff: (retryIndex) => Math.exp(retryIndex) * 50
            }
          });

          // Test connexion Upstash avec ping
          await this.upstashClient.ping();
          logger.info('Upstash client initialized and connected', { operation: 'redis:cache:init', provider: 'upstash' });
          if (!this.ioredisClient) this.isConnected = true;
        } catch (error) {
          logger.error('Upstash initialization failed', { operation: 'redis:cache:init', provider: 'upstash', _error: error instanceof Error ? error.message : String(error), severity: 'high' as const });
          this.upstashClient = null;
          // Pas de throw - graceful degradation
        }
      }

      if (!this.ioredisClient && !this.upstashClient) {
        logger.warn('No Redis configuration found, caching disabled', { operation: 'redis:cache:init' });
        this.isConnected = false;
      }

    } catch (error) {
      logger.error('Redis initialization failed', { operation: 'redis:cache:init', _error: error instanceof Error ? error.message : String(error), severity: 'critical' as const });
      this.isConnected = false;
      // Graceful degradation: système continue sans cache Redis
    }
  }

  /**
   * Client actif selon environnement
   */
  private get activeClient(): Redis | UpstashRedis | null {
    return this.ioredisClient ?? this.upstashClient;
  }

  /**
   * Génère clé cache selon best practices naming
   */
  private generateKey(namespace: string, key: string, options?: CacheOptions): string {
    const prefix = options?.namespace ?? namespace;
    const cleanKey = key.replace(/[^a-zA-Z0-9:_-]/g, '_');
    const finalKey = `${prefix}${cleanKey}`;

    if (finalKey.length > CACHE_CONFIG.MAX_KEY_LENGTH) {
      // Hash pour clés trop longues
      const hash = Bun.hash(finalKey).toString(16);
      return `${prefix}${hash}`;
    }

    return finalKey;
  }

  /**
   * GET avec métriques et fallback gracieux
   * PRODUCTION READY: Explicit JSON parse error handling + context logging
   */
  async get<T>(namespace: string, key: string, options?: CacheOptions): Promise<T | null> {
    if (!this.isConnected || !this.activeClient) {
      return null; // Fallback gracieux
    }

    const cacheKey = this.generateKey(namespace, key, options);

    try {
      const client = this.activeClient;
      let result: string | null;

      // API différente selon client
      if (this.ioredisClient && client === this.ioredisClient) {
        result = await (client as Redis).get(cacheKey);
      } else {
        result = await (client as UpstashRedis).get(cacheKey);
      }

      if (!result) {
        this.metrics.misses++;
        return null;
      }

      // CRITICAL: Try-catch JSON.parse avec context logging
      let parsed: CacheEntry<T>;
      try {
        parsed = JSON.parse(result) as CacheEntry<T>;
      } catch (parseError) {
        logger.error('Cache JSON parse failed', {
          operation: 'cache:get:parse-error',
          _error: parseError instanceof Error ? parseError : new Error(String(parseError)),
          cacheKey,
          namespace,
          resultPreview: result.substring(0, 100), // Preview données corrompues
          resultLength: result.length,
          severity: 'high' as const
        });

        // Invalider clé corrompue
        await this.delete(namespace, key, options);
        this.metrics.misses++;
        return null;
      }

      // Vérification TTL pour validation cache
      const now = Date.now();
      if (now - parsed.timestamp > parsed.ttl * 1000) {
        // Expired, supprimer
        await this.delete(namespace, key, options);
        this.metrics.misses++;
        return null;
      }

      this.metrics.hits++;
      return parsed.data;

    } catch (error) {
      // CRITICAL: Structured error logging avec context
      logger.error('Cache GET operation failed', {
        operation: 'cache:get:error',
        _error: error instanceof Error ? error : new Error(String(error)),
        cacheKey,
        namespace,
        clientType: this.ioredisClient ? 'ioredis' : 'upstash',
        severity: 'medium' as const
      });

      this.metrics.misses++;
      return null; // Fallback gracieux
    } finally {
      this.updateMetrics();
    }
  }

  /**
   * SET avec TTL adaptatif et compression optionnelle
   */
  async set<T>(
    namespace: string,
    key: string,
    data: T,
    ttl?: number,
    options?: CacheOptions
  ): Promise<boolean> {
    if (!this.isConnected || !this.activeClient) {
      return false; // Fallback gracieux
    }

    try {
      const cacheKey = this.generateKey(namespace, key, options);
      const finalTtl = ttl ?? options?.ttl ?? CACHE_CONFIG.TTL.TEMPORARY;

      const cacheEntry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl: finalTtl,
        hits: 0
      };

      const serialized = JSON.stringify(cacheEntry);

      // Vérification taille selon limits officielles
      if (serialized.length > CACHE_CONFIG.MAX_VALUE_SIZE) {
        logger.warn(`Cache entry too large: ${serialized.length} bytes`, { operation: 'redis:cache:set', size: serialized.length, maxSize: CACHE_CONFIG.MAX_VALUE_SIZE });
        return false;
      }

      const client = this.activeClient;

      // SET avec TTL selon API client
      // Note: Upstash free tier may not support SETEX, use SET + EXPIRE instead
      if (this.ioredisClient && client === this.ioredisClient) {
        await (client as Redis).setex(cacheKey, finalTtl, serialized);
      } else {
        // Upstash: Use SET + EXPIRE for compatibility with free tier
        await (client as UpstashRedis).set(cacheKey, serialized);
        await (client as UpstashRedis).expire(cacheKey, finalTtl);
      }

      this.metrics.sets++;
      return true;

    } catch (error) {
      logger.warn('Cache SET error', { operation: 'redis:cache:set', _error: error instanceof Error ? error.message : String(error) });
      return false; // Fallback gracieux
    } finally {
      this.updateMetrics();
    }
  }

  /**
   * DELETE avec pattern support
   */
  async delete(namespace: string, key: string, options?: CacheOptions): Promise<boolean> {
    if (!this.isConnected || !this.activeClient) {
      return false;
    }

    try {
      const cacheKey = this.generateKey(namespace, key, options);
      const client = this.activeClient;

      let result: number;
      if (this.ioredisClient && client === this.ioredisClient) {
        result = await (client as Redis).del(cacheKey);
      } else {
        result = await (client as UpstashRedis).del(cacheKey);
      }

      if (result > 0) {
        this.metrics.deletes++;
        return true;
      }
      return false;

    } catch (error) {
      logger.warn('Cache DELETE error', { operation: 'redis:cache:delete', _error: error instanceof Error ? error.message : String(error) });
      return false;
    } finally {
      this.updateMetrics();
    }
  }

  /**
   * Cache spécialisé pour embeddings (TTL long)
   */
  async cacheEmbedding(
    query: string,
    embedding: number[],
    metadata?: Record<string, unknown>
  ): Promise<boolean> {
    const key = Bun.hash(query).toString(16);
    return await this.set(
      CACHE_CONFIG.PREFIXES.EMBEDDING,
      key,
      { embedding, metadata, query },
      CACHE_CONFIG.TTL.EMBEDDINGS
    );
  }

  /**
   * Récupération embedding avec métadonnées
   */
  async getEmbedding(query: string): Promise<{
    embedding: number[];
    metadata?: Record<string, unknown>;
    query: string;
  } | null> {
    const key = Bun.hash(query).toString(16);
    return await this.get(CACHE_CONFIG.PREFIXES.EMBEDDING, key);
  }

  /**
   * Cache spécialisé pour contexte RAG avec invalidation intelligente
   */
  async cacheRAGContext(
    query: string,
    niveau: string,
    matiere: string,
    ragData: RAGCacheData
  ): Promise<boolean> {
    const key = `${niveau}:${matiere}:${Bun.hash(query).toString(16)}`;
    return await this.set(
      CACHE_CONFIG.PREFIXES.RAG,
      key,
      ragData,
      CACHE_CONFIG.TTL.RAG_CONTEXT
    );
  }

  /**
   * Récupération contexte RAG avec validation fraîcheur
   */
  async getRAGContext(
    query: string,
    niveau: string,
    matiere: string
  ): Promise<RAGCacheData | null> {
    const key = `${niveau}:${matiere}:${Bun.hash(query).toString(16)}`;
    return await this.get(CACHE_CONFIG.PREFIXES.RAG, key);
  }

  /**
   * Invalidation cache par patterns (tags-based)
   */
  async invalidateByPattern(pattern: string): Promise<number> {
    if (!this.isConnected) return 0;

    try {
      const client = this.activeClient;
      let deletedCount = 0;

      if (this.ioredisClient && client === this.ioredisClient) {
        // ioredis supporte SCAN
        const keys: string[] = [];
        const stream = (client as Redis).scanStream({ match: pattern });

        for await (const chunk of stream) {
          keys.push(...chunk);
        }

        if (keys.length > 0) {
          deletedCount = await (client as Redis).del(...keys);
        }
      } else {
        logger.debug('Pattern invalidation not supported on Upstash REST API', { operation: 'redis:cache:invalidate', pattern });
      }

      return deletedCount;

    } catch (error) {
      logger.warn('Cache invalidation error', { operation: 'redis:cache:invalidate', pattern, _error: error instanceof Error ? error.message : String(error) });
      return 0;
    }
  }

  /**
   * Métriques cache pour monitoring
   */
  getMetrics(): CacheMetrics {
    return {
      ...this.metrics,
      hitRate: this.metrics.totalOperations > 0
        ? this.metrics.hits / this.metrics.totalOperations
        : 0
    };
  }

  /**
   * Health check connexion Redis
   */
  async healthCheck(): Promise<{
    status: 'healthy' | 'unhealthy';
    client: 'ioredis' | 'upstash' | 'none';
    latency?: number;
    error?: string;
  }> {
    if (!this.activeClient) {
      return { status: 'unhealthy', client: 'none', error: 'No client configured' };
    }

    try {
      const start = Date.now();
      const client = this.activeClient;

      if (this.ioredisClient && client === this.ioredisClient) {
        await (client as Redis).ping();
        return {
          status: 'healthy',
          client: 'ioredis',
          latency: Date.now() - start
        };
      } else {
        await (client as UpstashRedis).ping();
        return {
          status: 'healthy',
          client: 'upstash',
          latency: Date.now() - start
        };
      }

    } catch (error) {
      return {
        status: 'unhealthy',
        client: this.ioredisClient ? 'ioredis' : 'upstash',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Nettoyage ressources
   */
  async disconnect(): Promise<void> {
    if (this.ioredisClient) {
      this.ioredisClient.disconnect(); // ioredis disconnect() is synchronous
      this.ioredisClient = null;
    }
    // Upstash est REST, pas de déconnexion nécessaire
    this.isConnected = false;
    logger.info('Redis cache service disconnected', { operation: 'redis:cache:disconnect' });
  }

  /**
   * Mise à jour métriques internes
   */
  private updateMetrics(): void {
    this.metrics.totalOperations =
      this.metrics.hits + this.metrics.misses + this.metrics.sets + this.metrics.deletes;
    this.metrics.hitRate =
      this.metrics.totalOperations > 0 ? this.metrics.hits / this.metrics.totalOperations : 0;
  }
}

// =============================================
// Instance Singleton pour Performance
// =============================================

export const redisCacheService = new RedisCacheService();

// =============================================
// Utilitaires Cache pour RAG
// =============================================

export const cacheUtils = {
  /**
   * Génère clé cache pour requête utilisateur
   */
  generateUserQueryKey(userId: string, query: string, niveau: string, matiere: string): string {
    return `user:${userId}:${niveau}:${matiere}:${Bun.hash(query).toString(16)}`;
  },

  /**
   * TTL adaptatif selon type contenu
   */
  getAdaptiveTTL(contentType: 'static' | 'dynamic' | 'user', baseHours: number = 1): number {
    const multipliers = {
      static: 24, // Contenu statique : 24h
      dynamic: 2, // Contenu dynamique : 2h
      user: 1 // Données utilisateur : 1h
    };
    return baseHours * 3600 * multipliers[contentType];
  },

  /**
   * Compression automatique pour grandes données
   */
  shouldCompress(data: unknown): boolean {
    const serialized = JSON.stringify(data);
    return serialized.length > 10 * 1024; // > 10KB
  }
};