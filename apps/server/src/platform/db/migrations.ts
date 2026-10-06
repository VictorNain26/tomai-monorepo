/**
 * Migrations: applied by `bun run db:migrate` before the server starts, and checked by the server
 * at boot against the journal of the build it runs.
 */

import { sql } from 'drizzle-orm';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { createDb, type Db } from './client';

/** Relative to apps/server, the directory every script and the image run the server from. */
export const MIGRATIONS_FOLDER = 'drizzle';

/**
 * Several instances can boot at once, each running the migrations. The advisory lock belongs to
 * the session, so the migrations run on a client of their own with a single connection: one
 * instance migrates, the others wait and then find nothing left to apply.
 */
export async function runMigrations(url: string, { production }: { production: boolean }, migrationsFolder = MIGRATIONS_FOLDER): Promise<void> {
  const { db, close } = createDb(url, { production, max: 1 });
  try {
    await db.execute(sql`SELECT pg_advisory_lock(hashtext('drizzle_migrate'))`);
    const migrated = await migrate(db, { migrationsFolder }).then(
      () => null,
      (error: unknown) => ({ error }),
    );
    const [released] = await db.execute<{ unlocked: boolean }>(sql`SELECT pg_advisory_unlock(hashtext('drizzle_migrate')) AS unlocked`);
    if (migrated) throw migrated.error;
    if (!released?.unlocked) throw new Error('The migration lock was not held by this session');
  } finally {
    await close();
  }
}

/**
 * The migrations of the journal that `migrate()` would still apply. drizzle-orm 0.45 applies
 * those whose `when` is later than the last `created_at` recorded (pg-core/dialect.js), not those
 * whose hash is unknown: the check follows the same rule.
 */
export async function pendingMigrations(db: Db, migrationsFolder = MIGRATIONS_FOLDER): Promise<number[]> {
  const journal = readMigrationFiles({ migrationsFolder }).map((migration) => migration.folderMillis);
  const [table] = await db.execute<{ name: string | null }>(sql`SELECT to_regclass('drizzle.__drizzle_migrations')::text AS name`);
  if (!table?.name) return journal;
  const [last] = await db.execute<{ createdAt: string | null }>(sql`SELECT max(created_at)::text AS "createdAt" FROM drizzle.__drizzle_migrations`);
  const appliedUntil = last?.createdAt === null || last?.createdAt === undefined ? -Infinity : Number(last.createdAt);
  return journal.filter((when) => when > appliedUntil);
}
