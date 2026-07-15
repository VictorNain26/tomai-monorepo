/**
 * Sentry init — browser (client) runtime.
 *
 * Strictly conditional on `NEXT_PUBLIC_SENTRY_DSN` — local dev has no DSN
 * set, so this is a no-op (no client, no console noise). No session replay
 * and no user-feedback widget: landing is public but we don't record
 * anything (RGPD, avoids consent banner for a marketing site).
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/ (Initialize Sentry SDKs — instrumentation-client.ts)
 */

import * as Sentry from '@sentry/nextjs';

const dsn = process.env['NEXT_PUBLIC_SENTRY_DSN'];

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env['NEXT_PUBLIC_VERCEL_ENV'] ?? process.env['NODE_ENV'] ?? 'development',
    tracesSampleRate: 0.1,
  });
}

// Required for router navigations to be captured as spans (tracesSampleRate > 0).
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
