/**
 * Tests - Better Auth Configuration
 *
 * Vérifie que la configuration auth expose les bonnes capacités :
 * - Google OAuth (social provider)
 * - Admin plugin (Quick Switch / impersonation / ban)
 * - Expo plugin (mobile deep links)
 * - Account linking (email/password + Google sur même email)
 *
 * Context: "unable to create user" bug causé par accountLinking manquant
 * et colonnes admin plugin absentes. Ces tests empêchent la régression.
 */

import { describe, it, expect, mock, beforeAll } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';

// ============================================
// MOCKS — avant tout import de auth
// ============================================

const mockLogger = createMockLogger();
mock.module('../lib/observability', () => ({ logger: mockLogger }));

mock.module('../config/environment.config', () => ({
  env: {
    BETTER_AUTH_SECRET: 'test-secret-for-unit-tests',
    BETTER_AUTH_URL: 'http://localhost:3000',
    FRONTEND_URL: 'http://localhost:3001',
    NODE_ENV: 'development',
    GOOGLE_CLIENT_ID: 'test-google-client-id',
    GOOGLE_CLIENT_SECRET: 'test-google-client-secret',
    SESSION_MAX_AGE: 604800,
    SESSION_UPDATE_AGE: 86400,
    CORS_ORIGINS: [],
    TRUSTED_ORIGINS: [],
  },
  envUtils: {
    isDevelopment: true,
    isProduction: false,
    validateService: () => {},
  },
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

  describe('Admin plugin (Quick Switch / ban)', () => {
    it('should expose banUser API method', () => {
      expect(apiMethods).toContain('banUser');
    });

    it('should expose unbanUser API method', () => {
      expect(apiMethods).toContain('unbanUser');
    });

    it('should expose impersonateUser API method', () => {
      expect(apiMethods).toContain('impersonateUser');
    });

    it('should expose stopImpersonating API method', () => {
      expect(apiMethods).toContain('stopImpersonating');
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
