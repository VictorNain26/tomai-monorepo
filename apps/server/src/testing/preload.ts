/**
 * Once per run, before the test files: this run's template, migrated from the journal; and the
 * databases an interrupted run left more than an hour ago, dropped. The template goes at the end.
 */

import { afterAll } from 'bun:test';
import { runMigrations } from '../platform/db/migrations';
import { maintenance, PREFIX, serverUrl, TEMPLATE } from './database';

const STALE_MS = 60 * 60 * 1000;

const admin = maintenance();
const leftovers = await admin<{ datname: string }[]>`SELECT datname FROM pg_database WHERE starts_with(datname, ${PREFIX})`;
for (const { datname } of leftovers) {
  const createdAt = Number(/_(\d+)_[0-9a-f]{8}$/.exec(datname)?.[1]);
  if (Date.now() - createdAt > STALE_MS) await admin.unsafe(`DROP DATABASE IF EXISTS ${datname} WITH (FORCE)`);
}
await admin.unsafe(`CREATE DATABASE ${TEMPLATE}`);
await admin.end();

// A template must have no other connection while it is copied: runMigrations closes its own.
await runMigrations(serverUrl(TEMPLATE), { production: false });

afterAll(async () => {
  const cleanup = maintenance();
  await cleanup.unsafe(`DROP DATABASE IF EXISTS ${TEMPLATE} WITH (FORCE)`);
  await cleanup.end();
});
