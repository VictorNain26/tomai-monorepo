/**
 * TomAI Server - Point d'entrée
 *
 * Migrations are automatically applied at startup via Drizzle ORM.
 * @see src/db/migrate.ts for runtime migration implementation
 * @see https://orm.drizzle.team/docs/drizzle-kit-migrate
 */

import { app, initializeServices } from './app';
import { logger } from './lib/observability';

const PORT = parseInt(process.env.PORT ?? process.env.BACKEND_PORT ?? '3000');

async function startServer() {
  try {
    // Initialiser les services (DB connection, Redis, AI, etc.)
    await initializeServices();

    // Démarrer le serveur
    app.listen({
      hostname: '0.0.0.0',
      port: PORT
    });

    logger.info('TomAI Server ready', {
      operation: 'server:start',
      port: PORT,
      environment: process.env.NODE_ENV ?? 'development'
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

    memoryMonitor.stopMonitoring();
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
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection', {
    operation: 'server:error',
    _error: reason instanceof Error ? reason.message : String(reason),
    severity: 'critical' as const
  });
  process.exit(1);
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
