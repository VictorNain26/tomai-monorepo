import { describe, it, expect, mock, beforeEach } from 'bun:test';
import { Hono } from 'hono';
import { createMockLogger } from './_helpers/mock-logger';
import type { AppEnv } from '../platform/http/context';

mock.module('../platform/observability/logger', () => ({ logger: createMockLogger() }));
mock.module('../platform/auth/session', () => {
  const signedIn = () => Promise.resolve({ success: true as const, user: { id: 'student-1', role: 'student', schoolLevel: 'sixieme' }, session: {} });
  return { requireAuth: signedIn, requireParentRole: signedIn };
});

const createDeckWithCards = mock(async () => ({ deck: { id: 'deck-1' } }));
const updateDeckOrThrow = mock(async () => ({ id: 'deck-1' }));
mock.module('../modules/learning/learning.service', () => ({
  learningService: { createDeckWithCards, updateDeckOrThrow },
  DeckNotFoundError: class extends Error {},
  DeckOwnershipError: class extends Error {},
  CardNotFoundError: class extends Error {},
  CardValidationError: class extends Error {},
}));

const { deckRoutes } = await import('../modules/learning/deck.routes');
const { handleError } = await import('../platform/http/error-handler');
const { requireUser } = await import('../platform/http/context');

const app = new Hono<AppEnv>();
app.onError(handleError);
app.use(requireUser);
app.route('/api/learning', deckRoutes);

const DECK_ID = '0199a3c4-7b1e-7d2a-9f00-0000000000d1';
const send = (method: 'POST' | 'PATCH', path: string, body: unknown) => app.request(path, {
  method,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});
const deck = { title: 'Fractions', subject: 'mathematiques', source: 'prompt' };

beforeEach(() => {
  createDeckWithCards.mockClear();
  updateDeckOrThrow.mockClear();
});

describe('POST /api/learning/decks', () => {
  it('creates a deck for a collège subject', async () => {
    expect((await send('POST', '/api/learning/decks', deck)).status).toBe(200);
    expect(createDeckWithCards).toHaveBeenCalledTimes(1);
  });

  it('refuses a free-text or lycée subject, and the removed rag_program source', async () => {
    for (const body of [{ ...deck, subject: 'Mathématiques' }, { ...deck, subject: 'philosophie' }, { ...deck, source: 'rag_program' }]) {
      expect((await send('POST', '/api/learning/decks', body)).status).toBe(400);
    }
    expect(createDeckWithCards).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/learning/decks/:id', () => {
  it('renames the subject to a collège slug, and refuses any other', async () => {
    expect((await send('PATCH', `/api/learning/decks/${DECK_ID}`, { subject: 'svt' })).status).toBe(200);
    expect((await send('PATCH', `/api/learning/decks/${DECK_ID}`, { subject: 'nsi' })).status).toBe(400);
    expect(updateDeckOrThrow).toHaveBeenCalledTimes(1);
  });
});
