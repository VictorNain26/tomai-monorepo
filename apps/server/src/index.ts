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

import { setupOtel, shutdownOtel } from './lib/otel/otel.js';
setupOtel();

import { setupSentry, Sentry } from './lib/sentry.js';
setupSentry();

const { app, initializeServices } = await import('./app');
const { logger } = await import('./lib/observability.js');
const { env } = await import('./config/env.js');
const { closeConnection } = await import('./db/connection.js');
const { memoryMonitor } = await import('./middleware/memory-monitor.middleware.js');
const { stopBackgroundJobs } = await import('./services/server-lifecycle.js');
const { createGracefulShutdown } = await import('./lib/graceful-shutdown.js');

const PORT = env.PORT;

async function startServer() {
  try {
    // Initialiser les services (DB connection, AI, etc.)
    await initializeServices();

    // Démarrer le serveur
    app.listen({
      hostname: '0.0.0.0',
      port: PORT
    });

    logger.info('TomAI Server ready', {
      operation: 'server:start',
      port: PORT,
      environment: env.NODE_ENV,
    });

  } catch (error) {
    logger.error('Failed to start server', {
      _error: error instanceof Error ? error.message : String(error),
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
    { name: 'app.stop', run: () => app.stop() },
    { name: 'stopBackgroundJobs', run: stopBackgroundJobs },
    { name: 'stopMonitoring', run: () => memoryMonitor.stopMonitoring() },
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
    _error: error.message,
    stack: error.stack,
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
    _error: reason instanceof Error ? reason.message : String(reason),
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
    _error: error instanceof Error ? error.message : String(error),
    severity: 'critical' as const,
    operation: 'server:start'
  });
  process.exit(1);
});
