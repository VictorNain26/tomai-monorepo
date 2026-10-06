import { Hono } from 'hono';
import { db } from '../../db/connection';
import { sql } from 'drizzle-orm';
import { env } from '../../platform/config/env';
import type { AppEnv } from '../../platform/http/context.js';

export const apiHealthRoutes = new Hono<AppEnv>().get('/health', async (c) => {
  const checks: Record<string, { status: string; latency?: number; error?: string }> = {};
  let overallStatus: 'healthy' | 'unhealthy' = 'healthy';

  try {
    const start = Date.now();
    await db.execute(sql`SELECT 1`);
    checks['database'] = {
      status: 'healthy',
      latency: Date.now() - start,
    };
  } catch (error) {
    checks['database'] = {
      status: 'unhealthy',
      error: error instanceof Error ? error.message : 'Database connection failed',
    };
    overallStatus = 'unhealthy';
  }

  const body = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: env.APP_VERSION,
    commit: env.GIT_COMMIT_SHA,
    environment: env.NODE_ENV,
    deployment: env.DEPLOYMENT_ID ?? 'local',
    checks,
  };

  return c.json(body, overallStatus === 'unhealthy' ? 503 : 200);
});
