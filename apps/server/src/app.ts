/**
 * The HTTP application, built from its dependencies: main.ts wires the real ones, tests their own.
 */

import { Hono } from 'hono';
import { contextStorage } from 'hono/context-storage';
import { requestId } from 'hono/request-id';
import type { Logger } from 'pino';
import type { Config } from './config';
import type { Auth } from './platform/auth/auth';
import type { Db } from './platform/db/client';
import type { AppEnv } from './platform/http/env';
import { notFound, problemHandler } from './platform/http/problem';
import { securityHeaders } from './platform/http/security-headers';
import { webClient } from './platform/http/web-client';
import { healthRoutes } from './platform/lifecycle/health';
import type { Lifecycle } from './platform/lifecycle/shutdown';

export interface AppDeps {
  config: Pick<Config, 'production' | 'webDistDir'>;
  logger: Logger;
  db: Db;
  auth: Auth;
  lifecycle: Lifecycle;
}

export function createApp({ config, logger, db, auth, lifecycle }: AppDeps) {
  const app = new Hono<AppEnv>()
    .use(contextStorage())
    // Always generated here: an incoming X-Request-Id would let a client forge log correlation.
    .use(requestId({ headerName: '' }))
    .use(async (c, next) => {
      c.header('X-Request-Id', c.var.requestId);
      await next();
    })
    .use(securityHeaders({ hsts: config.production }))
    // A response of the API is a user's own data: no cache keeps it (OWASP REST Security Cheat Sheet).
    .use('/api/*', async (c, next) => {
      await next();
      c.header('Cache-Control', 'no-store');
    })
    .on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw))
    .route('/health', healthRoutes({ db, lifecycle, logger }))
    .onError(problemHandler(logger))
    .notFound(notFound);

  // After every API route, so that an unknown /api path stays a problem response.
  if (config.webDistDir) app.route('/', webClient(config.webDistDir));
  return app;
}
