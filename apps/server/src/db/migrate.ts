/**
 * Drizzle Migration Runner (standalone, pre-boot)
 *
 * Single migration entry point — called by docker-entrypoint.sh.
 * NOT called from app startup (no double execution).
 *
 * Usage:
 * - Development: bun run db:push (direct schema sync)
 * - Production/Staging: docker-entrypoint.sh runs this before server start
 *
 * Note: Does NOT import the full env singleton because migrate.ts runs BEFORE
 * env validation (Bun.env may be missing prod secrets like BETTER_AUTH_SECRET).
 * Uses resolveDatabaseUrl() directly instead.
 */

import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { resolveDatabaseUrl } from '../config/database-url.js';

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
  let databaseUrl: string;
  try {
    databaseUrl = resolveDatabaseUrl();
  } catch (error) {
    console.error('DATABASE_URL resolution failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  console.log('Running database migrations...');

  // Use Bun.env — `bun build --target bun` replaces `process.env.NODE_ENV`
  // at build time, which would freeze this to the build-stage value.
  const environment = Bun.env['NODE_ENV'] ?? 'development';
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
