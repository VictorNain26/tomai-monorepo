/**
 * Tests unitaires - API Endpoints (app.ts + api.routes.ts)
 * Mock: DB, auth, services, non-essential route modules
 * Tests the real Hono app composition via app.request()
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { Hono, type Context } from 'hono';
import { fakeWebBuild } from '../tests/_helpers/boot-env';
import { createMockLogger } from '../tests/_helpers/mock-logger';

const SESSION_ID = '0199a3c4-7b1e-7d2a-9f00-123456789abc';

// ============================================
// MOCKS
// ============================================

const mockLogger = createMockLogger();
mock.module('../platform/observability/logger', () => ({ logger: mockLogger }));

// DB mock — mutable for health check tests
let dbHealthy = true;
mock.module('../db/connection', () => ({
  db: {
    execute: mock(async () => {
      if (!dbHealthy) throw new Error('Connection refused');
      return [{ count: 5 }];
    }),
    insert: mock(() => ({
      values: mock(() => ({
        onConflictDoUpdate: mock(async () => ({})),
      })),
    })),
    delete: mock(() => ({
      where: mock(async () => ({})),
    })),
  },
}));

mock.module('drizzle-orm', () => ({
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
  eq: (...args: unknown[]) => ({ type: 'eq', args }),
  and: (...args: unknown[]) => ({ type: 'and', args }),
}));

// Better Auth handler, mounted on /api/auth/* only
mock.module('../platform/auth/auth', () => ({
  auth: {
    handler: (req: Request) => {
      const url = new URL(req.url);
      if (url.pathname.startsWith('/api/auth')) {
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('', { status: 404 });
    },
  },
}));

// A web build, served by the app after its API routes.
const WEB_DIST_DIR = fakeWebBuild();

mock.module('../platform/config/env', () => ({
  env: {
    NODE_ENV: 'test',
    MISTRAL_API_KEY: 'test-key',
    MISTRAL_SERVER_URL: 'https://api.eu.mistral.ai',
    BETTER_AUTH_SECRET: 'test-secret-for-unit-tests-min-32-chars!',
    BETTER_AUTH_URL: 'http://localhost:3000',
    WEB_DIST_DIR,
  },
  isDevelopment: () => false,
  isProduction: () => true,
  getDatabaseUrl: () => 'postgresql://test:test@localhost/test',
}));

// Infrastructure mocks. The limiter only marks what it counts.
mock.module('../platform/http/rate-limit', () => ({
  createRateLimitMiddleware: () => async (c: Context, next: () => Promise<void>) => {
    c.header('X-RateLimit-Limit', '100');
    await next();
  },
  RateLimitPresets: { api: {} },
}));

// Auth middleware — mutable user for auth tests
let authUser: Record<string, unknown> | null = null;
mock.module('../platform/auth/session', () => ({
  requireAuth: mock(async () => {
    if (!authUser) {
      return {
        success: false as const,
        _error: 'Unauthorized',
        status: 401,
      };
    }
    return {
      success: true as const,
      user: authUser,
      session: { id: 'session-001' },
    };
  }),
  requireParentRole: mock(async () => {
    if (!authUser) {
      return {
        success: false as const,
        _error: 'Unauthorized',
        status: 401,
      };
    }
    if (authUser['role'] !== 'parent') {
      return {
        success: false as const,
        _error: 'Parent role required',
        status: 403,
      };
    }
    return {
      success: true as const,
      user: authUser,
      session: { id: 'session-001' },
    };
  }),
}));

// Services used by apiRoutes
mock.module('../modules/tutor/chat-session.service', () => ({
  chatSessionService: {
    getOrCreateActiveSession: mock(async () => 'session-001'),
    deleteSession: mock(async () => {}),
    getUserSessions: mock(async () => []),
    getSession: mock(async (sessionId: string) => ({
      id: sessionId,
      userId: 'user-001',
      subject: 'test',
      startedAt: new Date(),
      endedAt: null,
    })),
    getSessionForUser: mock(async (sessionId: string, userId: string) =>
      userId === 'user-001'
        ? {
            id: sessionId,
            userId: 'user-001',
            subject: 'test',
            startedAt: new Date(),
            endedAt: null,
          }
        : null,
    ),
    resetSession: mock(async () => 'session-new'),
  },
}));

mock.module('../modules/tutor/chat-message.service', () => ({
  chatMessageService: {
    getSessionHistory: mock(async () => [{ id: 'msg-1', role: 'user', content: 'Hello', createdAt: new Date(), aiModel: null, attachedFile: null }]),
    getMessageById: mock(async () => null),
  },
}));

mock.module('../modules/family/parent.service', () => ({
  parentService: {
    getParentChildren: mock(async () => []),
    getParentDashboardMetrics: mock(async () => []),
  },
}));

// Mock non-essential route modules as empty Hono apps
mock.module('../modules/tutor/chat-message.routes', () => ({ chatMessageRoutes: new Hono() }));
mock.module('../modules/documents/upload.routes', () => ({ uploadRoutes: new Hono() }));
mock.module('../modules/documents/file-context.service', () => ({ fileContextService: {} }));
mock.module('../modules/family/subscription.routes', () => ({ subscriptionRoutes: new Hono() }));
mock.module('../modules/voice/index', () => ({ voiceRoutes: new Hono() }));
mock.module('../modules/learning/index', () => ({
  learningRoutes: new Hono(),
  learningService: {},
  generateCards: async () => ({ cards: [] }),
  getLevelConfig: () => ({}),
}));

// DB schema + repositories
// The mock must spread all real sub-modules so that other integration tests
// sharing this Bun process (single module registry) can still import named
// exports such as `user`, `parentChild`, etc.
import * as authSchema from '../modules/auth/auth.schema';
import * as familySchema from '../modules/family/family.schema';
import * as sessionSchema from '../modules/tutor/session.schema';
import * as costTrackingSchema from '../modules/billing/cost-tracking.schema';
import * as billingSchema from '../modules/billing/billing.schema';
import * as filesSchema from '../modules/documents/files.schema';
import * as decksSchema from '../modules/learning/decks.schema';
mock.module('../db/schema', () => ({
  ...authSchema,
  ...familySchema,
  ...sessionSchema,
  ...costTrackingSchema,
  ...billingSchema,
  ...filesSchema,
  ...decksSchema,
}));
mock.module('../modules/documents/files.repository', () => ({
  filesRepository: { findByUserId: mock(async () => []), findById: mock(async () => null) },
}));
mock.module('../modules/documents/session-files.repository', () => ({
  sessionFilesRepository: {
    findBySession: mock(async () => []),
    countBySession: mock(async () => 0),
    attach: mock(async () => {}),
    detach: mock(async () => {}),
  },
}));

interface ApiBody {
  status?: string;
  timestamp?: string;
  success?: boolean;
  sessionId?: string;
  requestId?: string;
  messages?: { role: string }[];
  checks?: { database?: { status: string }; cache?: unknown };
  error?: string | { code: string };
}

async function readBody(res: Response): Promise<ApiBody> {
  return (await res.json()) as ApiBody;
}

// Import real app after all mocks
const { app } = await import('../app');

beforeEach(() => {
  dbHealthy = true;
  authUser = null;
});

// ============================================
// TESTS
// ============================================

// What a browser sends when it navigates to a page.
const NAVIGATION = { Accept: 'text/html' };

describe('API Endpoints', () => {
  describe('web client', () => {
    it('serves the web build at /, under the CSP', async () => {
      const res = await app.fetch(new Request('http://localhost/', { headers: NAVIGATION }));
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toStartWith('text/html');
      expect(res.headers.get('content-security-policy')).toContain("default-src 'self'");
      expect(await res.text()).toContain('<title>Tom</title>');
    });

    it('hands a client route to index.html', async () => {
      const res = await app.fetch(new Request('http://localhost/parent/enfants', { headers: NAVIGATION }));
      expect(res.status).toBe(200);
      expect(await res.text()).toContain('<title>Tom</title>');
    });

    it('keeps an unknown /api route a JSON 404', async () => {
      const res = await app.fetch(new Request('http://localhost/api/nope'));
      expect(res.status).toBe(404);
      expect(((await readBody(res)).error as { code: string }).code).toBe('NOT_FOUND');
    });

    it('counts API requests against the rate limit, never the files of the web client', async () => {
      const limited = async (path: string) =>
        (await app.fetch(new Request(`http://localhost${path}`, { headers: NAVIGATION }))).headers.has('X-RateLimit-Limit');
      expect(await limited('/')).toBe(false);
      expect(await limited('/parent/enfants')).toBe(false);
      expect(await limited('/health')).toBe(true);
      expect(await limited('/api')).toBe(true);
      expect(await limited('/api/nope')).toBe(true);
    });
  });

  describe('GET /health', () => {
    it('should return healthy when all services OK (root path — canonical, not /api/health)', async () => {
      const res = await app.fetch(new Request('http://localhost/health'));
      expect(res.status).toBe(200);
      const data = await readBody(res);
      expect(data.status).toBe('healthy');
      expect(data.checks?.database?.status).toBe('healthy');
      expect(data.checks?.cache).toBeUndefined();
    });

    it('should return unhealthy 503 when database down', async () => {
      dbHealthy = false;
      const res = await app.fetch(new Request('http://localhost/health'));
      expect(res.status).toBe(503);
      const data = await readBody(res);
      expect(data.status).toBe('unhealthy');
      expect(data.checks?.database?.status).toBe('unhealthy');
    });

    it('should include version and environment info', async () => {
      const res = await app.fetch(new Request('http://localhost/health'));
      const data = await readBody(res);
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('environment');
      expect(data.timestamp).toBeDefined();
      expect(data).toHaveProperty('deployment');
    });

    it('no longer exposes a duplicate /api/health (single canonical endpoint)', async () => {
      const res = await app.fetch(new Request('http://localhost/api/health'));
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/chat/session', () => {
    it('should return 401 without authentication', async () => {
      const res = await app.fetch(
        new Request('http://localhost/api/chat/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      expect(res.status).toBe(401);
    });

    it('should create session when authenticated', async () => {
      authUser = { id: 'user-001', firstName: 'Tom', role: 'student', schoolLevel: 'troisieme' };
      const res = await app.fetch(
        new Request('http://localhost/api/chat/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      expect(res.status).toBe(200);
      const data = await readBody(res);
      expect(data.success).toBe(true);
      expect(data.sessionId).toBe('session-001');
    });
  });

  describe('GET /api/chat/session/:id/history', () => {
    it('should return 401 without authentication', async () => {
      const res = await app.fetch(new Request(`http://localhost/api/chat/session/${SESSION_ID}/history`));
      expect(res.status).toBe(401);
    });

    it('should return messages when authenticated and session is owned', async () => {
      authUser = { id: 'user-001', firstName: 'Tom', role: 'student' };
      const res = await app.fetch(new Request(`http://localhost/api/chat/session/${SESSION_ID}/history`));
      expect(res.status).toBe(200);
      const data = await readBody(res);
      expect(data.success).toBe(true);
      expect(data.messages?.length).toBe(1);
      expect(data.messages?.[0]?.role).toBe('user');
    });

    it('should return 403 when session belongs to another user (IDOR regression)', async () => {
      authUser = { id: 'user-002', firstName: 'Alice', role: 'student' };
      // chatService.getSession mock returns session owned by 'user-001'
      const res = await app.fetch(new Request(`http://localhost/api/chat/session/${SESSION_ID}/history`));
      expect(res.status).toBe(403);
      const data = await readBody(res);
      expect(data.error).toBe('Session not found or access denied');
    });

    it('should reject a non-UUID id with 400 before any service call', async () => {
      authUser = { id: 'user-001', firstName: 'Tom', role: 'student' };
      const res = await app.fetch(new Request('http://localhost/api/chat/session/not-a-uuid/history'));
      expect(res.status).toBe(400);
      const data = await readBody(res);
      expect(data.error).toMatchObject({ code: 'VALIDATION_ERROR' });
    });
  });

  describe('DELETE /api/chat/session/:id', () => {
    it('should return 401 without authentication', async () => {
      const res = await app.fetch(new Request(`http://localhost/api/chat/session/${SESSION_ID}`, { method: 'DELETE' }));
      expect(res.status).toBe(401);
    });

    it('should delete session when authenticated', async () => {
      authUser = { id: 'user-001', firstName: 'Tom', role: 'student' };
      const res = await app.fetch(new Request(`http://localhost/api/chat/session/${SESSION_ID}`, { method: 'DELETE' }));
      expect(res.status).toBe(200);
      const data = await readBody(res);
      expect(data.success).toBe(true);
    });
  });

  describe('POST /api/chat/session/:id/reset', () => {
    it('should reset session when authenticated', async () => {
      authUser = { id: 'user-001', firstName: 'Tom', role: 'student' };
      const res = await app.fetch(
        new Request(`http://localhost/api/chat/session/${SESSION_ID}/reset`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        }),
      );
      expect(res.status).toBe(200);
      const data = await readBody(res);
      expect(data.success).toBe(true);
      expect(data.sessionId).toBe('session-new');
    });
  });

  describe('Malformed JSON body', () => {
    it('answers 400 with the error envelope', async () => {
      authUser = { id: 'user-001', firstName: 'Tom', role: 'student' };
      const res = await app.fetch(
        new Request('http://localhost/api/chat/session/0199a3c4-7b1e-7d2a-9f00-123456789abc/files', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{bad',
        }),
      );
      expect(res.status).toBe(400);
      const data = await readBody(res);
      expect(data.error).toMatchObject({ code: 'VALIDATION_ERROR' });
      expect(data.requestId).toBeTruthy();
    });
  });

  describe('Unknown routes', () => {
    it('should return 404 for unknown route', async () => {
      const res = await app.fetch(new Request('http://localhost/api/nonexistent'));
      expect(res.status).toBe(404);
    });
  });
});
