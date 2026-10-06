/**
 * The learning and upload modules apply requireUser once, at their mount
 * point, and their handlers read c.var.user unguarded: an unauthenticated
 * request must stop at 401, never reach a handler.
 */

import { describe, it, expect, mock } from 'bun:test';
import { Hono } from 'hono';
import { createMockLogger } from './_helpers/mock-logger';
import type { AppEnv } from '../platform/http/context';

mock.module('../platform/observability/logger', () => ({ logger: createMockLogger() }));
mock.module('../platform/auth/session', () => {
  const unauthorized = () => Promise.resolve({ success: false as const, _error: 'Unauthorized', status: 401 as const });
  return { requireAuth: unauthorized, requireParentRole: unauthorized };
});
mock.module('../platform/config/env', () => ({
  env: {},
  isProduction: () => false,
  isDevelopment: () => true,
  getCorsOrigins: () => [],
}));
mock.module('../db/connection', () => ({ db: {} }));
mock.module('../modules/billing/index', () => ({
  checkQuota: async () => ({ plan: 'premium' }),
}));
mock.module('../modules/learning/card-generator.service', () => ({ generateCards: async () => ({ cards: [] }), isGenerationError: () => false }));
mock.module('../modules/learning/learning.service', () => ({
  learningService: {},
  DeckNotFoundError: class extends Error {},
  DeckOwnershipError: class extends Error {},
  CardNotFoundError: class extends Error {},
  CardValidationError: class extends Error {},
}));
mock.module('../modules/learning/fsrs.service', () => ({ fsrsService: {}, Rating: {} }));
mock.module('../modules/documents/storage', () => ({}));
mock.module('../modules/voice/index', () => ({ getVoxtralTranscribeService: () => ({}) }));
mock.module('../modules/documents/files.repository', () => ({ filesRepository: {} }));

const { learningRoutes } = await import('../modules/learning/learning.routes');
const { uploadRoutes } = await import('../modules/documents/upload.routes');
const { handleError } = await import('../platform/http/error-handler');

const app = new Hono<AppEnv>()
  .route('/api/learning', learningRoutes)
  .route('/api/upload', uploadRoutes)
  .onError(handleError);

describe('module-level auth guards', () => {
  it.each(['/api/learning/decks', '/api/learning/due-summary', '/api/upload/status'])(
    'GET %s answers 401 without a session',
    async (path) => {
      const res = await app.request(path);
      expect(res.status).toBe(401);
      expect(((await res.json()) as { error: { code: string } }).error.code).toBe('UNAUTHORIZED');
    },
  );
});
