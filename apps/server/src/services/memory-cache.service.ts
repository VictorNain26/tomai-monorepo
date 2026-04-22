/**
 * In-Memory Cache Service - Remplacement Redis 2026
 *
 * Cache LRU simple avec TTL pour mono-instance.
 * Avantages: Zero latence réseau, zero coût, zero dépendance externe.
 */

import { logger } from '../lib/observability.js';

// =============================================
// Types
// =============================================

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

interface CacheMetrics {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  size: number;
}

// =============================================
// Configuration
// =============================================

const CONFIG = {
  MAX_ENTRIES: 10000, // Max entries before LRU eviction
  DEFAULT_TTL: 3600, // 1 hour default
  CLEANUP_INTERVAL: 60000, // Cleanup expired entries every minute
};

// =============================================
// In-Memory Cache Service
// =============================================

class MemoryCacheService {
  private cache = new Map<string, CacheEntry<unknown>>();
  private metrics: CacheMetrics = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    size: 0,
  };
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.startCleanupJob();
    logger.info('In-memory cache initialized', { operation: 'cache:init', maxEntries: CONFIG.MAX_ENTRIES });
  }

  /**
   * Get value from cache
   */
  get<T>(namespace: string, key: string): T | null {
    const cacheKey = `${namespace}${key}`;
    const entry = this.cache.get(cacheKey) as CacheEntry<T> | undefined;

    if (!entry) {
      this.metrics.misses++;
      return null;
    }

    // Check expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(cacheKey);
      this.metrics.misses++;
      return null;
    }

    // Restore true LRU semantics: Map preserves insertion order, so deleting
    // and re-inserting the entry on each read moves it to the end. Without
    // this, evictOldest() would drop hot entries ahead of cold ones.
    this.cache.delete(cacheKey);
    this.cache.set(cacheKey, entry);

    this.metrics.hits++;
    return entry.data;
  }

  /**
   * Set value in cache with TTL (seconds)
   */
  set<T>(namespace: string, key: string, data: T, ttlSeconds: number = CONFIG.DEFAULT_TTL): boolean {
    const cacheKey = `${namespace}${key}`;

    // LRU eviction if at capacity
    if (this.cache.size >= CONFIG.MAX_ENTRIES && !this.cache.has(cacheKey)) {
      this.evictOldest();
    }

    this.cache.set(cacheKey, {
      data,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });

    this.metrics.sets++;
    this.metrics.size = this.cache.size;
    return true;
  }

  /**
   * Delete value from cache
   */
  delete(namespace: string, key: string): boolean {
    const cacheKey = `${namespace}${key}`;
    const deleted = this.cache.delete(cacheKey);

    if (deleted) {
      this.metrics.deletes++;
      this.metrics.size = this.cache.size;
    }

    return deleted;
  }

  /**
   * Delete all keys matching pattern (simple prefix match)
   */
  invalidateByPattern(pattern: string): number {
    const prefix = pattern.replace('*', '');
    let deleted = 0;

    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        deleted++;
      }
    }

    this.metrics.deletes += deleted;
    this.metrics.size = this.cache.size;

    logger.debug('Cache pattern invalidation', { operation: 'cache:invalidate', pattern, deleted });
    return deleted;
  }

  /**
   * Check if key exists (not expired)
   */
  has(namespace: string, key: string): boolean {
    const cacheKey = `${namespace}${key}`;
    const entry = this.cache.get(cacheKey);

    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(cacheKey);
      return false;
    }

    return true;
  }

  /**
   * Get cache metrics
   */
  getMetrics(): CacheMetrics & { hitRate: number } {
    const total = this.metrics.hits + this.metrics.misses;
    return {
      ...this.metrics,
      hitRate: total > 0 ? this.metrics.hits / total : 0,
    };
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    this.metrics.size = 0;
    logger.info('Cache cleared', { operation: 'cache:clear' });
  }

  /**
   * Health check - always healthy for in-memory
   */
  healthCheck(): { status: 'healthy'; client: 'memory'; latency: number } {
    return { status: 'healthy', client: 'memory', latency: 0 };
  }

  // =============================================
  // Private Methods
  // =============================================

  private evictOldest(): void {
    // Simple LRU: delete first (oldest) entry
    const firstKey = this.cache.keys().next().value;
    if (firstKey) {
      this.cache.delete(firstKey);
      logger.debug('LRU eviction', { operation: 'cache:evict', key: firstKey });
    }
  }

  private startCleanupJob(): void {
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      let cleaned = 0;

      for (const [key, entry] of this.cache.entries()) {
        if (now > entry.expiresAt) {
          this.cache.delete(key);
          cleaned++;
        }
      }

      if (cleaned > 0) {
        this.metrics.size = this.cache.size;
        logger.debug('Cache cleanup', { operation: 'cache:cleanup', cleaned, remaining: this.cache.size });
      }
    }, CONFIG.CLEANUP_INTERVAL);
  }

  /**
   * Cleanup on shutdown
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.cache.clear();
    logger.info('In-memory cache shutdown', { operation: 'cache:shutdown' });
  }
}

// =============================================
// Singleton Export
// =============================================

export const memoryCacheService = new MemoryCacheService();

// Alias pour compatibilité avec l'ancien redisCacheService
export const cacheService = memoryCacheService;
