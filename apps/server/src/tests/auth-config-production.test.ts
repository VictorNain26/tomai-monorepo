import { describe, it, expect, mock } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';

mock.module('../platform/observability/logger', () => ({ logger: createMockLogger() }));

mock.module('../platform/config/env', () => ({
  env: {
    BETTER_AUTH_SECRET: 'test-secret-for-unit-tests-min-32-chars!',
    BETTER_AUTH_URL: 'https://tom.example',
    NODE_ENV: 'production',
    GOOGLE_CLIENT_ID: 'test-google-client-id',
    GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
    SESSION_MAX_AGE: 604800,
    SESSION_UPDATE_AGE: 86400,
    DATABASE_URL: 'postgresql://test:test@localhost/test',
    PORT: 3000,
    APP_VERSION: '1.0.0',
    LOG_LEVEL: 'info',
    MISTRAL_MODEL: 'mistral-small-2603',
    MISTRAL_TEMPERATURE: 0.7,
    MISTRAL_MAX_TOKENS: 16384,
    MISTRAL_TIMEOUT: 60000,
    MISTRAL_RETRY_ATTEMPTS: 3,
    MISTRAL_TTS_MODEL: 'voxtral-mini-tts-2603',
    QUOTA_ENFORCEMENT_ENABLED: true,
  },
  isProduction: () => true,
  isDevelopment: () => false,
  getDatabaseUrl: () => 'postgresql://test:test@localhost/test',
}));

mock.module('../db/connection', () => ({ db: {} }));

const { auth } = await import('../platform/auth/auth');

describe('Better Auth configuration in production', () => {
  it('keeps the session cookie on the one origin of the API and the web client', () => {
    expect(auth.options.advanced).not.toHaveProperty('crossSubDomainCookies');
    expect(auth.options.advanced.defaultCookieAttributes).not.toHaveProperty('domain');
    expect(auth.options).not.toHaveProperty('trustedOrigins');
  });
});
