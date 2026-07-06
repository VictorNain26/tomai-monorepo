/**
 * Sentry init — Edge runtime (middleware/proxy, edge Route Handlers).
 *
 * Strictly conditional on `NEXT_PUBLIC_SENTRY_DSN` — local dev has no DSN
 * set, so this is a no-op.
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/ (Initialize Sentry SDKs — sentry.edge.config.ts)
 */

import * as Sentry from '@sentry/nextjs';

const dsn = process.env['NEXT_PUBLIC_SENTRY_DSN'];

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env['VERCEL_ENV'] ?? process.env['NODE_ENV'] ?? 'development',
    tracesSampleRate: 0.1,
  });
}
