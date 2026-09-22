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

mock.module('../config/env', () => ({
  env: {
    NODE_ENV: 'test',
    MISTRAL_API_KEY: 'test-key',
    BETTER_AUTH_SECRET: 'test-secret-for-unit-tests-min-32-chars!',
    BETTER_AUTH_URL: 'http://localhost:3000',
  },
  isDevelopment: () => false,
  isProduction: () => true,
  isInDocker: () => false,
  getDatabaseUrl: () => 'postgresql://test:test@localhost/test',
  getCorsOrigins: () => ['http://localhost:3001'],
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
mock.module('../lib/encryption', () => ({
  validateEncryptionSetup: mock(async () => true),
  encrypt: mock(async (v: string) => `enc:${v}`),
  decrypt: mock(async (v: string) => v.replace(/^enc:/, '')),
}));
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

// Retention purge — its real module pulls the Drizzle schemas, whose
// `relations` import the partial drizzle-orm mock above doesn't provide.
mock.module('../services/retention-purge.service', () => ({
  purgeExpiredData: mock(async () => ({ episodesDeleted: 0, profilesDeleted: 0 })),
  startRetentionPurgeScheduler: () => () => {},
}));

// Auth middleware — mutable user for auth tests
let authUser: Record<string, unknown> | null = null;
mock.module('../middleware/auth.middleware', () => ({
  requireAuth: mock(async () => {
    if (!authUser) {
      return {
        success: false as const,
        _error: 'Unauthorized',
        status: 401,
        shouldClearCookies: false
      };
    }
    return {
      success: true as const,
      user: authUser,
      session: { id: 'session-001' }
    };
  }),
  requireParentRole: mock(async () => {
    if (!authUser) {
      return {
        success: false as const,
        _error: 'Unauthorized',
        status: 401,
        shouldClearCookies: false
      };
    }
    if (authUser.role !== 'parent') {
      return {
        success: false as const,
        _error: 'Parent role required',
        status: 403,
        shouldClearCookies: false
      };
    }
    return {
      success: true as const,
      user: authUser,
      session: { id: 'session-001' }
    };
  }),
}));

// Services used by apiRoutes
mock.module('../services/chat/chat-session.service', () => ({
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
      durationMinutes: null,
      frustrationAvg: null,
      questionLevelsAvg: null,
      conceptsCovered: null,
    })),
    getSessionForUser: mock(async (sessionId: string, userId: string) =>
      userId === 'user-001'
        ? {
            id: sessionId,
            userId: 'user-001',
            subject: 'test',
            startedAt: new Date(),
            endedAt: null,
            durationMinutes: null,
            frustrationAvg: null,
            questionLevelsAvg: null,
            conceptsCovered: null,
          }
        : null
    ),
    resetSession: mock(async () => 'session-new'),
  },
}));

mock.module('../services/chat/chat-message.service', () => ({
  chatMessageService: {
    getSessionHistory: mock(async () => [
      { id: 'msg-1', role: 'user', content: 'Hello', createdAt: new Date(), aiModel: null, attachedFile: null },
    ]),
    getMessageById: mock(async () => null),
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
  statusRoutes: new Elysia(),
}));
mock.module('../routes/tts.routes', () => ({ ttsRoutes: new Elysia() }));
mock.module('../routes/learning/index', () => ({
  learningRoutes: new Elysia(),
}));
mock.module('../routes/waitlist.routes', () => ({ waitlistRoutes: new Elysia() }));
mock.module('../routes/pronote-sync.routes', () => ({ pronoteSyncRoutes: new Elysia() }));
mock.module('../routes/pronote-data.routes', () => ({ pronoteDataRoutes: new Elysia() }));
mock.module('../routes/pronote-connect.routes', () => ({ pronoteConnectRoutes: new Elysia() }));

// DB schema + repositories (dynamic imports in apiRoutes)
// The mock must spread all real sub-modules so that other integration tests
// sharing this Bun process (single module registry) can still import named
// exports such as `pronoteCredentials`, `user`, `parentChild`, etc.
import * as authSchema from '../db/schema/auth.schema';
import * as learningSchema from '../db/schema/learning.schema';
import * as pronoteSchema from '../db/schema/pronote.schema';
import * as billingSchema from '../db/schema/billing.schema';
import * as filesSchema from '../db/schema/files.schema';
import * as learningToolsSchema from '../db/schema/learning-tools.schema';
mock.module('../db/schema', () => ({
  ...authSchema,
  ...learningSchema,
  ...pronoteSchema,
  ...billingSchema,
  ...filesSchema,
  ...learningToolsSchema,
}));
mock.module('../db/repositories/index', () => ({
  filesRepository: { findByUserId: mock(async () => []), findById: mock(async () => null) },
  sessionFilesRepository: {
    findBySession: mock(async () => []), countBySession: mock(async () => 0),
    attach: mock(async () => {}), detach: mock(async () => {}),
  },
}));

// Mistral client mock for /health/ai (dynamic import in app.ts)
mock.module('../lib/ai/mistral-client', () => ({
  generateText: mock(async () => 'OK'),
}));

// Import real app after all mocks
const { app } = await import('../app');

beforeEach(() => {
  dbHealthy = true;
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
    it('should return healthy when all services OK (root path — canonical, not /api/health)', async () => {
      const res = await app.handle(new Request('http://localhost/health'));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.status).toBe('healthy');
      expect(data.checks.database.status).toBe('healthy');
      expect(data.checks.cache.status).toBe('healthy');
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
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('environment');
      expect(data.timestamp).toBeDefined();
      expect(data).toHaveProperty('deployment');
    });

    it('no longer exposes a duplicate /api/health (single canonical endpoint)', async () => {
      const res = await app.handle(new Request('http://localhost/api/health'));
      expect(res.status).toBe(404);
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

    it('should return messages when authenticated and session is owned', async () => {
      authUser = { id: 'user-001', firstName: 'Tom', role: 'student' };
      const res = await app.handle(new Request('http://localhost/api/chat/session/s1/history'));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.messages.length).toBe(1);
      expect(data.messages[0].role).toBe('user');
    });

    it('should return 403 when session belongs to another user (IDOR regression)', async () => {
      authUser = { id: 'user-002', firstName: 'Alice', role: 'student' };
      // chatService.getSession mock returns session owned by 'user-001'
      const res = await app.handle(new Request('http://localhost/api/chat/session/s1/history'));
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toBe('Session not found or access denied');
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
