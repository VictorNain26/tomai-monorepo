/**
 * Database Connection - Clean Drizzle + Supabase Integration
 * Production-ready with auto-migration support
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { logger } from '../lib/observability';

// Environment-aware database configuration
const environment = Bun.env['NODE_ENV'] ?? 'development';
const connectionString = Bun.env['DATABASE_URL'];

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is required');
}

// Detect Supabase for optimized configuration
const isSupabase = connectionString.includes('supabase.com') ?? connectionString.includes('pooler.supabase.com');

// Production-optimized postgres client
export const sql = postgres(connectionString, {
  max: environment === 'production' ? 20 : 5,
  // Workaround for postgres@3.4.7 TimeoutNegativeWarning bug
  // Setting to 0 disables idle timeout to avoid negative calculation
  idle_timeout: 0,
  connect_timeout: isSupabase ? 20 : 10,
  prepare: !isSupabase, // Supabase pooler doesn't support prepared statements
  ssl: environment === 'production' || isSupabase ? 'require' : false,
  transform: {
    undefined: null, // Supabase compatibility
  },

  // Enhanced connection monitoring and _error handling
  // Production: Ignore NOTICE (clean logs)
  // Development: Log NOTICE for debugging
  onnotice: environment === 'production'
    ? () => {} // Supprime NOTICE en production (logs propres)
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
export const db = drizzle(sql, {
  schema,
  logger: environment === 'development',
});

export type Database = typeof db;

// Pool warning tracking
let poolWarnings = 0;

/**
 * Log pool warning
 * Appelé quand pool utilization > 80%
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

// Graceful shutdown
export const closeConnection = async (): Promise<void> => {
  try {
    logger.info('Closing database connection...', {
      operation: 'db:disconnect'
    });
    
    await sql.end();
    
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

// Initialize connection on import
logger.info('Database connection initialized', {
  operation: 'db:init',
  metadata: {
    environment,
    isSupabase,
    maxConnections: environment === 'production' ? 20 : 5
  }
});