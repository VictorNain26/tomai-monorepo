/**
 * The HTTP application, built from its dependencies: main.ts wires the real ones, tests their own.
 */

import { Hono } from 'hono';
import { contextStorage } from 'hono/context-storage';
import { requestId } from 'hono/request-id';
import type { Logger } from 'pino';
import type { Config } from './config';
import { householdModule } from './modules/household';
import { tutorModule } from './modules/tutor';
import type { Auth } from './platform/auth/auth';
import type { Db } from './platform/db/client';
import type { AppEnv } from './platform/http/env';
import { notFound, problemHandler } from './platform/http/problem';
import { rateLimit } from './platform/http/rate-limit';
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
  const household = householdModule({ db, auth });
  const tutor = tutorModule({ db, auth });
  // One budget for the API and the probes: /health/ready runs a query on every call. The web's
  // files don't count, a page load fetches a dozen of them.
  const budget = rateLimit({ points: 100, durationSeconds: 60 });
  const app = new Hono<AppEnv>()
    .use(contextStorage())
    // Always generated here: an incoming X-Request-Id would let a client forge log correlation.
    .use(requestId({ headerName: '' }))
    .use(async (c, next) => {
      c.header('X-Request-Id', c.var.requestId);
      await next();
    })
    .use(securityHeaders({ hsts: config.production }))
    .use('/api/*', budget)
    .use('/health/*', budget)
    // A response of the API is a user's own data: no cache keeps it (OWASP REST Security Cheat Sheet).
    .use('/api/*', async (c, next) => {
      await next();
      c.header('Cache-Control', 'no-store');
    })
    .use('/api/auth/*', household.authGuard)
    .on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw))
    .route('/api/household', household.routes)
    .route('/api/sessions', tutor.routes)
    .route('/health', healthRoutes({ db, lifecycle, logger }))
    .onError(problemHandler(logger))
    .notFound(notFound);

  // After every API route, so that an unknown /api path stays a problem response.
  if (config.webDistDir) app.route('/', webClient(config.webDistDir));
  return app;
}
