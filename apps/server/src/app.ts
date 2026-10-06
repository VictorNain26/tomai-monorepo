/**
 * TomAI Server — Hono on Bun, Better Auth, AI orchestration.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { requestId } from 'hono/request-id';
import { secureHeaders } from 'hono/secure-headers';

import { auth } from './platform/auth/auth.js';
import { isDevelopment, getCorsOrigins } from './platform/config/env.js';
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

  .use(
    cors({
      origin: getCorsOrigins(),
      // credentials=true pour les cookies de session cross-origin
      credentials: true,
      allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowHeaders: [
        'Content-Type',
        'Authorization',
        'Cookie', // REQUIRED pour Better Auth sessions
        'Cache-Control',
        'Accept',
        'X-Requested-With',
      ],
      // Set-Cookie intentionally NOT exposed: JavaScript must not be able to read
      // session cookies cross-origin.
      exposeHeaders: ['X-Request-Id', 'Retry-After', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
      maxAge: 86400,
    }),
  )

  // HSTS only in production so local http://localhost keeps working. CORP and
  // COOP stay off: the web client runs on another origin and the OAuth flow
  // may rely on window.opener.
  .use(
    secureHeaders({
      crossOriginResourcePolicy: false,
      crossOriginOpenerPolicy: false,
      xFrameOptions: 'DENY',
      referrerPolicy: 'strict-origin-when-cross-origin',
      permissionsPolicy: { geolocation: [], microphone: [], camera: [] },
      strictTransportSecurity: isDev ? false : 'max-age=31536000; includeSubDomains',
    }),
  )

  .use(createRateLimitMiddleware(RateLimitPresets.api))

  .on(['GET', 'POST'], '/api/auth/*', (c) => auth.handler(c.req.raw))

  .get('/', (c) => c.json({ name: 'TomAI API', status: 'operational' }))

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

export { app };

// Typed client contract (hono/client `hc<AppType>`), consumed by @repo/api.
export type AppType = typeof app;

// UI message wire types for chat clients (AI SDK UIMessage) - type-only
export type { TomChatMessage, TomDataParts, DeckCreatedData } from './modules/tutor/index.js';
export type { FieldError } from './platform/http/errors.js';

export { initializeServices } from './platform/lifecycle/server-lifecycle.js';
