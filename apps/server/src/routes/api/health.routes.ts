import { Elysia } from 'elysia';
import { db } from '../../db/connection';
import { sql } from 'drizzle-orm';
import { env } from '../../config/env';
import { cacheService } from '../../services/memory-cache.service';

export const apiHealthRoutes = new Elysia({ name: 'api-health-check' })

  .get('/health', async ({ status }) => {
    const checks: Record<string, { status: string; latency?: number; error?: string }> = {};
    let overallStatus: 'healthy' | 'unhealthy' = 'healthy';

    try {
      const start = Date.now();
      await db.execute(sql`SELECT 1`);
      checks.database = {
        status: 'healthy',
        latency: Date.now() - start
      };
    } catch (error) {
      checks.database = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Database connection failed'
      };
      overallStatus = 'unhealthy';
    }

    const cacheHealth = cacheService.healthCheck();
    checks.cache = {
      status: cacheHealth.status,
      latency: cacheHealth.latency,
    };

    const body = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      version: env.APP_VERSION,
      commit: env.GIT_COMMIT_SHA,
      environment: env.NODE_ENV,
      deployment: env.DEPLOYMENT_ID ?? 'local',
      checks,
    };

    return overallStatus === 'unhealthy' ? status(503, body) : body;
  });
