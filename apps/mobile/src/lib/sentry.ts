/**
 * Sentry init — mobile app boot path.
 *
 * Strictly conditional on `EXPO_PUBLIC_SENTRY_DSN` — local dev has no DSN
 * set (only defined via EAS secrets for preview/production builds), so this
 * is a no-op (no client, no console noise).
 *
 * No session replay, no screenshot/view-hierarchy capture: this is a
 * students' app (RGPD mineurs) — only crash/error + low-rate perf tracing.
 *
 * @see https://docs.sentry.io/platforms/react-native/manual-setup/expo/ (Sentry.init, Sentry.wrap)
 */

import Constants from 'expo-constants';
import * as Sentry from '@sentry/react-native';

let initialized = false;

export function setupSentry(): void {
  if (initialized) return;
  initialized = true;

  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  const environment =
    (Constants.expoConfig?.extra?.['appEnv'] as string | undefined) ??
    (__DEV__ ? 'development' : 'production');

  Sentry.init({
    dsn,
    environment,
    tracesSampleRate: 0.1,
  });
}

export { Sentry };
