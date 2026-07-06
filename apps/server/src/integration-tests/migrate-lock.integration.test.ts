// apps/server/src/integration-tests/migrate-lock.integration.test.ts
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

// DB reachability guard — mirrors seed-dev.integration.test.ts
async function checkDbReachable(): Promise<boolean> {
  try {
    const { db } = await import('../db/connection');
    await db.execute(sql`SELECT 1`);
    return true;
  } catch {
    return false;
  }
}

const dbReachable = await checkDbReachable();

const baseDatabaseUrl =
  Bun.env['DATABASE_URL_EXTERNAL'] ??
  Bun.env['DATABASE_URL'] ??
  'postgresql://tomai_dev:tomai_dev_password@localhost:5432/tomai_dev';
const testDbName = `tomai_migrate_lock_test_${Date.now()}`;

describe.skipIf(!dbReachable)('runMigrations — concurrent boot exclusivity', () => {
  const adminUrl = new URL(baseDatabaseUrl);
  const testUrl = new URL(baseDatabaseUrl);
  testUrl.pathname = `/${testDbName}`;

  beforeAll(async () => {
    const adminClient = postgres(adminUrl.toString(), { max: 1 });
    try {
      await adminClient.unsafe(`CREATE DATABASE ${testDbName}`);
    } finally {
      await adminClient.end();
    }
  });

  afterAll(async () => {
    const adminClient = postgres(adminUrl.toString(), { max: 1 });
    try {
      await adminClient.unsafe(
        `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${testDbName}' AND pid <> pg_backend_pid()`
      );
      await adminClient.unsafe(`DROP DATABASE IF EXISTS ${testDbName}`);
    } finally {
      await adminClient.end();
    }
  });

  it('two instances booting in parallel on a fresh database both resolve without error and apply migrations exactly once', async () => {
    // Several Koyeb instances can boot in parallel on a never-migrated database;
    // each calls runMigrations() independently. Only one should actually apply
    // the SQL, the other must wait on the advisory lock and then no-op instead
    // of racing on concurrent DDL (duplicate migration rows / conflicting CREATE).
    // resolveDatabaseUrl() prefers DATABASE_URL_EXTERNAL outside Docker, so
    // both must point at the fresh test database for this override to take.
    const previousUrl = Bun.env['DATABASE_URL'];
    const previousExternalUrl = Bun.env['DATABASE_URL_EXTERNAL'];
    Bun.env['DATABASE_URL'] = testUrl.toString();
    Bun.env['DATABASE_URL_EXTERNAL'] = testUrl.toString();

    try {
      const { runMigrations } = await import('../db/migrate');
      await Promise.all([runMigrations(), runMigrations()]);
    } finally {
      if (previousUrl === undefined) {
        delete Bun.env['DATABASE_URL'];
      } else {
        Bun.env['DATABASE_URL'] = previousUrl;
      }
      if (previousExternalUrl === undefined) {
        delete Bun.env['DATABASE_URL_EXTERNAL'];
      } else {
        Bun.env['DATABASE_URL_EXTERNAL'] = previousExternalUrl;
      }
    }

    const checkClient = postgres(testUrl.toString(), { max: 1 });
    const checkDb = drizzle(checkClient);
    try {
      const rows = await checkDb.execute<{ hash: string; count: string }>(
        sql`SELECT hash, COUNT(*)::text as count FROM drizzle.__drizzle_migrations GROUP BY hash HAVING COUNT(*) > 1`
      );
      expect(rows.length).toBe(0);

      const allRows = await checkDb.execute<{ count: string }>(
        sql`SELECT COUNT(*)::text as count FROM drizzle.__drizzle_migrations`
      );
      expect(Number(allRows[0]?.count)).toBeGreaterThan(0);
    } finally {
      await checkClient.end();
    }
  });
});
