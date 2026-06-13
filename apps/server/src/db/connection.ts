/**
 * Database Connection - Clean Drizzle + Supabase Integration
 * Production-ready with lazy initialization for testability
 */

import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres, { type Sql } from 'postgres';
import * as schema from './schema';
import { logger } from '../lib/observability';
import { resolveDatabaseUrl } from '../config/database-url.js';
import { env } from '../config/env.js';

// ============================================================================
// LAZY INITIALIZATION (2026 Best Practice for Testability)
// ============================================================================

let _sql: Sql | null = null;
let _db: PostgresJsDatabase<typeof schema> | null = null;
let _initialized = false;

/**
 * Get database connection string from environment
 * Delegates to resolveDatabaseUrl() for Docker-aware resolution
 */
function getConnectionString(): string {
  return resolveDatabaseUrl();
}

/**
 * Detect Supabase using proper URL hostname validation (CWE-20 compliant)
 */
function isSupabaseHost(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname.endsWith('.supabase.com') ||
           parsed.hostname.endsWith('.supabase.co') ||
           parsed.hostname === 'supabase.com';
  } catch {
    return false;
  }
}

/**
 * Initialize database connection lazily
 * Only creates connection when first accessed
 */
function initializeConnection(): void {
  if (_initialized) return;

  const environment = env.NODE_ENV;
  const connectionString = getConnectionString();
  const isSupabase = isSupabaseHost(connectionString);

  // Production-optimized postgres client
  _sql = postgres(connectionString, {
    max: environment === 'production' ? 20 : 5,
    idle_timeout: 0,
    connect_timeout: isSupabase ? 20 : 10,
    prepare: !isSupabase,
    ssl: environment === 'production' || isSupabase ? 'require' : false,
    transform: {
      undefined: null,
    },
    onnotice: environment === 'production'
      ? () => {}
      : (notice) => {
          if (notice.message) {
            logger.debug('PostgreSQL notice', {
              notice: notice.message,
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
      isSupabase,
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

let poolWarnings = 0;

/**
 * Log pool warning
 * Called when pool utilization > 80%
 */
export function logPoolWarning(context: string): void {
  poolWarnings++;
  logger.warn('PostgreSQL pool high utilization', {
    operation: 'db:pool:warning',
    context,
    warnings: poolWarnings,
    severity: 'medium' as const
  });
}

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
      _error: _error instanceof Error ? _error : new Error(_error as string),
      severity: 'low' as const
    });
  }
};

