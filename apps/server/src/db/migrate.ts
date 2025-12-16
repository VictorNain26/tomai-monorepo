/**
 * Runtime Database Migrations
 *
 * Follows Drizzle ORM best practices for running migrations at server startup.
 * Uses migrationsSchema: 'public' for Supabase compatibility (no CREATE SCHEMA permission).
 *
 * @see https://orm.drizzle.team/docs/drizzle-kit-migrate
 * @see https://orm.drizzle.team/docs/tutorials/drizzle-with-supabase
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { logger } from '../lib/observability';

/**
 * Run database migrations at application startup.
 *
 * Best practice: Use a dedicated connection with max: 1 for migrations
 * to avoid conflicts and ensure sequential execution.
 */
export async function runMigrations(): Promise<void> {
  const connectionString = Bun.env['DATABASE_URL'];

  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required for migrations');
  }

  // Detect Supabase for SSL configuration
  const isSupabase = connectionString.includes('supabase.com') || connectionString.includes('pooler.supabase.com');

  logger.info('Starting database migrations...', {
    operation: 'db:migrate:start',
    isSupabase
  });

  // Create a dedicated migration client with max: 1 connection
  // This ensures migrations run sequentially and don't interfere with the main pool
  const migrationClient = postgres(connectionString, {
    max: 1,
    ssl: isSupabase ? 'require' : false,
    connect_timeout: 30,
    idle_timeout: 5,
    // Supabase pooler doesn't support prepared statements
    prepare: !isSupabase,
  });

  try {
    // Test database connectivity before running migrations
    await migrationClient`SELECT NOW()`;
    logger.info('Database connection verified', { operation: 'db:migrate:connected' });

    // Create Drizzle instance for migrations
    const db = drizzle(migrationClient);

    // Run migrations using existing 'drizzle' schema (already has migration history)
    // Note: New Supabase projects should use 'public', but this DB has existing migrations in 'drizzle'
    await migrate(db, {
      migrationsFolder: './drizzle',
      migrationsTable: '__drizzle_migrations',
      migrationsSchema: 'drizzle',
    });

    logger.info('Database migrations completed successfully', {
      operation: 'db:migrate:success'
    });

  } catch (error) {
    logger.error('Database migration failed', {
      operation: 'db:migrate:error',
      _error: error instanceof Error ? error.message : String(error),
      severity: 'critical' as const
    });
    throw error;
  } finally {
    // Always close the migration client
    await migrationClient.end();
    logger.info('Migration client closed', { operation: 'db:migrate:cleanup' });
  }
}
