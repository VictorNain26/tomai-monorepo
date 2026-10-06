import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { Hono } from 'hono';
import { createMockLogger } from './_helpers/mock-logger';
import type { AppEnv } from '../platform/http/context';

mock.module('../platform/observability/logger', () => ({ logger: createMockLogger() }));
mock.module('../platform/auth/session', () => {
  const signedIn = () => Promise.resolve({ success: true as const, user: { id: 'student-1', role: 'student', schoolLevel: 'sixieme' }, session: {} });
  return { requireAuth: signedIn, requireParentRole: signedIn };
});

const reviewCardOrThrow = mock(async () => ({
  cardId: '0199a3c4-7b1e-7d2a-9f00-0000000000c1',
  rating: 3,
  previousState: 0,
  newState: 1,
  nextDue: new Date('2026-10-03T08:00:00Z'),
  stability: 1.5,
  difficulty: 5,
  reps: 1,
  lapses: 0,
}));
mock.module('../modules/learning/learning.service', () => ({
  learningService: { reviewCardOrThrow },
  DeckNotFoundError: class extends Error {},
  DeckOwnershipError: class extends Error {},
  CardNotFoundError: class extends Error {},
  CardValidationError: class extends Error {},
}));

const { fsrsRoutes } = await import('../modules/learning/fsrs.routes');
const { handleError } = await import('../platform/http/error-handler');
const { requireUser } = await import('../platform/http/context');

const app = new Hono<AppEnv>();
app.onError(handleError);
app.use(requireUser);
app.route('/api/learning', fsrsRoutes);

const review = (rating: unknown) =>
  app.request('/api/learning/review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cardId: '0199a3c4-7b1e-7d2a-9f00-0000000000c1', rating }),
  });

beforeEach(() => {
  reviewCardOrThrow.mockClear();
});

describe('POST /api/learning/review', () => {
  it('accepts the four FSRS grades', async () => {
    for (const rating of [1, 2, 3, 4]) {
      expect((await review(rating)).status).toBe(200);
    }
    expect(reviewCardOrThrow).toHaveBeenCalledTimes(4);
  });

  it.each([0, 2.5, 5, '3'])('rejects %p before reaching the scheduler', async (rating) => {
    expect((await review(rating)).status).toBe(400);
    expect(reviewCardOrThrow).not.toHaveBeenCalled();
  });
});
