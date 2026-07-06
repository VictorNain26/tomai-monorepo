/**
 * Sentry init — server boot path.
 *
 * Called by `index.ts` right after `setupOtel()`, before any application
 * import, so error capture is live for the whole process lifetime.
 *
 * Strictly conditional on `SENTRY_DSN` — local dev has no DSN set, so this
 * is a no-op (no client, no background flush interval, no console noise).
 *
 * `skipOpenTelemetrySetup: true` keeps OUR OpenTelemetry setup (`otel.ts`)
 * as the only tracer provider — Sentry's own auto-instrumentation is
 * disabled so it doesn't double-instrument Bun/Node internals already
 * covered by `setupOtel()`. Sentry here is error capture only; trace
 * correlation between Sentry spans and our OTel spans is out of scope
 * (would require the full manual OTel wiring documented for "existing
 * OpenTelemetry setup" — not needed while `tracesSampleRate` stays low
 * and traces are served by our own OTLP pipeline).
 * @see https://docs.sentry.io/platforms/javascript/guides/bun/opentelemetry/custom-setup/ (skipOpenTelemetrySetup)
 * @see https://docs.sentry.io/platforms/javascript/guides/bun/ (Sentry.init early, dsn, tracesSampleRate)
 */

import * as Sentry from '@sentry/elysia';

let initialized = false;

export function setupSentry(): void {
  if (initialized) return;
  initialized = true;

  const dsn = process.env['SENTRY_DSN'];
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: process.env['NODE_ENV'] ?? 'development',
    release: process.env['GIT_COMMIT_SHA'] ?? 'unknown',
    tracesSampleRate: 0.1,
    skipOpenTelemetrySetup: true,
  });
}

export function isSentryEnabled(): boolean {
  return Boolean(process.env['SENTRY_DSN']);
}

export { Sentry };
