/**
 * Sentry Error Tracking - TomAI Mobile
 *
 * Initialized at app startup. DSN configured via EXPO_PUBLIC_SENTRY_DSN.
 * No-op if DSN is not set (safe for development).
 *
 * @see https://docs.sentry.io/platforms/react-native/
 */

import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

export function initializeSentry(): void {
  Sentry.init({
    dsn: DSN,
    environment: __DEV__ ? 'development' : 'production',
    release: Constants.expoConfig?.version ?? '1.0.0',
    dist: Constants.expoConfig?.extra?.eas?.projectId,
    tracesSampleRate: __DEV__ ? 1.0 : 0.2,
    enabled: !__DEV__ && !!DSN,
  });
}

export { Sentry };
