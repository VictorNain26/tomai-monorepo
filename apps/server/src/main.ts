/**
 * Composition root: the only place that reads the environment and wires the dependencies.
 * https://blog.ploeh.dk/2011/07/28/CompositionRoot/
 */

import { createApp } from './app';
import { loadConfig } from './config';
import { createAuth } from './platform/auth/auth';
import { createDb } from './platform/db/client';
import { pendingMigrations } from './platform/db/migrations';
import { createLifecycle, shutdown } from './platform/lifecycle/shutdown';
import { createLogger } from './platform/observability/logger';

// Under a host's usual 30 s grace period after SIGTERM.
const SHUTDOWN_DEADLINE_MS = 25_000;

const config = loadConfig(Bun.env);
const logger = createLogger(config.logLevel);
const database = createDb(config.databaseUrl, { production: config.production });

const pending = await pendingMigrations(database.db);
if (pending.length > 0) {
  logger.fatal({ pending: pending.length }, 'Migrations not applied: run `bun run db:migrate` first');
  await database.close();
  process.exit(1);
}

const lifecycle = createLifecycle();
const app = createApp({ config, logger, db: database.db, auth: createAuth(database.db, config), lifecycle });

// Bun closes an idle connection after 10 s by default, which would cut a streamed answer.
const server = Bun.serve({ port: config.port, fetch: app.fetch, idleTimeout: 30 });
logger.info({ url: server.url.href }, 'Server ready');

let stopping = false;
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    logger.info({ signal }, 'Shutting down');
    void shutdown({
      lifecycle,
      stopServer: () => server.stop(),
      close: [database.close],
      logger,
      deadlineMs: SHUTDOWN_DEADLINE_MS,
    }).then((code) => process.exit(code));
  });
}
