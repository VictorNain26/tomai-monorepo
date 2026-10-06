/**
 * `bun run db:migrate`: applies the migrations, before the server starts (the image's entrypoint
 * runs it). It needs the database only, not the server's secrets.
 */

import { loadDatabaseConfig } from './config';
import { createDb } from './platform/db/client';
import { runMigrations } from './platform/db/migrations';

const config = loadDatabaseConfig(Bun.env);
const database = createDb(config.databaseUrl, { production: config.production, max: 1 });
try {
  await runMigrations(database.db);
  console.log('Migrations applied');
} finally {
  await database.close();
}
