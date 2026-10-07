/**
 * Composition root: the only place that reads the environment and wires the dependencies.
 * https://blog.ploeh.dk/2011/07/28/CompositionRoot/
 */

import { createApp } from './app';
import { loadConfig } from './config';
import { accountDeletion } from './modules/household';
import { createAi } from './platform/ai/client';
import { createModeration } from './platform/ai/moderation';
import { createAuth } from './platform/auth/auth';
import { createDb } from './platform/db/client';
import { logMailer, scalewayMailer } from './platform/email/mailer';
import { pendingMigrations } from './platform/db/migrations';
import { createBackgroundTasks } from './platform/lifecycle/background';
import { createLifecycle, shutdown } from './platform/lifecycle/shutdown';
import { createLogger } from './platform/observability/logger';

// Readiness stays failed this long before the server closes: a few probe intervals of the host,
// to align with it at the preproduction step. The deadline stays under a host's usual 30 s
// grace period after SIGTERM.
const DRAIN_MS = 5_000;
const SHUTDOWN_DEADLINE_MS = 25_000;

const config = loadConfig(Bun.env);
const logger = createLogger(config.logLevel);

// A fatal error goes through pino and its content-free serializer, never Bun's own printer,
// which copies every field of an error (a database error's detail holds row values).
function fatal(error: unknown, message: string): never {
  logger.fatal({ err: error }, message);
  process.exit(1);
}
process.on('uncaughtException', (error) => fatal(error, 'Uncaught exception'));
process.on('unhandledRejection', (reason) => fatal(reason, 'Unhandled rejection'));

const database = createDb(config.databaseUrl, { production: config.production });

const pending = await pendingMigrations(database.db).catch((error: unknown) => fatal(error, 'Database unreachable at boot'));
if (pending.length > 0) {
  logger.fatal({ pending: pending.length }, 'Migrations not applied: run `bun run db:migrate` first');
  await database.close();
  process.exit(1);
}

const lifecycle = createLifecycle();
// Without the Scaleway settings, which production requires (config.ts), emails are logged.
const mailer = config.mail ? scalewayMailer(config.mail) : logMailer(logger);
const tasks = createBackgroundTasks();
const auth = createAuth(database.db, config, { mailer, logger, background: tasks.run, deleteUser: accountDeletion(database.db) });
const ai = createAi({ mistral: config.mistral, db: database.db, logger });
const moderation = createModeration({ mistral: config.mistral, logger });
const app = createApp({ config, logger, db: database.db, auth, ai, moderation, lifecycle });

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
      // The emails still being sent, and the database.
      close: [tasks.settled, database.close],
      logger,
      drainMs: DRAIN_MS,
      deadlineMs: SHUTDOWN_DEADLINE_MS,
    }).then((code) => process.exit(code));
  });
}
