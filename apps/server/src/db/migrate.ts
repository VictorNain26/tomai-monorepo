/**
 * Drizzle Migration Runner
 *
 * Single migration entry point — called by docker-entrypoint.sh.
 * NOT called from app startup (no double execution).
 *
 * Usage:
 * - Development: bun run db:push (direct schema sync)
 * - Production/Staging: docker-entrypoint.sh runs this before server start
 */

import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

/**
 * Detect Supabase host to enable SSL regardless of NODE_ENV
 * (matches connection.ts logic)
 */
function isSupabaseHost(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname.endsWith('.supabase.com') ||
           parsed.hostname.endsWith('.supabase.co');
  } catch {
    return false;
  }
}

export async function runMigrations(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    console.error('DATABASE_URL is required for migrations');
    process.exit(1);
  }

  console.log('Running database migrations...');

  const environment = process.env.NODE_ENV ?? 'development';
  const needsSsl = environment === 'production' || isSupabaseHost(databaseUrl);

  const migrationClient = postgres(databaseUrl, {
    max: 1,
    ssl: needsSsl ? 'require' : false,
  });
  const db = drizzle(migrationClient);

  try {
    // Ensure required Postgres extensions exist before running migrations
    // that reference them (pgvector for session_episodes.summary_embedding).
    // Idempotent: IF NOT EXISTS means this is safe on every boot.
    await migrationClient.unsafe('CREATE EXTENSION IF NOT EXISTS vector;');
    console.log('Postgres extensions verified (vector)');

    await migrate(db, { migrationsFolder: './drizzle' });
    console.log('Migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await migrationClient.end();
  }
}

// Run directly if executed as script
if (import.meta.main) {
  void runMigrations();
}
