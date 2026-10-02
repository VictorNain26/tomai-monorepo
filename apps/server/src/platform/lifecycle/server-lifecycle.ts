import { env } from '../config/env.js';
import { logger } from '../observability/logger.js';
import { db } from '../../db/connection.js';
import { sql } from 'drizzle-orm';
export async function initializeServices(): Promise<void> {
  try {
    logger.info('Initializing TomAI services...', {
      operation: 'services:init',
      environment: env.NODE_ENV
    });

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
      count: Number(migrations[0]?.['count'] ?? 0)
    });

    logger.info('All services initialized successfully', {
      operation: 'services:init:success',
      services: {
        database: 'ready',
        ai_stack: 'mistral',
      },
      environment: env.NODE_ENV
    });

  } catch (_error) {
    logger.error('FATAL: Service initialization failed', {
      operation: 'services:init:error',
      err: _error,
      severity: 'critical' as const
    });
    throw _error;
  }
}
