/**
 * GET /health — seul endpoint canonique, checks réels ai-service + Qdrant.
 *
 * `apiHealthRoutes` (routes/api/health.routes.ts) est monté à la racine de
 * l'app (voir routes/api/index.ts) — c'est ce endpoint que le HEALTHCHECK du
 * Dockerfile interroge. L'ancienne implémentation inline dans app.ts (mistral
 * key presence only) a été supprimée pour éviter deux `/health` divergents.
 *
 * Position produit : DB down => unhealthy (503) ; ai-service/qdrant down => degraded
 * (200, l'app reste utilisable en mode dégradé) ; non configuré => not_configured,
 * sans impact sur le statut global.
 */

import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { Elysia } from 'elysia';
import { createMockLogger } from './_helpers/mock-logger';

const mockLogger = createMockLogger();
mock.module('../lib/observability', () => ({ logger: mockLogger }));

const mockEnv: Record<string, unknown> = {
  APP_VERSION: 'test',
  NODE_ENV: 'test',
  DEPLOYMENT_ID: undefined,
  GIT_COMMIT_SHA: 'abc1234',
  AI_SERVICE_URL: undefined,
  AI_SERVICE_TOKEN: undefined,
  QDRANT_URL: undefined,
  QDRANT_API_KEY: undefined,
  QDRANT_ENABLED: 'false',
};

mock.module('../config/env', () => ({
  env: mockEnv,
  isDevelopment: () => false,
  isProduction: () => false,
}));

const dbExecute = mock(() => Promise.resolve([{ '?column?': 1 }]));

mock.module('../db/connection', () => ({ db: { execute: dbExecute } }));
mock.module('drizzle-orm', () => ({
  sql: (strings: TemplateStringsArray) => strings,
}));
mock.module('../services/memory-cache.service', () => ({
  cacheService: { healthCheck: () => ({ status: 'healthy', client: 'memory', latency: 0 }) },
}));

const { apiHealthRoutes } = await import('../routes/api/health.routes');

const originalFetch = globalThis.fetch;

function mockFetchByUrl(handlers: Record<string, () => Response | Promise<Response>>) {
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
    for (const [pattern, handler] of Object.entries(handlers)) {
      if (url.includes(pattern)) return handler();
    }
    throw new Error(`Unhandled fetch in test: ${url}`);
  }) as unknown as typeof fetch;
}

async function callHealth() {
  const app = new Elysia().use(apiHealthRoutes);
  const response = await app.handle(new Request('http://localhost/health'));
  const body = (await response.json()) as {
    status: string;
    commit: string;
    checks: Record<string, { status: string; latency?: number; error?: string }>;
  };
  return { response, body };
}

describe('GET /health', () => {
  beforeEach(() => {
    mockEnv.AI_SERVICE_URL = undefined;
    mockEnv.AI_SERVICE_TOKEN = undefined;
    mockEnv.QDRANT_URL = undefined;
    mockEnv.QDRANT_API_KEY = undefined;
    mockEnv.QDRANT_ENABLED = 'false';
    dbExecute.mockImplementation(() => Promise.resolve([{ '?column?': 1 }]));
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('reports ai-service as not_configured when AI_SERVICE_URL is unset, without affecting global status', async () => {
    const { response, body } = await callHealth();

    expect(response.status).toBe(200);
    expect(body.status).toBe('healthy');
    expect(body.checks.aiService).toEqual({ status: 'not_configured' });
  });

  it('exposes the deployed commit sha so the smoke test can gate on it', async () => {
    const { body } = await callHealth();

    expect(body.commit).toBe('abc1234');
  });

  it('reports ai-service healthy with latency when configured and reachable', async () => {
    mockEnv.AI_SERVICE_URL = 'http://ai-service:8001';
    mockFetchByUrl({
      'ai-service:8001/health': () => new Response(null, { status: 200 }),
    });

    const { response, body } = await callHealth();

    expect(response.status).toBe(200);
    expect(body.status).toBe('healthy');
    expect(body.checks.aiService.status).toBe('healthy');
    expect(typeof body.checks.aiService.latency).toBe('number');
  });

  it('degrades (200) when ai-service is configured but unreachable', async () => {
    mockEnv.AI_SERVICE_URL = 'http://ai-service:8001';
    mockFetchByUrl({
      'ai-service:8001/health': () => {
        throw new Error('fetch failed');
      },
    });

    const { response, body } = await callHealth();

    expect(response.status).toBe(200);
    expect(body.status).toBe('degraded');
    expect(body.checks.aiService.status).toBe('unhealthy');
    expect(body.checks.aiService.error).toBeDefined();
  });

  it('reports qdrant as not_configured when QDRANT_ENABLED is false', async () => {
    const { body } = await callHealth();

    expect(body.checks.qdrant).toEqual({ status: 'not_configured' });
  });

  it('reports qdrant healthy when enabled and reachable', async () => {
    mockEnv.QDRANT_ENABLED = 'true';
    mockEnv.QDRANT_URL = 'http://qdrant:6333';
    mockFetchByUrl({
      'qdrant:6333/healthz': () => new Response(null, { status: 200 }),
    });

    const { response, body } = await callHealth();

    expect(response.status).toBe(200);
    expect(body.status).toBe('healthy');
    expect(body.checks.qdrant.status).toBe('healthy');
    expect(typeof body.checks.qdrant.latency).toBe('number');
  });

  it('degrades (200) when qdrant is enabled but unreachable', async () => {
    mockEnv.QDRANT_ENABLED = 'true';
    mockEnv.QDRANT_URL = 'http://qdrant:6333';
    mockFetchByUrl({
      'qdrant:6333/healthz': () => {
        throw new Error('fetch failed');
      },
    });

    const { response, body } = await callHealth();

    expect(response.status).toBe(200);
    expect(body.status).toBe('degraded');
    expect(body.checks.qdrant.status).toBe('unhealthy');
    expect(body.checks.qdrant.error).toBeDefined();
  });

  it('returns 503 unhealthy when the database is down, even if ai-service/qdrant are healthy', async () => {
    mockEnv.AI_SERVICE_URL = 'http://ai-service:8001';
    mockEnv.QDRANT_ENABLED = 'true';
    mockEnv.QDRANT_URL = 'http://qdrant:6333';
    mockFetchByUrl({
      'ai-service:8001/health': () => new Response(null, { status: 200 }),
      'qdrant:6333/healthz': () => new Response(null, { status: 200 }),
    });
    dbExecute.mockImplementation(() => Promise.reject(new Error('connection refused')));

    const { response, body } = await callHealth();

    expect(response.status).toBe(503);
    expect(body.status).toBe('unhealthy');
    expect(body.checks.database.status).toBe('unhealthy');
  });
});
