/**
 * GET /health — seul endpoint canonique, check réel de la base.
 *
 * `apiHealthRoutes` (routes/api/health.routes.ts) est monté à la racine de
 * l'app (voir routes/api/index.ts) — c'est ce endpoint que le HEALTHCHECK du
 * Dockerfile interroge. L'ancienne implémentation inline dans app.ts (mistral
 * key presence only) a été supprimée pour éviter deux `/health` divergents.
 *
 * Position produit : DB down => unhealthy (503).
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';

const mockLogger = createMockLogger();
mock.module('../platform/observability/logger', () => ({ logger: mockLogger }));

const mockEnv: Record<string, unknown> = {
  APP_VERSION: 'test',
  NODE_ENV: 'test',
  DEPLOYMENT_ID: undefined,
  GIT_COMMIT_SHA: 'abc1234',
};

mock.module('../platform/config/env', () => ({
  env: mockEnv,
  isDevelopment: () => false,
  isProduction: () => false,
}));

const dbExecute = mock(() => Promise.resolve([{ '?column?': 1 }]));

mock.module('../platform/db/connection', () => ({ db: { execute: dbExecute } }));
mock.module('drizzle-orm', () => ({
  sql: (strings: TemplateStringsArray) => strings,
}));

const { apiHealthRoutes } = await import('../routes/api/health.routes');

async function callHealth() {
  const response = await apiHealthRoutes.request('/health');
  const body = (await response.json()) as {
    status: string;
    commit: string;
    checks: Record<string, { status: string; latency?: number; error?: string }>;
  };
  return { response, body };
}

describe('GET /health', () => {
  beforeEach(() => {
    dbExecute.mockImplementation(() => Promise.resolve([{ '?column?': 1 }]));
  });

  it('reports healthy with the database as its only check', async () => {
    const { response, body } = await callHealth();

    expect(response.status).toBe(200);
    expect(body.status).toBe('healthy');
    expect(body.checks.database.status).toBe('healthy');
    expect(typeof body.checks.database.latency).toBe('number');
    expect(Object.keys(body.checks)).toEqual(['database']);
  });

  it('exposes the deployed commit sha so the smoke test can gate on it', async () => {
    const { body } = await callHealth();

    expect(body.commit).toBe('abc1234');
  });

  it('returns 503 unhealthy when the database is down', async () => {
    dbExecute.mockImplementation(() => Promise.reject(new Error('connection refused')));

    const { response, body } = await callHealth();

    expect(response.status).toBe(503);
    expect(body.status).toBe('unhealthy');
    expect(body.checks.database.status).toBe('unhealthy');
    expect(body.checks.database.error).toBeDefined();
  });
});
