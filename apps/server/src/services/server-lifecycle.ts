import { env } from '../config/env.js';
import { logger } from '../lib/observability.js';
import { tokenQuotaService } from './token-quota.service.js';
import { memoryMonitor } from '../middleware/memory-monitor.middleware.js';
import { db } from '../db/connection.js';
import { sql } from 'drizzle-orm';
import { validateEncryptionSetup } from '../lib/encryption.js';
import { startRetentionPurgeScheduler } from './retention-purge.service.js';

let tokenResetInterval: ReturnType<typeof setInterval> | null = null;
let stopRetentionPurge: (() => void) | null = null;

export function startTokenResetCron(): void {
  const ONE_HOUR = 60 * 60 * 1000;

  if (tokenResetInterval) {
    clearInterval(tokenResetInterval);
  }

  tokenResetInterval = setInterval(async () => {
    try {
      const now = new Date();
      const parisFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Europe/Paris',
        hour: '2-digit',
        hour12: false,
      });
      const parisHour = parseInt(parisFormatter.format(now));

      if (parisHour === 10) {
        logger.info('Token reset cron triggered at 10:00 AM Paris', {
          operation: 'token-reset-cron',
          parisTime: now.toLocaleString('fr-FR', { timeZone: 'Europe/Paris' })
        });

        const result = await tokenQuotaService.resetAllDailyTokens();

        logger.info('Token reset cron completed', {
          operation: 'token-reset-cron:complete',
          resetCount: result.resetCount
        });
      }
    } catch (error) {
      logger.error('Token reset cron failed', {
        _error: error instanceof Error ? error.message : String(error),
        severity: 'high' as const,
        operation: 'token-reset-cron:error'
      });
    }
  }, ONE_HOUR);

  void (async () => {
    try {
      const result = await tokenQuotaService.resetAllDailyTokens();
      if (result.resetCount > 0) {
        logger.info('Token reset on startup', {
          operation: 'token-reset-startup',
          resetCount: result.resetCount
        });
      }
    } catch (error) {
      logger.error('Token reset on startup failed', {
        _error: error instanceof Error ? error.message : String(error),
        severity: 'high' as const,
        operation: 'token-reset-startup:error'
      });
    }
  })();

  logger.info('Token reset cron started', {
    operation: 'token-reset-cron:init',
    schedule: 'Every hour, resets at 10:00 AM Paris time'
  });
}

export async function initializeServices(): Promise<void> {
  try {
    logger.info('Initializing TomAI services...', {
      operation: 'services:init',
      environment: env.NODE_ENV
    });

    logger.info('In-memory cache ready', {
      operation: 'services:init:cache',
      provider: 'memory-lru'
    });

    const hasPronoteKey = !!env.PRONOTE_ENCRYPTION_KEY;
    if (hasPronoteKey) {
      const encryptionValid = await validateEncryptionSetup();
      if (!encryptionValid) {
        logger.error('Pronote encryption validation failed', {
          operation: 'services:init:encryption:failed',
          _error: 'Encryption key validation failed - encrypt/decrypt cycle test failed',
          severity: 'critical' as const,
          impact: 'Pronote integration will not work'
        });
        throw new Error('PRONOTE_ENCRYPTION_KEY validation failed - check key format');
      }
      logger.info('Pronote encryption validated', {
        operation: 'services:init:encryption',
        status: 'ready'
      });
    } else {
      logger.info('Pronote encryption not configured (optional feature)', {
        operation: 'services:init:encryption:skipped'
      });
    }

    const dbStart = Date.now();
    await db.execute(sql`SELECT 1 as health_check`);
    const dbLatency = Date.now() - dbStart;

    logger.info('PostgreSQL verified successfully', {
      operation: 'services:init:database',
      latency_ms: dbLatency,
      pool: 'ready'
    });

    const migrations = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM drizzle.__drizzle_migrations
    `);

    logger.info('Database migrations verified', {
      operation: 'services:init:migrations',
      count: Number(migrations[0]?.count ?? 0)
    });

    memoryMonitor.startMonitoring(30000);

    startTokenResetCron();
    stopRetentionPurge = startRetentionPurgeScheduler();

    logger.info('All services initialized successfully', {
      operation: 'services:init:success',
      services: {
        database: 'ready',
        cache: 'memory-lru',
        rag: 'qdrant-cloud',
        ai_stack: 'mistral',
        memory_monitor: 'active',
        token_reset_cron: 'active',
        retention_purge: 'active',
      },
      environment: env.NODE_ENV
    });

  } catch (_error) {
    logger.error('FATAL: Service initialization failed', {
      operation: 'services:init:error',
      _error: _error instanceof Error ? _error.message : String(_error),
      severity: 'critical' as const
    });
    throw _error;
  }
}

export function stopBackgroundJobs(): void {
  if (tokenResetInterval) {
    clearInterval(tokenResetInterval);
    tokenResetInterval = null;
  }
  if (stopRetentionPurge) {
    stopRetentionPurge();
    stopRetentionPurge = null;
  }
}
