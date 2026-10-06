/**
 * Migrations: applied by `bun run db:migrate` before the server starts, and checked by the server
 * at boot against the journal of the build it runs.
 */

import { sql } from 'drizzle-orm';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import type { Db } from './client';

/** Relative to apps/server, the directory every script and the image run the server from. */
export const MIGRATIONS_FOLDER = 'drizzle';

/**
 * Several instances can boot at once, each running the migrations. The advisory lock is held by
 * the session, so `db` must come from a client with a single connection: only one instance
 * migrates, the others wait and then find nothing left to apply.
 */
export async function runMigrations(db: Db, migrationsFolder = MIGRATIONS_FOLDER): Promise<void> {
  await db.execute(sql`SELECT pg_advisory_lock(hashtext('drizzle_migrate'))`);
  try {
    await migrate(db, { migrationsFolder });
  } finally {
    await db.execute(sql`SELECT pg_advisory_unlock(hashtext('drizzle_migrate'))`);
  }
}

/** The hashes the journal lists that the database has not applied, in order. */
export async function pendingMigrations(db: Db, migrationsFolder = MIGRATIONS_FOLDER): Promise<string[]> {
  const expected = readMigrationFiles({ migrationsFolder }).map((migration) => migration.hash);
  const [table] = await db.execute<{ name: string | null }>(sql`SELECT to_regclass('drizzle.__drizzle_migrations')::text AS name`);
  const applied = table?.name ? await db.execute<{ hash: string }>(sql`SELECT hash FROM drizzle.__drizzle_migrations`) : [];
  const done = new Set(Array.from(applied, (row) => row.hash));
  return expected.filter((hash) => !done.has(hash));
}
