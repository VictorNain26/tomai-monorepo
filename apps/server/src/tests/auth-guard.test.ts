/**
 * Auth guards (platform/http/context.ts): inject the typed user/session, answer 401, 403
 * or 503 through the global error envelope.
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { Hono } from 'hono';
import type { AuthenticatedUser } from '../types/index.js';
import type { AppEnv } from '../platform/http/context';
import { createMockLogger } from './_helpers/mock-logger';

const mockLogger = createMockLogger();
mock.module('../platform/observability/logger', () => ({ logger: mockLogger }));

// Auth mock state
let authSessionResult: { user: Record<string, unknown>; session: Record<string, unknown> } | null = null;
let authShouldThrow: Error | null = null;

mock.module('../platform/auth/auth', () => ({
  auth: {
    api: {
      getSession: mock(async () => {
        if (authShouldThrow) throw authShouldThrow;
        return authSessionResult;
      }),
    },
  },
}));

// Import after all mocks
const { requireUser, requireParent } = await import('../platform/http/context.js');
const { handleError } = await import('../platform/http/error-handler.js');

// Helper fixtures
function makeUser(overrides?: Partial<AuthenticatedUser>): AuthenticatedUser {
  return {
    id: 'user-001',
    email: 'student@example.com',
    name: 'Jane Student',
    role: 'student',
    schoolLevel: 'seconde',
    firstName: 'Jane',
    ...overrides,
  };
}

function makeParentUser(overrides?: Partial<AuthenticatedUser>): AuthenticatedUser {
  return makeUser({
    email: 'parent@example.com',
    name: 'Parent User',
    role: 'parent',
    schoolLevel: undefined,
    ...overrides,
  });
}

describe('auth guards', () => {
  beforeEach(() => {
    const student = makeUser();
    authSessionResult = {
      user: { ...student },
      session: { id: 'sess-001', userId: student.id },
    };
    authShouldThrow = null;
  });

  describe('requireUser', () => {
    const app = new Hono<AppEnv>()
      .get('/public', (c) => c.json({ message: 'public' }))
      .get('/protected', requireUser, (c) => c.json({ userId: c.var.user.id, sessionId: c.var.session.id }))
      .onError(handleError);

    it('injects user and session on a valid session', async () => {
      const response = await app.request('/protected');
      const data = (await response.json()) as { userId: string; sessionId: string };

      expect(response.status).toBe(200);
      expect(data.userId).toBe('user-001');
      expect(data.sessionId).toBe('sess-001');
    });

    it('answers 401 without a session', async () => {
      authSessionResult = null;
      expect((await app.request('/protected')).status).toBe(401);
    });

    it('answers 503 when the auth service fails', async () => {
      authShouldThrow = new Error('Database down');
      expect((await app.request('/protected')).status).toBe(503);
    });

    it('leaves routes without the guard public', async () => {
      authSessionResult = null;
      const response = await app.request('/public');
      expect(response.status).toBe(200);
    });
  });

  describe('requireParent', () => {
    const app = new Hono<AppEnv>()
      .get('/parent-only', requireParent, (c) => c.json({ role: c.var.user.role }))
      .onError(handleError);

    it('lets a parent through', async () => {
      const parent = makeParentUser();
      authSessionResult = { user: { ...parent }, session: { id: 'sess-parent', userId: parent.id } };

      const response = await app.request('/parent-only');
      const data = (await response.json()) as { role: string };

      expect(response.status).toBe(200);
      expect(data.role).toBe('parent');
    });

    it('answers 403 for a student', async () => {
      expect((await app.request('/parent-only')).status).toBe(403);
    });

    it('answers 401 without a session', async () => {
      authSessionResult = null;
      expect((await app.request('/parent-only')).status).toBe(401);
    });
  });
});
