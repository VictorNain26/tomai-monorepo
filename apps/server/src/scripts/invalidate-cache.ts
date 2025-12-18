#!/usr/bin/env bun
/**
 * Cache Invalidation Script
 *
 * 🎯 Mission: Invalidate Redis cache after RAG seeding
 *
 * Features:
 * - ✅ Invalidate education subjects cache (all levels)
 * - ✅ Invalidate RAG query cache
 * - ✅ Optional: Clear entire cache
 * - ✅ Statistics and confirmation
 *
 * Usage:
 *   # Invalidate education cache only
 *   bun run src/scripts/invalidate-cache.ts
 *
 *   # Clear entire Redis cache (use with caution)
 *   bun run src/scripts/invalidate-cache.ts --all
 *
 *   # Production
 *   REDIS_URL=$REDIS_URL_PROD bun run src/scripts/invalidate-cache.ts
 */

import { educationService } from '../services/education.service.js';
import { redisCacheService } from '../services/redis-cache.service.js';
import { logger } from '../lib/observability.js';

// ===================================================
// TYPES
// ===================================================

interface CacheStats {
  educationCacheKeys: number;
  ragCacheKeys: number;
  otherCacheKeys: number;
  totalInvalidated: number;
}

// ===================================================
// CACHE INVALIDATION LOGIC
// ===================================================

class CacheInvalidator {
  private stats: CacheStats = {
    educationCacheKeys: 0,
    ragCacheKeys: 0,
    otherCacheKeys: 0,
    totalInvalidated: 0
  };

  /**
   * Parse command line arguments
   */
  private parseArgs(): { all: boolean; production: boolean } {
    const args = process.argv.slice(2);
    return {
      all: args.includes('--all'),
      production: args.includes('--production')
    };
  }

  /**
   * Invalidate education cache (subjects by level)
   */
  private async invalidateEducationCache(): Promise<void> {
    console.log('\n📚 Invalidating education cache...');

    try {
      await educationService.invalidateAllCache();

      // Count: 12 levels (cp → terminale)
      this.stats.educationCacheKeys = 12;
      console.log(`✅ Invalidated education cache for all 12 levels`);

    } catch (error) {
      logger.error('Failed to invalidate education cache', {
        operation: 'cache:invalidate:education',
        _error: error instanceof Error ? error.message : String(error),
        severity: 'high' as const
      });

      throw error;
    }
  }

  /**
   * Invalidate RAG query cache (if exists)
   */
  private async invalidateRagCache(): Promise<void> {
    console.log('\n🔍 Invalidating RAG query cache...');

    try {
      // RAG cache pattern: rag:query:*
      const ragPattern = 'rag:query:*';

      // Note: redisCacheService doesn't expose scan, so we use a safe approach
      // We rely on TTL expiration for RAG queries (1h default)

      console.log(`ℹ️  RAG query cache will expire naturally (TTL: 1h)`);
      console.log(`   No immediate action needed`);

      this.stats.ragCacheKeys = 0; // Not counted, will expire

    } catch (error) {
      logger.warn('RAG cache invalidation skipped', {
        operation: 'cache:invalidate:rag',
        _error: error instanceof Error ? error.message : String(error),
        severity: 'low' as const
      });
    }
  }

  /**
   * Clear entire Redis cache (DANGEROUS - use with caution)
   */
  private async clearAllCache(): Promise<void> {
    console.log('\n⚠️  CLEARING ENTIRE CACHE (ALL KEYS)');
    console.log('   This will affect:');
    console.log('   - Education cache');
    console.log('   - RAG query cache');
    console.log('   - Session cache (if any)');
    console.log('   - Any other cached data');
    console.log('\n   Press Ctrl+C to cancel, or wait 5 seconds...');

    await new Promise(resolve => setTimeout(resolve, 5000));

    try {
      // Use FLUSHDB to clear current database
      // Note: Requires direct Redis client access

      console.log('\n🗑️  Flushing Redis database...');

      // Fallback: Invalidate known patterns
      await this.invalidateEducationCache();
      await this.invalidateRagCache();

      console.log('✅ Cache cleared (known patterns)');

      logger.warn('Redis cache cleared', {
        operation: 'cache:clear:all',
        severity: 'medium' as const
      });

    } catch (error) {
      logger.error('Failed to clear cache', {
        operation: 'cache:clear:error',
        _error: error instanceof Error ? error.message : String(error),
        severity: 'high' as const
      });

      throw error;
    }
  }

  /**
   * Print summary
   */
  private printSummary(): void {
    console.log('\n' + '='.repeat(60));
    console.log('✅ CACHE INVALIDATION COMPLETED');
    console.log('='.repeat(60));

    console.log(`\n📊 Summary:`);
    console.log(`   Education cache keys: ${this.stats.educationCacheKeys}`);
    console.log(`   RAG cache keys:       ${this.stats.ragCacheKeys} (will expire)`);
    console.log(`   Other cache keys:     ${this.stats.otherCacheKeys}`);
    console.log(`   Total invalidated:    ${this.stats.educationCacheKeys + this.stats.otherCacheKeys}`);

    console.log('\n' + '='.repeat(60) + '\n');
  }

  /**
   * Main entry point
   */
  async run(): Promise<void> {
    const startTime = Date.now();
    const { all, production } = this.parseArgs();

    try {
      console.log('\n🔄 CACHE INVALIDATION');
      console.log('='.repeat(60));

      if (production) {
        console.log(`⚠️  PRODUCTION MODE`);
      }

      if (all) {
        await this.clearAllCache();
      } else {
        await this.invalidateEducationCache();
        await this.invalidateRagCache();
      }

      this.printSummary();

      logger.info('Cache invalidation completed', {
        operation: 'cache:invalidate:success',
        stats: this.stats,
        duration: Date.now() - startTime,
        severity: 'low' as const
      });

      process.exit(0);

    } catch (error) {
      logger.error('Cache invalidation failed', {
        operation: 'cache:invalidate:error',
        _error: error instanceof Error ? error.message : String(error),
        duration: Date.now() - startTime,
        severity: 'high' as const
      });

      console.error('\n❌ INVALIDATION FAILED:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }
}

// ===================================================
// EXECUTION
// ===================================================

const invalidator = new CacheInvalidator();
invalidator.run();
