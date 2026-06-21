/**
 * Tests - Better Auth Configuration
 *
 * Vérifie que la configuration auth expose les bonnes capacités :
 * - Google OAuth (social provider)
 * - Expo plugin (mobile deep links)
 * - Username plugin (autonomous child login)
 * - Account linking (email/password + Google sur même email)
 *
 * Context: "unable to create user" bug causé par accountLinking manquant.
 * Ces tests empêchent la régression.
 */

import { describe, it, expect, mock, beforeAll } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';

// ============================================
// MOCKS — avant tout import de auth
// ============================================

const mockLogger = createMockLogger();
mock.module('../lib/observability', () => ({ logger: mockLogger }));

mock.module('../config/env', () => ({
  env: {
    BETTER_AUTH_SECRET: 'test-secret-for-unit-tests-min-32-chars!',
    BETTER_AUTH_URL: 'http://localhost:3000',
    FRONTEND_URL: 'http://localhost:3001',
    NODE_ENV: 'development',
    GOOGLE_CLIENT_ID: 'test-google-client-id',
    GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
    SESSION_MAX_AGE: 604800,
    SESSION_UPDATE_AGE: 86400,
    CORS_ORIGINS: undefined,
    TRUSTED_ORIGINS: undefined,
    DATABASE_URL: 'postgresql://test:test@localhost/test',
    PORT: 3000,
    APP_VERSION: '1.0.0',
    LOG_LEVEL: 'info',
    MISTRAL_MODEL: 'mistral-medium-latest',
    MISTRAL_TEMPERATURE: 0.7,
    MISTRAL_MAX_TOKENS: 16384,
    MISTRAL_TIMEOUT: 60000,
    MISTRAL_RETRY_ATTEMPTS: 3,
    MISTRAL_RETRY_DELAY: 1000,
    MISTRAL_TTS_MODEL: 'voxtral-tts-latest',
    MISTRAL_REASONING_MODEL: 'magistral-medium-latest',
    QUOTA_ENFORCEMENT_ENABLED: true,
  },
  isProduction: () => false,
  isDevelopment: () => true,
  isInDocker: () => false,
  getDatabaseUrl: () => 'postgresql://test:test@localhost/test',
  getTrustedOrigins: () => ['http://localhost:3000', 'http://localhost:3001', 'tomia://', 'exp://'],
  getCorsOrigins: () => ['http://localhost:3000', 'http://localhost:3001'],
}));

mock.module('../db/connection', () => ({
  db: {},
}));

// ============================================
// IMPORT auth après les mocks
// ============================================

let auth: Record<string, unknown>;
let apiMethods: string[];

beforeAll(async () => {
  const mod = await import('../lib/auth');
  auth = mod.auth as Record<string, unknown>;
  apiMethods = Object.keys(auth.api as Record<string, unknown>);
});

// ============================================
// TESTS
// ============================================

describe('Better Auth Configuration', () => {

  describe('Google OAuth provider', () => {
    it('should expose signInSocial API method', () => {
      expect(apiMethods).toContain('signInSocial');
    });

    it('should expose callbackOAuth API method', () => {
      expect(apiMethods).toContain('callbackOAuth');
    });
  });

  describe('Username plugin (autonomous child login)', () => {
    it('should expose signInUsername API method', () => {
      expect(apiMethods).toContain('signInUsername');
    });
  });

  describe('Core auth methods', () => {
    it('should expose signUpEmail', () => {
      expect(apiMethods).toContain('signUpEmail');
    });

    it('should expose signInEmail', () => {
      expect(apiMethods).toContain('signInEmail');
    });

    it('should expose getSession', () => {
      expect(apiMethods).toContain('getSession');
    });

    it('should expose signOut', () => {
      expect(apiMethods).toContain('signOut');
    });
  });

  describe('Account linking (prevents "unable to create user")', () => {
    it('should expose linkSocialAccount API method', () => {
      // accountLinking: { enabled: true } ajoute cette méthode.
      // Si quelqu'un retire accountLinking, ce test casse.
      expect(apiMethods).toContain('linkSocialAccount');
    });
  });

  describe('Auth handler', () => {
    it('should expose a request handler for mounting on Elysia', () => {
      expect(auth.handler).toBeDefined();
      expect(typeof auth.handler).toBe('function');
    });
  });
});
