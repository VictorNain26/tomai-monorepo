import { describe, expect, it } from 'bun:test';
import { sql } from 'drizzle-orm';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { emptyDatabase, testDatabase } from '../../testing/database';
import { createDb } from './client';
import { MIGRATIONS_FOLDER, pendingMigrations, runMigrations } from './migrations';

const journal = readMigrationFiles({ migrationsFolder: MIGRATIONS_FOLDER });

describe('migrations', () => {
  it('reports every migration of the journal as pending on a database never migrated', async () => {
    const { url } = await emptyDatabase();
    const database = createDb(url, { production: false });
    try {
      expect(await pendingMigrations(database.db)).toEqual(journal.map((migration) => migration.folderMillis));
    } finally {
      await database.close();
    }
  });

  it('reports none once the database is migrated', async () => {
    const { db } = await testDatabase();
    expect(await pendingMigrations(db)).toEqual([]);
  });

  it('agrees with migrate(): a migration whose file changed after it was applied is not pending', async () => {
    const { db } = await testDatabase();
    await db.execute(sql`UPDATE drizzle.__drizzle_migrations SET hash = 'edited since'`);
    expect(await pendingMigrations(db)).toEqual([]);
  });

  it('lets several instances migrate at once, one after the other, and releases the lock', async () => {
    const { url } = await emptyDatabase();
    await Promise.all([1, 2, 3].map(() => runMigrations(url, { production: false })));

    const database = createDb(url, { production: false, max: 1 });
    try {
      expect(await pendingMigrations(database.db)).toEqual([]);
      const [held] = await database.db.execute<{ count: string }>(sql`SELECT count(*)::text AS count FROM pg_locks
        WHERE locktype = 'advisory' AND database = (SELECT oid FROM pg_database WHERE datname = current_database())`);
      expect(held?.count).toBe('0');
    } finally {
      await database.close();
    }
  });
});
