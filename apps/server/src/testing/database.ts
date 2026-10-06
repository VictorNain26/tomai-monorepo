/**
 * One database per test file, copied from a template that the preload migrates once per run
 * (`CREATE DATABASE … TEMPLATE`, https://www.postgresql.org/docs/current/manage-ag-templatedbs.html).
 * The server is the one DATABASE_URL names; its user must be allowed to create databases.
 */

import { afterAll } from 'bun:test';
import postgres from 'postgres';
import { createDb, type Database } from '../platform/db/client';

export const TEMPLATE = 'tom_test_template';

/** The URL of `database` on the server DATABASE_URL names. */
export function serverUrl(database: string): string {
  const base = Bun.env['DATABASE_URL'];
  if (!base) throw new Error('DATABASE_URL must name the Postgres server the tests run against');
  const url = new URL(base);
  url.pathname = `/${database}`;
  return url.href;
}

/** A connection to the server's maintenance database, for CREATE and DROP DATABASE. */
export function maintenance(): postgres.Sql {
  return postgres(serverUrl('postgres'), { max: 1, onnotice: () => undefined });
}

/** A fresh database for this file, migrated as the template is, dropped after its tests. */
export async function testDatabase(): Promise<Database & { url: string }> {
  const name = `tom_test_${crypto.randomUUID().replaceAll('-', '')}`;
  const admin = maintenance();
  await admin.unsafe(`CREATE DATABASE ${name} TEMPLATE ${TEMPLATE}`);
  const url = serverUrl(name);
  const database = createDb(url, { production: false });
  afterAll(async () => {
    await database.close();
    await admin.unsafe(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await admin.end();
  });
  return { ...database, url };
}

/** An empty database, without the template's migrations, dropped after the file's tests. */
export async function emptyDatabase(): Promise<{ url: string }> {
  const name = `tom_test_${crypto.randomUUID().replaceAll('-', '')}`;
  const admin = maintenance();
  await admin.unsafe(`CREATE DATABASE ${name}`);
  afterAll(async () => {
    await admin.unsafe(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await admin.end();
  });
  return { url: serverUrl(name) };
}
