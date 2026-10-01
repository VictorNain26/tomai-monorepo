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
mock.module('../services/education.service', () => ({ educationService: {} }));
mock.module('../services/token-quota.service', () => ({
  checkQuota: async () => ({ plan: 'premium' }),
  checkDeckQuota: async () => ({ allowed: true }),
  incrementDeckUsage: async () => ({}),
}));
mock.module('../services/learning/index', () => ({ generateCards: async () => ({ cards: [] }), isGenerationError: () => false }));
mock.module('../services/learning/learning.service', () => ({
  learningService: {},
  DeckNotFoundError: class extends Error {},
  DeckOwnershipError: class extends Error {},
  CardNotFoundError: class extends Error {},
  CardValidationError: class extends Error {},
}));
mock.module('../services/fsrs.service', () => ({ fsrsService: {}, Rating: {} }));
mock.module('../services/storage/scaleway-storage.service', () => ({ scalewayStorageService: {} }));
mock.module('../modules/voice/index', () => ({ audioTranscriptionService: {} }));
mock.module('../db/repositories/index', () => ({ filesRepository: {} }));

const { learningRoutes } = await import('../routes/learning/index');
const { fileUploadRoutes } = await import('../routes/file-upload.routes');
const { handleError } = await import('../platform/http/error-handler');

const app = new Hono<AppEnv>()
  .route('/api/learning', learningRoutes)
  .route('/api/upload', fileUploadRoutes)
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
