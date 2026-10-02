/**
 * Next.js instrumentation hook — loads the right Sentry config per runtime
 * and wires `onRequestError` so errors thrown in Server Components,
 * middleware and route handlers reach Sentry (each config file below is
 * itself a no-op without `NEXT_PUBLIC_SENTRY_DSN`).
 * @see https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/ (Server-Side Instrumentation File — instrumentation.ts, onRequestError)
 */

import * as Sentry from '@sentry/nextjs';

export async function register(): Promise<void> {
  if (process.env['NEXT_RUNTIME'] === 'nodejs') {
    await import('./sentry.server.config');
  }

  if (process.env['NEXT_RUNTIME'] === 'edge') {
    await import('./sentry.edge.config');
  }
}

export const onRequestError = Sentry.captureRequestError;
