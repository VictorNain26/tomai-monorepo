/**
 * Tests unitaires - Auth Middleware (middleware/auth.middleware.ts)
 * Mock: Better Auth + logger
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';
import { makeUser, makeParentUser } from './_helpers/fixtures';

// ============================================
// MOCKS
// ============================================

const mockLogger = createMockLogger();
mock.module('../lib/observability', () => ({ logger: mockLogger }));

// Auth mock state
let authSessionResult: { user: Record<string, unknown>; session: Record<string, unknown> } | null = null;
let authShouldThrow: Error | null = null;

mock.module('../lib/auth', () => ({
  auth: {
    api: {
      getSession: mock(async () => {
        if (authShouldThrow) throw authShouldThrow;
        return authSessionResult;
      }),
    },
  },
}));

// Import after mocks
const {
  requireAuth,
  requireParentRole,
} = await import('../middleware/auth.middleware');

beforeEach(() => {
  const student = makeUser();
  authSessionResult = {
    user: { ...student },
    session: { id: 'sess-001', userId: student.id },
  };
  authShouldThrow = null;
});

describe('Auth Middleware', () => {
  describe('requireAuth', () => {
    it('should return success with valid session', async () => {
      const result = await requireAuth(new Headers());
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.user.id).toBe('user-001');
      }
    });

    it('should return 401 when no session', async () => {
      authSessionResult = null;
      const result = await requireAuth(new Headers());
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.status).toBe(401);
        expect(result._error).toBe('Unauthorized');
      }
    });

    it('should return 503 when auth service is down', async () => {
      authShouldThrow = new Error('Database connection lost');
      const result = await requireAuth(new Headers());
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.status).toBe(503);
        expect(result._error).toBe('Authentication service error');
      }
    });

    it('asks better-auth for the session with the request headers only', async () => {
      const headers = new Headers({ cookie: 'better-auth.session_token=abc' });
      await requireAuth(headers);
      const { auth } = await import('../lib/auth');
      expect(auth.api.getSession).toHaveBeenCalledWith({ headers });
    });
  });

  describe('requireParentRole', () => {
    it('should succeed for parent role', async () => {
      const parent = makeParentUser();
      authSessionResult = {
        user: { ...parent },
        session: { id: 'sess-parent', userId: parent.id },
      };
      const result = await requireParentRole(new Headers());
      expect(result.success).toBe(true);
    });

    it('should return 403 for student role', async () => {
      // Default is student
      const result = await requireParentRole(new Headers());
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.status).toBe(403);
        expect(result._error).toBe('Parent role required');
      }
    });

    it('should propagate auth error', async () => {
      authSessionResult = null;
      const result = await requireParentRole(new Headers());
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.status).toBe(401);
      }
    });
  });

});
