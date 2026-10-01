/**
 * TomAI Server - Point d'entrée
 *
 * Migrations are automatically applied at startup via Drizzle ORM.
 * @see src/db/migrate.ts for runtime migration implementation
 * @see https://orm.drizzle.team/docs/drizzle-kit-migrate
 *
 * OpenTelemetry is initialised here before any service-tier module is
 * imported so the global tracer is in place when mistral-client is first
 * evaluated. The application imports go through dynamic import to preserve
 * that ordering under ESM hoisting.
 */

import { setupOtel, shutdownOtel } from './platform/observability/otel.js';
setupOtel();

import { Sentry } from './platform/observability/sentry.js';

const { app, initializeServices } = await import('./app');
const { logger } = await import('./platform/observability/logger.js');
const { env } = await import('./platform/config/env.js');
const { closeConnection } = await import('./platform/db/connection.js');
const { stopBackgroundJobs } = await import('./platform/lifecycle/server-lifecycle.js');
const { createGracefulShutdown } = await import('./platform/lifecycle/graceful-shutdown.js');

const PORT = env.PORT;
let server: ReturnType<typeof Bun.serve> | undefined;

async function startServer() {
  try {
    // Initialiser les services (DB connection, AI, etc.)
    await initializeServices();

    // idleTimeout 30 s: Bun's default (10 s) would cut a chat stream while the model thinks.
    server = Bun.serve({
      hostname: '0.0.0.0',
      port: PORT,
      idleTimeout: 30,
      fetch: app.fetch,
    });

    logger.info('TomAI Server ready', {
      operation: 'server:start',
      port: PORT,
      environment: env.NODE_ENV,
    });

  } catch (error) {
    logger.error('Failed to start server', {
      err: error,
      port: PORT,
      operation: 'server:start',
      severity: 'critical' as const
    });
    process.exit(1);
  }
}

// Gestion gracieuse de l'arrêt
const shutdown = createGracefulShutdown(
  [
    // Lets in-flight requests, chat streams included, finish.
    { name: 'server.stop', run: () => server?.stop() },
    { name: 'stopBackgroundJobs', run: stopBackgroundJobs },
    { name: 'otel.shutdown', run: shutdownOtel },
    { name: 'sentry.close', run: () => Sentry.close(2000) },
    { name: 'db.close', run: closeConnection },
  ],
  (code) => process.exit(code),
);

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', {
    operation: 'server:error',
    err: error,
    severity: 'critical' as const
  });
  Sentry.captureException(error);
  void (async () => {
    await Sentry.flush(2000);
    process.exit(1);
  })();
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection', {
    operation: 'server:error',
    err: reason,
    severity: 'critical' as const
  });
  Sentry.captureException(reason);
  void (async () => {
    await Sentry.flush(2000);
    process.exit(1);
  })();
});

// Démarrer le serveur
startServer().catch((error) => {
  logger.error('Fatal error', {
    err: error,
    severity: 'critical' as const,
    operation: 'server:start'
  });
  process.exit(1);
});
