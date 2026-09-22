import { env } from '../config/env.js';
import { logger } from '../lib/observability.js';
import { memoryMonitor } from '../middleware/memory-monitor.middleware.js';
import { db } from '../db/connection.js';
import { sql } from 'drizzle-orm';
import { validateEncryptionSetup } from '../lib/encryption.js';
import { startRetentionPurgeScheduler } from './retention-purge.service.js';

let stopRetentionPurge: (() => void) | null = null;

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

    stopRetentionPurge = startRetentionPurgeScheduler();

    logger.info('All services initialized successfully', {
      operation: 'services:init:success',
      services: {
        database: 'ready',
        cache: 'memory-lru',
        ai_stack: 'mistral',
        memory_monitor: 'active',
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
  if (stopRetentionPurge) {
    stopRetentionPurge();
    stopRetentionPurge = null;
  }
}
