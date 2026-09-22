/**
 * Tests d'intégration - Auth Macro (lib/auth-macro.ts)
 *
 * Vérifie que le macro Elysia:
 * - Injecte user/session typés dans le contexte
 * - Retourne les bon status codes (401, 403, etc)
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { Elysia } from 'elysia';
import type { ElysiaAuthenticatedUser } from '../types/index.js';
import { createMockLogger } from './_helpers/mock-logger';

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

// Import after all mocks
const { authMacro } = await import('../lib/auth-macro.js');

// Helper fixtures
function makeUser(overrides?: Partial<ElysiaAuthenticatedUser>): ElysiaAuthenticatedUser {
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

function makeParentUser(overrides?: Partial<ElysiaAuthenticatedUser>): ElysiaAuthenticatedUser {
  return makeUser({
    email: 'parent@example.com',
    name: 'Parent User',
    role: 'parent',
    schoolLevel: undefined,
    ...overrides,
  });
}

describe('Auth Macro Integration', () => {
  beforeEach(() => {
    const student = makeUser();
    authSessionResult = {
      user: { ...student },
      session: { id: 'sess-001', userId: student.id },
    };
    authShouldThrow = null;
  });

  describe('auth: true guard', () => {
    it('should inject user/session into handler on valid auth', async () => {
      const app = new Elysia()
        .use(authMacro)
        .guard({ auth: true })
        .get('/protected', ({ user, session }) => ({
          userId: user.id,
          sessionId: session.id,
        }));

      const response = await app.handle(new Request('http://localhost/protected'));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.userId).toBe('user-001');
      expect(data.sessionId).toBe('sess-001');
    });

    it('should return 401 without valid session', async () => {
      authSessionResult = null;
      const app = new Elysia()
        .use(authMacro)
        .guard({ auth: true })
        .get('/protected', ({ user }) => ({ userId: user.id }));

      const response = await app.handle(new Request('http://localhost/protected'));
      expect(response.status).toBe(401);
    });

    it('should return 503 on auth service failure', async () => {
      authShouldThrow = new Error('Database down');
      const app = new Elysia()
        .use(authMacro)
        .guard({ auth: true })
        .get('/protected', ({ user }) => ({ userId: user.id }));

      const response = await app.handle(new Request('http://localhost/protected'));
      expect(response.status).toBe(503);
    });
  });

  describe('parentAuth: true guard', () => {
    it('should succeed for parent user', async () => {
      const parent = makeParentUser();
      authSessionResult = {
        user: { ...parent },
        session: { id: 'sess-parent', userId: parent.id },
      };

      const app = new Elysia()
        .use(authMacro)
        .guard({ parentAuth: true })
        .get('/parent-only', ({ user }) => ({ role: user.role }));

      const response = await app.handle(new Request('http://localhost/parent-only'));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.role).toBe('parent');
    });

    it('should return 403 for student user', async () => {
      const app = new Elysia()
        .use(authMacro)
        .guard({ parentAuth: true })
        .get('/parent-only', ({ user }) => ({ role: user.role }));

      const response = await app.handle(new Request('http://localhost/parent-only'));
      expect(response.status).toBe(403);
    });

    it('should return 401 without session', async () => {
      authSessionResult = null;
      const app = new Elysia()
        .use(authMacro)
        .guard({ parentAuth: true })
        .get('/parent-only', ({ user }) => ({ role: user.role }));

      const response = await app.handle(new Request('http://localhost/parent-only'));
      expect(response.status).toBe(401);
    });
  });

  describe('Mixed routes (some with guard, some without)', () => {
    it('should allow public routes alongside protected routes', async () => {
      const app = new Elysia()
        .use(authMacro)
        .get('/public', () => ({ message: 'public' }))
        .guard({ auth: true })
        .get('/protected', ({ user }) => ({ userId: user.id }));

      const publicResp = await app.handle(new Request('http://localhost/public'));
      expect(publicResp.status).toBe(200);
      const publicData = await publicResp.json();
      expect(publicData.message).toBe('public');

      const protectedResp = await app.handle(new Request('http://localhost/protected'));
      expect(protectedResp.status).toBe(200);
      const protectedData = await protectedResp.json();
      expect(protectedData.userId).toBe('user-001');
    });
  });
});
