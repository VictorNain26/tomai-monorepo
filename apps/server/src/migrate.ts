/**
 * `bun run db:migrate`: applies the migrations, before the server starts (the image's entrypoint
 * runs it). It needs the database only, not the server's secrets.
 */

import { loadDatabaseConfig } from './config';
import { runMigrations } from './platform/db/migrations';

const config = loadDatabaseConfig(Bun.env);
await runMigrations(config.databaseUrl, { production: config.production, ca: config.databaseCa });
console.log('Migrations applied');
