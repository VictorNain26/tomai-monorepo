/**
 * Tests unitaires - API Endpoints (app.ts + api.routes.ts)
 * Mock: DB, auth, services, non-essential route modules
 * Tests the real Elysia app composition via app.handle()
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { Elysia } from 'elysia';
import { createMockLogger } from '../tests/_helpers/mock-logger';

// ============================================
// MOCKS
// ============================================

const mockLogger = createMockLogger();
mock.module('../lib/observability', () => ({ logger: mockLogger }));

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

// Better Auth handler mount — returns 404 for non-auth paths (Elysia falls through)
mock.module('../lib/auth', () => ({
  auth: {
    handler: (req: Request) => {
      const url = new URL(req.url);
      if (url.pathname.startsWith('/api/auth')) {
        return new Response(JSON.stringify({ ok: true }), {
          status: 200, headers: { 'Content-Type': 'application/json' },
        });
      }
      return new Response('', { status: 404 });
    },
  },
}));

// App config — mutable Gemini key for degraded test
let hasGeminiKey = true;
mock.module('../config/app.config', () => ({
  appConfig: {
    ai: {
      gemini: {
        get apiKey() { return hasGeminiKey ? 'test-key' : ''; },
        model: 'gemini-2.5-flash',
      },
    },
    security: { corsOrigins: ['http://localhost:3001'] },
  },
}));

mock.module('../config/environment.config', () => ({
  env: { NODE_ENV: 'test', APP_VERSION: '1.0.0', DEPLOYMENT_ID: 'test' },
  envUtils: { isDevelopment: false },
}));

// Cache service
mock.module('../services/memory-cache.service', () => ({
  cacheService: {
    healthCheck: mock(() => ({ status: 'healthy', latency: 1 })),
    get: mock(() => null),
    set: mock(() => true),
    delete: mock(() => true),
    invalidateByPattern: mock(() => 0),
  },
  memoryCacheService: { get: mock(() => null), set: mock(() => true) },
}));

// Infrastructure mocks
mock.module('../lib/encryption', () => ({ validateEncryptionSetup: mock(async () => true) }));
mock.module('../middleware/memory-monitor.middleware', () => ({
  memoryMonitor: { startMonitoring: mock(() => {}) },
}));
mock.module('../middleware/rate-limit.middleware', () => ({
  createRateLimitMiddleware: mock(() => () => {}),
  RateLimitPresets: { api: {} },
}));
mock.module('../services/token-quota.service', () => ({
  tokenQuotaService: { resetAllDailyTokens: mock(async () => ({ resetCount: 0 })) },
}));

// Stripe disabled (no env var)
mock.module('../lib/stripe', () => ({ isStripeEnabled: mock(() => false) }));

// Auth middleware — mutable user for auth tests
let authUser: Record<string, unknown> | null = null;
mock.module('../middleware/auth.middleware', () => ({
  handleAuthWithCookies: mock(async (_h: Headers, set: { status: number }) => {
    if (!authUser) {
      set.status = 401;
      return { success: false as const, error: { _error: 'Unauthorized' } };
    }
    return { success: true as const, user: authUser };
  }),
  handleParentAuthWithCookies: mock(async (_h: Headers, set: { status: number }) => {
    if (!authUser || authUser.role !== 'parent') {
      set.status = authUser ? 403 : 401;
      return { success: false as const, error: { _error: 'Forbidden' } };
    }
    return { success: true as const, user: authUser };
  }),
}));

// Services used by apiRoutes
mock.module('../services/chat.service', () => ({
  chatService: {
    getOrCreateActiveSession: mock(async () => 'session-001'),
    getSessionHistory: mock(async () => [
      { id: 'msg-1', role: 'user', content: 'Hello', createdAt: new Date(), aiModel: null, attachedFile: null },
    ]),
    deleteSession: mock(async () => {}),
    getUserSessions: mock(async () => []),
    getSession: mock(async () => null),
    getMessageById: mock(async () => null),
    resetSession: mock(async () => 'session-new'),
  },
}));

mock.module('../services/parent.service', () => ({
  parentService: {
    getParentChildren: mock(async () => []),
    getParentDashboardMetrics: mock(async () => []),
  },
}));

mock.module('../services/progress.service', () => ({
  progressService: {
    getStudentStats: mock(async () => ({
      totalSessions: 5, totalStudyTime: 120, conceptsLearned: 10, averageFrustration: 1.5,
    })),
  },
}));

mock.module('../schemas/validation', () => ({
  validateSchema: mock((_s: unknown, data: unknown) => ({ data })),
  isValidationError: mock(() => false),
  createChildSchema: {},
  updateChildSchema: {},
}));

// Mock non-essential route modules as empty Elysia plugins
mock.module('../routes/chat-message.routes', () => ({ chatMessageRoutes: new Elysia() }));
mock.module('../routes/file-upload.routes', () => ({ fileUploadRoutes: new Elysia() }));
mock.module('../routes/subscription/index', () => ({
  checkoutRoutes: new Elysia(), childrenRoutes: new Elysia(),
  statusRoutes: new Elysia(), lifecycleRoutes: new Elysia(),
}));
mock.module('../routes/tts.routes', () => ({ ttsRoutes: new Elysia() }));
mock.module('../routes/learning/index', () => ({
  deckRoutes: new Elysia(), cardRoutes: new Elysia(), fsrsRoutes: new Elysia(), fsrsExtraRoutes: new Elysia(),
}));
mock.module('../routes/waitlist.routes', () => ({ waitlistRoutes: new Elysia() }));

// DB schema + repositories (dynamic imports in apiRoutes)
mock.module('../db/schema', () => ({
  devicePushTokens: { token: 'token', userId: 'userId' },
}));
mock.module('../db/repositories/index', () => ({
  filesRepository: { findByUserId: mock(async () => []), findById: mock(async () => null) },
  sessionFilesRepository: {
    findBySession: mock(async () => []), countBySession: mock(async () => 0),
    attach: mock(async () => {}), detach: mock(async () => {}),
  },
}));

// Gemini mock for /health/ai
mock.module('@google/genai', () => ({
  GoogleGenAI: class { models = { generateContent: mock(async () => ({ text: 'OK' })) }; },
}));

// Import real app after all mocks
const { app } = await import('../app');

beforeEach(() => {
  dbHealthy = true;
  hasGeminiKey = true;
  authUser = null;
});

// ============================================
// TESTS
// ============================================

describe('API Endpoints', () => {
  describe('GET /', () => {
    it('should return operational status', async () => {
      const res = await app.handle(new Request('http://localhost/'));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('operational');
    });
  });

  describe('GET /health', () => {
    it('should return healthy when all services OK', async () => {
      const res = await app.handle(new Request('http://localhost/health'));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('healthy');
      expect(data.checks.database.status).toBe('healthy');
      expect(data.checks.cache.status).toBe('healthy');
      expect(data.checks.ai.status).toBe('healthy');
    });

    it('should return degraded when Gemini key missing', async () => {
      hasGeminiKey = false;
      const res = await app.handle(new Request('http://localhost/health'));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('degraded');
      expect(data.checks.ai.status).toBe('unhealthy');
    });

    it('should return unhealthy 503 when database down', async () => {
      dbHealthy = false;
      const res = await app.handle(new Request('http://localhost/health'));
      expect(res.status).toBe(503);
      const data = await res.json();
      expect(data.status).toBe('unhealthy');
      expect(data.checks.database.status).toBe('unhealthy');
    });

    it('should include version and environment info', async () => {
      const res = await app.handle(new Request('http://localhost/health'));
      const data = await res.json();
      expect(data.version).toBe('1.0.0');
      expect(data.environment).toBe('test');
      expect(data.timestamp).toBeDefined();
      expect(data.deployment).toBe('test');
    });
  });

  describe('POST /api/chat/session', () => {
    it('should return 401 without authentication', async () => {
      const res = await app.handle(new Request('http://localhost/api/chat/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }));
      expect(res.status).toBe(401);
    });

    it('should create session when authenticated', async () => {
      authUser = { id: 'user-001', firstName: 'Tom', role: 'student', schoolLevel: 'troisieme' };
      const res = await app.handle(new Request('http://localhost/api/chat/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.sessionId).toBe('session-001');
    });
  });

  describe('GET /api/chat/session/:id/history', () => {
    it('should return 401 without authentication', async () => {
      const res = await app.handle(new Request('http://localhost/api/chat/session/s1/history'));
      expect(res.status).toBe(401);
    });

    it('should return messages when authenticated', async () => {
      authUser = { id: 'user-001', firstName: 'Tom', role: 'student' };
      const res = await app.handle(new Request('http://localhost/api/chat/session/s1/history'));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.messages.length).toBe(1);
      expect(data.messages[0].role).toBe('user');
    });
  });

  describe('DELETE /api/chat/session/:id', () => {
    it('should return 401 without authentication', async () => {
      const res = await app.handle(new Request('http://localhost/api/chat/session/s1', { method: 'DELETE' }));
      expect(res.status).toBe(401);
    });

    it('should delete session when authenticated', async () => {
      authUser = { id: 'user-001', firstName: 'Tom', role: 'student' };
      const res = await app.handle(new Request('http://localhost/api/chat/session/s1', { method: 'DELETE' }));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });
  });

  describe('POST /api/chat/session/:id/reset', () => {
    it('should reset session when authenticated', async () => {
      authUser = { id: 'user-001', firstName: 'Tom', role: 'student' };
      const res = await app.handle(new Request('http://localhost/api/chat/session/s1/reset', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
      }));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.sessionId).toBe('session-new');
    });
  });

  describe('Unknown routes', () => {
    it('should return 404 for unknown route', async () => {
      const res = await app.handle(new Request('http://localhost/api/nonexistent'));
      expect(res.status).toBe(404);
    });
  });
});
