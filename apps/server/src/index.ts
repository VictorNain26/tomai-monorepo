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

import { setupOtel } from './lib/otel/otel.js';
setupOtel();

import { setupSentry, Sentry } from './lib/sentry.js';
setupSentry();

const { app, initializeServices } = await import('./app');
const { logger } = await import('./lib/observability.js');
const { env } = await import('./config/env.js');

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
async function gracefulShutdown(signal: string) {
  logger.info(`${signal} received - shutting down gracefully`, {
    operation: 'server:shutdown',
    signal
  });

  try {
    const { closeConnection } = await import('./db/connection.js');
    const { memoryMonitor } = await import('./middleware/memory-monitor.middleware.js');
    const { stopBackgroundJobs } = await import('./services/server-lifecycle.js');

    // Each stop call is isolated so a throwing user-supplied fn cannot skip the DB drain.
    for (const step of [
      { name: 'stopBackgroundJobs', run: stopBackgroundJobs },
      { name: 'stopMonitoring', run: () => memoryMonitor.stopMonitoring() },
    ]) {
      try {
        step.run();
      } catch (err) {
        logger.error(`Shutdown step failed: ${step.name}`, {
          operation: 'server:shutdown',
          _error: err instanceof Error ? err.message : String(err),
          severity: 'high' as const,
        });
      }
    }
    await closeConnection();

    if (global.gc) {
      global.gc();
    }

    await new Promise(resolve => setTimeout(resolve, 500));

    logger.info('Shutdown completed', {
      operation: 'server:shutdown',
      status: 'success'
    });
  } catch (error) {
    logger.error('Error during shutdown', {
      operation: 'server:shutdown',
      _error: error instanceof Error ? error.message : String(error),
      severity: 'high' as const
    });
  }

  process.exit(0);
}

// Gestionnaires de signaux
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

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
