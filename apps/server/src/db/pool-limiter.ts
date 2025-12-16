/**
 * Database Connection Pool Limiter
 * Phase 3.1: Prevent pool exhaustion with p-limit concurrency control
 */

import pLimit from 'p-limit';
import { logger } from '../lib/observability.js';
import { logPoolWarning } from './connection.js';

/**
 * PostgreSQL Pool Configuration
 */
const MAX_POOL_SIZE = process.env.NODE_ENV === 'production' ? 20 : 5;

/**
 * Concurrency Limit: 75% of max pool size
 *
 * Rationale:
 * - Prevents pool exhaustion from concurrent Promise.all() operations
 * - Leaves 25% headroom for single queries and system operations
 * - Reduces connection timeout errors under load
 *
 * Production: 20 * 0.75 = 15 concurrent queries
 * Development: 5 * 0.75 = 3 concurrent queries (floor)
 */
const CONCURRENCY_LIMIT = Math.floor(MAX_POOL_SIZE * 0.75);

/**
 * Database Concurrency Limiter
 *
 * Enforces maximum concurrent database operations to prevent pool exhaustion.
 * Uses p-limit to queue operations when limit is reached.
 */
export const dbConcurrencyLimit = pLimit(CONCURRENCY_LIMIT);

/**
 * Wrapper for database operations with pool limiting
 *
 * Automatically tracks active/pending connections and logs warnings
 * when pool utilization exceeds 80%.
 *
 * @param operation - Database operation to execute
 * @param label - Operation label for logging/debugging
 * @returns Result of the database operation
 *
 * @example
 * ```typescript
 * // Concurrent queries with pool limiting
 * const [children, sessions, progress] = await Promise.all([
 *   withPoolLimit(
 *     () => db.select().from(users).where(eq(users.parentId, userId)),
 *     'fetch-children'
 *   ),
 *   withPoolLimit(
 *     () => db.select().from(studySessions).where(eq(studySessions.userId, userId)),
 *     'fetch-sessions'
 *   ),
 *   withPoolLimit(
 *     () => db.select().from(progress).where(eq(progress.userId, userId)),
 *     'fetch-progress'
 *   )
 * ]);
 * ```
 */
export async function withPoolLimit<T>(
  operation: () => Promise<T>,
  label?: string
): Promise<T> {
  return await dbConcurrencyLimit(async () => {
    const active = dbConcurrencyLimit.activeCount;
    const pending = dbConcurrencyLimit.pendingCount;
    const utilization = ((active + pending) / CONCURRENCY_LIMIT) * 100;

    // Log pool acquisition
    logger.debug('Acquiring pool connection', {
      operation: 'db:pool:acquire',
      label,
      active,
      pending,
      limit: CONCURRENCY_LIMIT,
      utilizationPercent: utilization.toFixed(1)
    });

    // Warning si utilization > 80%
    if (utilization > 80) {
      logPoolWarning(`High pool utilization: ${utilization.toFixed(1)}% (${label ?? 'unknown'})`);
    }

    try {
      const startTime = Date.now();
      const result = await operation();
      const duration = Date.now() - startTime;

      logger.debug('Pool connection released', {
        operation: 'db:pool:release',
        label,
        durationMs: duration,
        active: dbConcurrencyLimit.activeCount,
        pending: dbConcurrencyLimit.pendingCount
      });

      return result;
    } catch (error) {
      logger.error('Pool operation failed', {
        operation: 'db:pool:error',
        label,
        _error: error instanceof Error ? error : new Error(String(error)),
        active: dbConcurrencyLimit.activeCount,
        pending: dbConcurrencyLimit.pendingCount,
        severity: 'high' as const
      });
      throw error;
    }
  });
}
