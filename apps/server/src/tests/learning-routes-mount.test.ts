/**
 * Regression test — learning route mounting (prefix doubling).
 *
 * All learning route groups share the `/api/learning` prefix. They must be
 * mounted as SIBLINGS in routes/learning/index.ts. Nesting two same-prefix
 * Elysia instances via `.use()` stacks the prefix and produces
 * `/api/learning/api/learning/...` — a 404 on the real paths (the original bug
 * that shipped subjects/generate at doubled paths).
 *
 * We mock the load-time-heavy boundaries (env, db, auth, AI/quota services)
 * so we can import the real barrel and assert on the registered paths.
 */

import { describe, it, expect, mock } from 'bun:test';
import { Elysia } from 'elysia';
import { createMockLogger } from './_helpers/mock-logger';

mock.module('../lib/observability', () => ({ logger: createMockLogger() }));
mock.module('../config/env', () => ({
  env: {},
  isProduction: () => false,
  isDevelopment: () => true,
  getCorsOrigins: () => [],
}));
mock.module('../db/connection', () => ({ db: {} }));

// authMacro must stay a valid Elysia macro so `.guard({ auth: true })` mounts.
const authMacro = new Elysia({ name: 'auth-macro-mock' }).macro({
  auth: { resolve: () => ({ user: { id: 'u', schoolLevel: 'sixieme' }, session: {} }) },
  parentAuth: { resolve: () => ({ user: { id: 'u' }, session: {} }) },
});
mock.module('../lib/auth-macro', () => ({ authMacro }));

// Service singletons referenced by the route modules — stubbed (no I/O at load).
mock.module('../services/rag.service', () => ({ ragService: {} }));
mock.module('../services/qdrant.service', () => ({ qdrantService: {} }));
mock.module('../services/education.service', () => ({ educationService: {} }));
mock.module('../services/token-quota.service', () => ({
  checkQuota: async () => ({ plan: 'premium' }),
  checkDeckQuota: async () => ({ allowed: true }),
  incrementDeckUsage: async () => ({}),
}));
mock.module('../services/learning/index', () => ({
  generateCards: async () => ({ cards: [] }),
  isGenerationError: () => false,
}));
mock.module('../services/learning/learning.service', () => ({
  learningService: {},
  DeckNotFoundError: class extends Error {},
  DeckOwnershipError: class extends Error {},
  CardNotFoundError: class extends Error {},
  CardValidationError: class extends Error {},
}));
mock.module('../services/fsrs.service', () => ({ fsrsService: {}, Rating: {} }));

const { learningRoutes } = await import('../routes/learning/index');

describe('learning route mounting', () => {
  const paths = learningRoutes.routes.map((r) => r.path);

  it('registers no doubled-prefix paths', () => {
    const doubled = paths.filter((p) => p.includes('/api/learning/api/learning'));
    expect(doubled).toEqual([]);
  });

  it('exposes the discovery + generate endpoints at the single-prefix path', () => {
    for (const expected of [
      '/api/learning/subjects',
      '/api/learning/generate',
      '/api/learning/decks',
      '/api/learning/review',
    ]) {
      expect(paths).toContain(expected);
    }
  });
});
