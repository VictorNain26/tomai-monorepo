/** Before the test files: the template database, recreated and migrated from this run's journal. */

import { createDb } from '../platform/db/client';
import { runMigrations } from '../platform/db/migrations';
import { maintenance, serverUrl, TEMPLATE } from './database';

const admin = maintenance();
await admin.unsafe(`DROP DATABASE IF EXISTS ${TEMPLATE} WITH (FORCE)`);
await admin.unsafe(`CREATE DATABASE ${TEMPLATE}`);
await admin.end();

// A template must have no other connection while it is copied: this one closes here.
const template = createDb(serverUrl(TEMPLATE), { production: false, max: 1 });
await runMigrations(template.db);
await template.close();
