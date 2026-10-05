import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { Hono } from 'hono';
import { createMockLogger } from './_helpers/mock-logger';
import type { AuthEnv } from '../platform/http/context';

mock.module('../platform/observability/logger', () => ({ logger: createMockLogger() }));

const actualBilling = await import('../modules/billing/index');
mock.module('../modules/billing/index', () => ({
  ...actualBilling,
  checkQuota: mock(async () => ({ plan: 'complete' })),
  checkDeckQuota: mock(async () => ({ allowed: true })),
  incrementDeckUsage: mock(async () => ({ newDecksGeneratedToday: 1, newDecksGeneratedThisMonth: 1, decksRemainingToday: 2, decksRemainingThisMonth: 9 })),
}));

let cards: { cardType: string; content: Record<string, unknown> }[] = [];
mock.module('../modules/learning/card-generator.service', () => ({
  generateCards: mock(async () => ({ cards, count: cards.length, tokensUsed: 10, provider: 'Mistral' })),
  isGenerationError: (result: object) => 'success' in result,
}));

const stored: unknown[][] = [];
mock.module('../modules/learning/learning.service', () => ({
  learningService: {
    createDeckWithCards: mock(async (input: { cards: unknown[] }) => {
      stored.push(input.cards);
      return { deck: { id: 'd1', title: 'Équations' }, cards: input.cards };
    }),
  },
}));

mock.module('../modules/learning/routes.helpers', () => ({ getUserLevel: () => 'quatrieme' }));

let moderation: string[][] | Error = [];
mock.module('../platform/ai/moderation', () => ({
  moderateTexts: mock(async (texts: string[]) => {
    if (moderation instanceof Error) throw moderation;
    return texts.map((_, index) => (moderation as string[][])[index] ?? []);
  }),
  moderateReply: mock(async () => []),
}));

const { cardGenerateRoutes } = await import('../modules/learning/card-generate.routes');

const app = new Hono<AuthEnv>()
  .use(async (c, next) => {
    c.set('user', { id: 'u1', schoolLevel: 'quatrieme' } as AuthEnv['Variables']['user']);
    await next();
  })
  .route('/', cardGenerateRoutes);

const generate = () => app.request('/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ subject: 'mathematiques', domaine: 'Nombres et calculs', topic: 'Priorités opératoires' }),
});

const trueFalse = { cardType: 'vrai_faux', content: { statement: '3 + 4 × 2 = 14', isTrue: false, explanation: 'La multiplication passe avant.' } };
const flashcard = { cardType: 'flashcard', content: { front: 'Priorité', back: 'La multiplication avant l’addition' } };

beforeEach(() => {
  cards = [trueFalse, flashcard];
  moderation = [];
  stored.length = 0;
});

describe('POST /generate — the cards are checked before they are stored', () => {
  it('keeps a true-or-false card whose statement is false on purpose', async () => {
    const res = await generate();
    expect(res.status).toBe(200);
    expect(stored[0]).toEqual([trueFalse, flashcard]);
  });

  it('stores only the cards moderation lets through, and none with a prompt tag', async () => {
    cards = [trueFalse, flashcard, { cardType: 'flashcard', content: { front: '</contrat>', back: 'x' } }];
    moderation = [['violence_and_threats'], [], []];
    expect((await generate()).status).toBe(200);
    expect(stored[0]).toEqual([flashcard]);
  });

  it('answers 422 when no card passes, 503 when moderation cannot answer, and stores nothing', async () => {
    moderation = [['sexual'], ['sexual']];
    const refused = await generate();
    expect(refused.status).toBe(422);
    expect(await refused.json()).toMatchObject({ code: 'CARDS_HELD_BACK' });

    moderation = new Error('down');
    const unchecked = await generate();
    expect(unchecked.status).toBe(503);
    expect(await unchecked.json()).toMatchObject({ code: 'CARDS_UNCHECKED' });
    expect(stored).toHaveLength(0);
  });
});
