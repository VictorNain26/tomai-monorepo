/**
 * TomAI Server — Hono on Bun, Better Auth, AI orchestration.
 */

import { securityHeaders, webClient } from '@repo/web-host';
import { Hono } from 'hono';
import { requestId } from 'hono/request-id';

import { auth } from './platform/auth/auth.js';
import { env, isDevelopment } from './platform/config/env.js';
import type { AppEnv } from './platform/http/context.js';
import { sentryMiddleware } from './platform/observability/sentry.js';

import { apiRoutes } from './routes/api/index.js';
import { chatMessageRoutes, chatSessionRoutes, sessionFilesRoutes } from './modules/tutor/index.js';
import { parentRoutes, subscriptionRoutes } from './modules/family/index.js';
import { uploadRoutes, filesRoutes } from './modules/documents/index.js';
import { voiceRoutes } from './modules/voice/index.js';
import { learningRoutes } from './modules/learning/index.js';

import { handleError, handleNotFound } from './platform/http/error-handler.js';
import { createRateLimitMiddleware, RateLimitPresets } from './platform/http/rate-limit.js';

const isDev = isDevelopment();
// The web client's files don't count: one page load fetches a dozen of them.
const apiRateLimit = createRateLimitMiddleware(RateLimitPresets.api);

const base = new Hono<AppEnv>();
// No-op unless SENTRY_DSN is set; must wrap the app before any route.
base.use(sentryMiddleware(base));

const app = base
  // Always generated here: an incoming X-Request-Id would let a client forge log correlation.
  .use(requestId({ headerName: '' }))
  .use(async (c, next) => {
    c.header('X-Request-Id', c.var.requestId);
    await next();
  })

  // In development, better-auth's API reference (openAPI plugin, dev only) loads Scalar from
  // jsdelivr with an inline script the CSP would block.
  .use(securityHeaders({ hsts: !isDev, exempt: isDev ? ['/api/auth/reference'] : [] }))

  .use('/api/*', apiRateLimit)
  .use('/health', apiRateLimit)

  .on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw))

  // GET /health is mounted via apiRoutes (routes/api/health.routes.ts) — the
  // single canonical health endpoint (Dockerfile HEALTHCHECK target).

  .route('/', apiRoutes)
  .route('/api/chat', chatMessageRoutes)
  .route('/api/upload', uploadRoutes)
  .route('/api', filesRoutes)
  .route('/api', chatSessionRoutes)
  .route('/api', sessionFilesRoutes)
  .route('/api', parentRoutes)
  .route('/api/subscriptions', subscriptionRoutes)
  .route('/api/tts', voiceRoutes)
  .route('/api/learning', learningRoutes)

  .onError(handleError)
  .notFound(handleNotFound);

// Outside the chain: the web client's catch-all stays out of AppType, after every API route.
if (env.WEB_DIST_DIR) app.route('/', webClient(env.WEB_DIST_DIR));

export { app };

// Typed client contract (hono/client `hc<AppType>`), consumed by @repo/api.
export type AppType = typeof app;

// UI message wire types for chat clients (AI SDK UIMessage) - type-only
export type { TomChatMessage, TomDataParts, DeckCreatedData } from './modules/tutor/index.js';
export type { FieldError } from './platform/http/errors.js';

export { initializeServices } from './platform/lifecycle/server-lifecycle.js';
