/**
 * Tests unitaires - Auth Middleware (middleware/auth.middleware.ts)
 * Mock: Better Auth + DB + logger
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

// DB mock state
let dbUserExists: boolean = true;
let dbDeleteShouldThrow: Error | null = null;

mock.module('../db/connection', () => ({
  db: {
    select: mock(() => ({
      from: mock(() => ({
        where: mock(() => ({
          limit: mock(() => {
            if (dbUserExists) return [{ id: 'user-001' }];
            return [];
          }),
        })),
      })),
    })),
    delete: mock(() => ({
      where: mock(() => {
        if (dbDeleteShouldThrow) throw dbDeleteShouldThrow;
        return Promise.resolve();
      }),
    })),
  },
}));

mock.module('../db/schema', () => ({
  user: { id: 'id' },
  session: { id: 'id' },
}));

mock.module('drizzle-orm', () => ({
  eq: (...args: unknown[]) => ({ type: 'eq', args }),
}));

// Import after mocks
const {
  requireAuth,
  requireParentRole,
  handleAuthWithCookies,
  handleParentAuthWithCookies,
} = await import('../middleware/auth.middleware');

beforeEach(() => {
  const student = makeUser();
  authSessionResult = {
    user: { ...student },
    session: { id: 'sess-001', userId: student.id },
  };
  authShouldThrow = null;
  dbUserExists = true;
  dbDeleteShouldThrow = null;
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
        expect(result.shouldClearCookies).toBe(false);
      }
    });

    it('should detect orphaned session (user deleted) and set shouldClearCookies', async () => {
      dbUserExists = false;
      const result = await requireAuth(new Headers());
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.status).toBe(401);
        expect(result.shouldClearCookies).toBe(true);
        expect(mockLogger.warn).toHaveBeenCalled();
      }
    });

    it('should handle cleanup failure silently on orphaned session', async () => {
      dbUserExists = false;
      dbDeleteShouldThrow = new Error('DB unavailable');
      const result = await requireAuth(new Headers());
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.shouldClearCookies).toBe(true);
        // Should log error but not throw
        expect(mockLogger.error).toHaveBeenCalled();
      }
    });

    it('should return 503 when auth service is down', async () => {
      authShouldThrow = new Error('Database connection lost');
      const result = await requireAuth(new Headers());
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.status).toBe(503);
        expect(result._error).toBe('Authentication service error');
        expect(result.shouldClearCookies).toBe(false);
      }
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

  describe('handleAuthWithCookies', () => {
    it('should return success with valid auth', async () => {
      const mockSet = { status: 200 as number | string, headers: {} as Record<string, string | number> };
      const result = await handleAuthWithCookies(new Headers(), mockSet);
      expect(result.success).toBe(true);
    });

    it('should set cookie clearing headers on orphaned session', async () => {
      dbUserExists = false;
      const mockSet = { status: 200 as number | string, headers: {} as Record<string, string | number> };
      const result = await handleAuthWithCookies(new Headers(), mockSet);
      expect(result.success).toBe(false);
      expect(mockSet.status).toBe(401);
      expect(String(mockSet.headers['Set-Cookie'])).toContain('better-auth.session_token=');
    });

    it('should set status code on failure', async () => {
      authSessionResult = null;
      const mockSet = { status: 200 as number | string, headers: {} as Record<string, string | number> };
      await handleAuthWithCookies(new Headers(), mockSet);
      expect(mockSet.status).toBe(401);
    });
  });

  describe('handleParentAuthWithCookies', () => {
    it('should succeed for parent user', async () => {
      const parent = makeParentUser();
      authSessionResult = {
        user: { ...parent },
        session: { id: 'sess-p', userId: parent.id },
      };
      const mockSet = { status: 200 as number | string, headers: {} as Record<string, string | number> };
      const result = await handleParentAuthWithCookies(new Headers(), mockSet);
      expect(result.success).toBe(true);
    });

    it('should set cookie clearing on orphaned session', async () => {
      dbUserExists = false;
      const mockSet = { status: 200 as number | string, headers: {} as Record<string, string | number> };
      const result = await handleParentAuthWithCookies(new Headers(), mockSet);
      expect(result.success).toBe(false);
      expect(String(mockSet.headers['Set-Cookie'])).toContain('better-auth.session_token=');
    });
  });
});
