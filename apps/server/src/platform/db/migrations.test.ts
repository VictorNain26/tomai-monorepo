import { describe, expect, it } from 'bun:test';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { emptyDatabase, testDatabase } from '../../testing/database';
import { createDb } from './client';
import { MIGRATIONS_FOLDER, pendingMigrations, runMigrations } from './migrations';

const journal = readMigrationFiles({ migrationsFolder: MIGRATIONS_FOLDER }).map((migration) => migration.hash);

describe('migrations', () => {
  it('reports every migration of the journal as pending on a database never migrated', async () => {
    const { url } = await emptyDatabase();
    const database = createDb(url, { production: false });
    try {
      expect(await pendingMigrations(database.db)).toEqual(journal);
    } finally {
      await database.close();
    }
  });

  it('reports none once the database is migrated', async () => {
    const { db } = await testDatabase();
    expect(await pendingMigrations(db)).toEqual([]);
  });

  it('lets several instances migrate at once, one after the other', async () => {
    const { url } = await emptyDatabase();
    const instances = [1, 2, 3].map(() => createDb(url, { production: false, max: 1 }));
    try {
      await Promise.all(instances.map((instance) => runMigrations(instance.db)));
      const [first] = instances;
      expect(first && (await pendingMigrations(first.db))).toEqual([]);
    } finally {
      await Promise.all(instances.map((instance) => instance.close()));
    }
  });
});
