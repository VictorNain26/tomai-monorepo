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
import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import { databaseSsl, resolveDatabaseUrl } from '../config/database-url.js';

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
  const environment = Bun.env.NODE_ENV ?? 'development';
  const migrationClient = postgres(databaseUrl, {
    max: 1,
    ...databaseSsl(environment),
  });
  const db = drizzle(migrationClient);

  try {
    // Several instances can boot in parallel, each running this script.
    // pg_advisory_lock is session-scoped: with `max: 1` this connection holds
    // exactly one session, so only one instance proceeds at a time — the
    // others block here until the lock holder finishes and releases it, then
    // find nothing left to do (no migration race).
    await db.execute(sql`SELECT pg_advisory_lock(hashtext('drizzle_migrate'))`);

    try {
      await migrate(db, { migrationsFolder: './drizzle' });
      console.log('Migrations completed successfully');
    } finally {
      await db.execute(sql`SELECT pg_advisory_unlock(hashtext('drizzle_migrate'))`);
    }
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
