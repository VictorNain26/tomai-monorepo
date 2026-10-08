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
import type { Ai } from './platform/ai/client';
import type { Moderation } from './platform/ai/moderation';
import type { Auth } from './platform/auth/auth';
import type { Db } from './platform/db/client';
import type { AppEnv } from './platform/http/env';
import { CLIENT_ADDRESS_HEADER, clientAddress } from './platform/http/client-address';
import { notFound, problemHandler } from './platform/http/problem';
import { rateLimit } from './platform/http/rate-limit';
import { securityHeaders } from './platform/http/security-headers';
import { webClient } from './platform/http/web-client';
import { healthRoutes } from './platform/lifecycle/health';
import type { Lifecycle } from './platform/lifecycle/shutdown';

export interface AppDeps {
  config: Pick<Config, 'production' | 'webDistDir' | 'apiRateLimit' | 'trustedProxyHops'>;
  logger: Logger;
  db: Db;
  auth: Auth;
  ai: Ai;
  moderation: Moderation;
  lifecycle: Lifecycle;
  /** Work after a response, which the shutdown waits for. */
  background: (task: Promise<unknown>) => void;
}

export function createApp({ config, logger, db, auth, ai, moderation, lifecycle, background }: AppDeps) {
  const household = householdModule({ db, auth });
  const tutor = tutorModule({ db, auth, ai, moderation, logger, background });
  // One budget for the API and the probes: /health/ready runs a query on every call. The web's
  // files don't count, a page load fetches a dozen of them.
  const budget = rateLimit({ points: config.apiRateLimit, durationSeconds: 60 });
  const app = new Hono<AppEnv>()
    .use(contextStorage())
    // Always generated here: an incoming X-Request-Id would let a client forge log correlation.
    .use(requestId({ headerName: '' }))
    .use(async (c, next) => {
      c.header('X-Request-Id', c.var.requestId);
      await next();
    })
    .use(securityHeaders({ hsts: config.production }))
    .use(clientAddress(config.trustedProxyHops))
    .use('/api/*', budget)
    .use('/health/*', budget)
    // A response of the API is a user's own data: no cache keeps it (OWASP REST Security Cheat Sheet).
    .use('/api/*', async (c, next) => {
      await next();
      c.header('Cache-Control', 'no-store');
    })
    .use('/api/auth/*', household.authGuard)
    .on(['GET', 'POST'], '/api/auth/*', (c) => {
      // better-auth reads the client's address from this header alone, written here whatever the
      // client sent.
      const headers = new Headers(c.req.raw.headers);
      headers.set(CLIENT_ADDRESS_HEADER, c.var.clientAddress);
      return auth.handler(new Request(c.req.raw, { headers }));
    })
    .route('/api/me', household.me)
    .route('/api/household', household.routes)
    .route('/api/sessions', tutor.routes)
    .route('/api/memory', tutor.memory)
    .route('/api/summary', tutor.summary)
    .route('/health', healthRoutes({ db, lifecycle, logger }))
    .onError(problemHandler(logger))
    .notFound(notFound);

  // After every API route, so that an unknown /api path stays a problem response.
  if (config.webDistDir) app.route('/', webClient(config.webDistDir));
  return app;
}
