/**
 * Tests unitaires - Tool Executor (modules/tutor/tool-executor.ts)
 * Mock: learning, DB, logger
 *
 * Note: mock.module paths resolve from the test file location (src/tests/)
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';

// ============================================
// MOCKS — paths relative to src/tests/ (this file)
// ============================================

const mockLogger = createMockLogger();
mock.module('../platform/observability/logger', () => ({ logger: mockLogger }));

// Card generator stub, injected through the modules/learning/index mock below
let cardGenResult: Record<string, unknown> = {
  cards: [
    { cardType: 'front_back', content: { front: 'Q1', back: 'A1' } },
    { cardType: 'front_back', content: { front: 'Q2', back: 'A2' } },
  ],
  count: 2,
};

let cardGenThrows = false;
const generateCards = mock(async (_params: { owner: unknown }) => {
  if (cardGenThrows) throw new Error('mistral unreachable');
  return cardGenResult;
});

// FSRS — src/modules/learning/fsrs.service.ts
mock.module('../modules/learning/fsrs.service', () => ({
  fsrsService: {
    initializeCardFsrsData: mock(() => ({ difficulty: 0.3, stability: 0 })),
  },
}));

// DB mock — src/db/connection.ts
/** What each insert of the transaction received, in order: the deck, then its cards. */
const insertedValues: unknown[] = [];
const mockTxInsert = mock(() => ({
  values: mock((values: unknown) => {
    insertedValues.push(values);
    return { returning: mock(() => [{ id: 'deck-001', title: 'Test deck' }]) };
  }),
}));

mock.module('../db/connection', () => ({
  db: {
    transaction: mock(async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
      return fn({
        insert: mockTxInsert,
      });
    }),
  },
}));

mock.module('../modules/learning/decks.schema', () => ({
  learningDecks: {},
  learningCards: {},
}));

let moderation: string[][] | Error = [];
mock.module('../platform/ai/moderation', () => ({
  moderateTexts: mock(async (texts: string[]) => {
    if (moderation instanceof Error) throw moderation;
    return texts.map((_, index) => (moderation as string[][])[index] ?? []);
  }),
  moderateReply: mock(async () => []),
}));

// The deck is created by the real learningService and the cards checked by the real checkCards;
// generation and level config are stubbed.
const { learningService } = await import('../modules/learning/learning.service');
const { checkCards } = await import('../modules/learning/card-check');
mock.module('../modules/learning/index', () => ({
  generateCards,
  learningService,
  checkCards,
  getLevelConfig: mock(() => ({ cardsPerSession: 10 })),
}));

// Import after all mocks
const { executeTool } = await import('../modules/tutor/tool-executor');

const sheet = {
  statement: 'Résous 3x + 5 = 20.', kind: 'short' as const, answer: 'x = 5', answerForms: ['x = 5'], mathEquation: null, mathAnswer: null,
  steps: [], commonErrors: [], rule: null, facts: [], expectedElements: [], entries: [], laterEntries: [],
};
const baseContext = {
  userId: 'user-001',
  schoolLevel: 'troisieme' as const,
  sessionId: 'session-001',
  check: { sheet, uncertain: false, diagnosis: null, studentText: 'Fais-moi des cartes', pastStudentTexts: [] },
};

beforeEach(() => {
  insertedValues.length = 0;
  moderation = [];
  cardGenThrows = false;
  cardGenResult = {
    cards: [
      { cardType: 'front_back', content: { front: 'Q1', back: 'A1' } },
      { cardType: 'front_back', content: { front: 'Q2', back: 'A2' } },
    ],
    count: 2,
  };
});

describe('Tool Executor', () => {
  describe('generate_flashcards', () => {
    it('should create deck and cards in transaction', async () => {
      const result = await executeTool('generate_flashcards', {
        topic: 'Fractions', subject: 'mathematiques', cardCount: 5,
      }, baseContext) as Record<string, unknown>;
      expect(result['generated']).toBe(true);
      expect(result['deckId']).toBeDefined();
      expect(generateCards.mock.calls.at(-1)?.[0].owner).toEqual({ userId: 'user-001', sessionId: 'session-001' });
    });

    it('saves no deck when the turn was cut while the cards were written', async () => {
      mockTxInsert.mockClear();
      const cut = new AbortController();
      cut.abort();
      const result = await executeTool('generate_flashcards', { topic: 'Fractions', subject: 'mathematiques' }, baseContext, cut.signal) as Record<string, unknown>;
      expect(result).toMatchObject({ isError: true, errorCategory: 'transient' });
      expect(mockTxInsert).not.toHaveBeenCalled();
    });

    it("sets aside a card holding the exercise's answer or flagged by moderation, before storing the others", async () => {
      cardGenResult = {
        cards: [
          { cardType: 'front_back', content: { front: 'Résous 3x + 5 = 20', back: 'x = 5' } },
          { cardType: 'front_back', content: { front: 'Q2', back: 'A2' } },
          { cardType: 'front_back', content: { front: 'Q3', back: 'A3' } },
        ],
        count: 3,
      };
      moderation = [[], [], ['violence_and_threats']];

      const result = await executeTool('generate_flashcards', { topic: 'Équations', subject: 'mathematiques' }, baseContext) as Record<string, unknown>;

      expect(result).toMatchObject({ generated: true });
      expect(insertedValues[1]).toHaveLength(1);
      expect(JSON.stringify(insertedValues[1])).toContain('Q2');
    });

    it('stores no deck when no card passes, nor when moderation cannot answer, which it reports as transient', async () => {
      for (const [failing, category] of [[[['sexual'], ['sexual']], 'business'], [new Error('moderation down'), 'transient']] as const) {
        moderation = failing instanceof Error ? failing : failing.map((flags) => [...flags]);
        mockTxInsert.mockClear();
        const result = await executeTool('generate_flashcards', { topic: 'Fractions', subject: 'mathematiques' }, baseContext) as Record<string, unknown>;
        expect(result).toMatchObject({ isError: true, errorCategory: category });
        expect(mockTxInsert).not.toHaveBeenCalled();
      }
    });

    it('keeps a card false on purpose or holding a short number, and names a deck whose topic gives the answer neutrally', async () => {
      cardGenResult = {
        cards: [
          { cardType: 'vrai_faux', content: { statement: '3 × 4 = 11', isTrue: false } },
          { cardType: 'flashcard', content: { front: 'Combien font 2 + 3 ?', back: '5' } },
        ],
        count: 2,
      };

      const result = await executeTool('generate_flashcards', { topic: 'Équation : x = 5', subject: 'mathematiques' }, baseContext) as Record<string, unknown>;

      expect(result).toMatchObject({ generated: true });
      expect(insertedValues[0]).toMatchObject({ title: 'Cartes de révision' });
      expect(insertedValues[1]).toHaveLength(2);
    });

    it('should generate without a topic context', async () => {
      const result = await executeTool('generate_flashcards', {
        topic: 'Fractions', subject: 'mathematiques',
      }, baseContext) as Record<string, unknown>;
      expect(result['generated']).toBe(true);
    });
  });

  describe('Error encapsulation', () => {
    it('should never throw - encapsulates errors in return value', async () => {
      cardGenThrows = true;
      const result = await executeTool('generate_flashcards', {
        topic: 'Fractions', subject: 'mathematiques',
      }, baseContext) as Record<string, unknown>;
      expect(result['isError']).toBe(true);
      expect(result['errorCategory']).toBe('business');
    });
  });
});
