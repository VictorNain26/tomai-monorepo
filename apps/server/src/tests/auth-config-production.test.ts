import { describe, it, expect, mock } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';

mock.module('../platform/observability/logger', () => ({ logger: createMockLogger() }));

mock.module('../platform/config/env', () => ({
  env: {
    BETTER_AUTH_SECRET: 'test-secret-for-unit-tests-min-32-chars!',
    BETTER_AUTH_URL: 'https://api.tomia.fr',
    FRONTEND_URL: 'http://localhost:3001',
    NODE_ENV: 'production',
    GOOGLE_CLIENT_ID: 'test-google-client-id',
    GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
    SESSION_MAX_AGE: 604800,
    SESSION_UPDATE_AGE: 86400,
    CORS_ORIGINS: undefined,
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
  isInDocker: () => false,
  getDatabaseUrl: () => 'postgresql://test:test@localhost/test',
  getCorsOrigins: () => ['http://localhost:3000', 'http://localhost:3001'],
}));

mock.module('../db/connection', () => ({ db: {} }));

const { auth } = await import('../platform/auth/auth');

describe('Better Auth configuration in production', () => {
  it('shares the session cookie across the parent domain of the API', () => {
    expect(auth.options.advanced.crossSubDomainCookies).toEqual({ enabled: true, domain: '.tomia.fr' });
  });
});
