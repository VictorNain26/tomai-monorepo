/**
 * Database Connection - Drizzle over postgres.js
 * Production-ready with lazy initialization for testability
 */

import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres, { type Sql } from 'postgres';
import * as schema from './schema';
import { logger } from '../platform/observability/logger';
import { databaseSsl, resolveDatabaseUrl } from '../platform/config/database-url.js';
import { env } from '../platform/config/env.js';

// ============================================================================
// LAZY INITIALIZATION (2026 Best Practice for Testability)
// ============================================================================

let _sql: Sql | null = null;
let _db: PostgresJsDatabase<typeof schema> | null = null;
let _initialized = false;

/**
 * Initialize database connection lazily
 * Only creates connection when first accessed
 */
function initializeConnection(): void {
  if (_initialized) return;

  const environment = env.NODE_ENV;
  const connectionString = resolveDatabaseUrl();

  // Production-optimized postgres client
  _sql = postgres(connectionString, {
    max: environment === 'production' ? 20 : 5,
    idle_timeout: 0,
    connect_timeout: 10,
    ...databaseSsl(environment),
    transform: {
      undefined: null,
    },
    onnotice: environment === 'production'
      ? () => undefined
      : (notice) => {
          if (notice['message']) {
            logger.debug('PostgreSQL notice', {
              notice: notice['message'],
              operation: 'db:notice'
            });
          }
        },
    onclose: (connectionId) => {
      logger.warn('Database connection closed', {
        operation: 'db:connection:close',
        connectionId: String(connectionId),
        metadata: { timestamp: new Date().toISOString() }
      });
    }
  });

  // Create drizzle instance with full schema
  _db = drizzle(_sql, {
    schema,
    logger: environment === 'development',
  });

  _initialized = true;

  logger.info('Database connection initialized', {
    operation: 'db:init',
    metadata: {
      environment,
      maxConnections: environment === 'production' ? 20 : 5
    }
  });
}

// ============================================================================
// EXPORTS (Lazy Getters)
// ============================================================================

export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_target, prop) {
    initializeConnection();
    return (_db as unknown as Record<string | symbol, unknown>)[prop];
  }
});

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Graceful shutdown
 */
export const closeConnection = async (): Promise<void> => {
  if (!_initialized || !_sql) {
    return;
  }

  try {
    logger.info('Closing database connection...', {
      operation: 'db:disconnect'
    });

    await _sql.end();
    _sql = null;
    _db = null;
    _initialized = false;

    logger.info('Database connection closed', {
      operation: 'db:disconnect:success'
    });
  } catch (_error) {
    logger.error('Error closing database connection', {
      operation: 'db:disconnect:_error',
      err: _error,
      severity: 'low' as const
    });
  }
};

