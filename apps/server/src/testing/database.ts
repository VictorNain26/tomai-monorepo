/**
 * One database per test file, copied from a template that the preload migrates once per run
 * (`CREATE DATABASE … TEMPLATE`, https://www.postgresql.org/docs/current/manage-ag-templatedbs.html).
 * The server is the one DATABASE_URL names; its user must be allowed to create databases. Every
 * name carries its creation time, so that the preload can drop what an interrupted run left.
 */

import { afterAll } from 'bun:test';
import postgres from 'postgres';
import { createDb, type Database } from '../platform/db/client';

export const PREFIX = 'tom_test_';

function databaseName(kind: string): string {
  return `${PREFIX}${kind}_${String(Date.now())}_${crypto.randomUUID().slice(0, 8)}`;
}

/** This run's template: two runs on the same server never share one. */
export const TEMPLATE = databaseName('tpl');

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

/** A database for this file; `drop` removes it once nothing holds a connection to it. */
async function scratchDatabase(template?: string): Promise<{ url: string; drop: () => Promise<void> }> {
  const name = databaseName('db');
  const admin = maintenance();
  await admin.unsafe(template ? `CREATE DATABASE ${name} TEMPLATE ${template}` : `CREATE DATABASE ${name}`);
  return {
    url: serverUrl(name),
    drop: async () => {
      await admin.unsafe(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
      await admin.end();
    },
  };
}

/** A fresh database for this file, migrated as the template is, dropped after its tests. */
export async function testDatabase(): Promise<Database & { url: string }> {
  const { url, drop } = await scratchDatabase(TEMPLATE);
  const database = createDb(url, { production: false });
  // One hook, in this order: dropped first, the database would leave the client waiting on killed
  // connections until its timeout, the hook's own.
  afterAll(async () => {
    await database.close();
    await drop();
  });
  return { ...database, url };
}

/** An empty database, without the template's migrations, dropped after the file's tests. */
export async function emptyDatabase(): Promise<{ url: string }> {
  const { url, drop } = await scratchDatabase();
  afterAll(drop);
  return { url };
}
