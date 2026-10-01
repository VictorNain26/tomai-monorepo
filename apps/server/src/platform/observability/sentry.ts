/**
 * Sentry — error capture only, strictly conditional on `SENTRY_DSN` (local dev
 * has none, so the middleware is a pass-through and no client starts).
 *
 * `@sentry/hono/bun` initialises the SDK inside `sentry(app, options)`, so the
 * middleware must wrap the app before any route. Since @sentry/bun v11 the SDK
 * registers no OpenTelemetry tracer provider by default
 * (`enableOpenTelemetrySetup: false`), leaving `otel.ts` as the only one.
 * @see https://docs.sentry.io/platforms/javascript/guides/hono/
 */

import * as Sentry from '@sentry/hono/bun';
import type { ErrorEvent } from '@sentry/hono/bun';
import type { Env, Hono, MiddlewareHandler } from 'hono';
import { AppError } from '../http/errors.js';

/**
 * `sendDefaultPii: false` only strips the IP on spans — request headers
 * (Authorization, Better Auth session cookie) and query_string still land
 * on error events by default, unacceptable for an app used by minors.
 */
export function scrubRequestData(event: ErrorEvent): ErrorEvent {
  if (event.request) {
    delete event.request.headers;
    delete event.request.cookies;
    delete event.request.query_string;
  }
  return event;
}

export function sentryMiddleware<E extends Env>(app: Hono<E>): MiddlewareHandler {
  const dsn = process.env['SENTRY_DSN'];
  if (!dsn) {
    return async (_c, next) => {
      await next();
    };
  }

  return Sentry.sentry(app, {
    dsn,
    environment: process.env['NODE_ENV'] ?? 'development',
    release: process.env['GIT_COMMIT_SHA'] ?? 'unknown',
    tracesSampleRate: 0.1,
    beforeSend: scrubRequestData,
    // The default filter reads `error.status`; AppError carries `statusCode`.
    shouldHandleError: (error) => !(error instanceof AppError) || error.statusCode >= 500,
  });
}

export { Sentry };
