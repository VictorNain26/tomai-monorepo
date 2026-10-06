/**
 * Liveness answers as long as the process serves; readiness only when the database answers and
 * the server is not shutting down, so that a load balancer stops sending it new requests. Neither
 * says why it fails: the cause goes to the logs.
 */

import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import type { Logger } from 'pino';
import type { Db } from '../db/client';
import type { AppEnv } from '../http/env';
import type { Lifecycle } from './shutdown';

export function healthRoutes({ db, lifecycle, logger }: { db: Db; lifecycle: Lifecycle; logger: Logger }) {
  return new Hono<AppEnv>()
    .get('/live', (c) => c.json({ status: 'live' }, 200))
    .get('/ready', async (c) => {
      if (lifecycle.draining) return c.json({ status: 'draining' }, 503);
      try {
        await db.execute(sql`SELECT 1`);
        return c.json({ status: 'ready' }, 200);
      } catch (error) {
        logger.error({ err: error }, 'Database unreachable');
        return c.json({ status: 'unavailable' }, 503);
      }
    });
}
