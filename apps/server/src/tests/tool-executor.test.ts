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

// Cognitive profile — src/modules/tutor/cognitive-profile.service.ts, exercised by
// tool-executor-profile.test.ts; stubbed here so that no database is reached.
mock.module('../modules/tutor/cognitive-profile.service', () => ({
  cognitiveProfileService: {
    getProfile: mock(async () => null),
    updateProfile: mock(async () => undefined),
  },
}));

// Card generator stub, injected through the modules/learning/index mock below
let cardGenResult: Record<string, unknown> = {
  cards: [
    { cardType: 'front_back', content: { front: 'Q1', back: 'A1' } },
    { cardType: 'front_back', content: { front: 'Q2', back: 'A2' } },
  ],
  count: 2,
};

let cardGenThrows = false;
const generateCards = mock(async () => {
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
const mockTxInsert = mock(() => ({
  values: mock(() => ({
    returning: mock(() => [{ id: 'deck-001', title: 'Test deck' }]),
  })),
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
  describe('unknown tool', () => {
    it('should return error for unknown tool name', async () => {
      const result = await executeTool('get_student_homework', {}, baseContext) as Record<string, unknown>;
      expect(result['isError']).toBe(true);
      expect(result['message']).toContain('Outil inconnu');
      expect(result['errorCategory']).toBe('validation');
    });
  });

  describe('generate_flashcards', () => {
    it('should create deck and cards in transaction', async () => {
      const result = await executeTool('generate_flashcards', {
        topic: 'Fractions', subject: 'mathematiques', cardCount: 5,
      }, baseContext) as Record<string, unknown>;
      expect(result['generated']).toBe(true);
      expect(result['deckId']).toBeDefined();
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

      expect(result).toMatchObject({ generated: true, cardCount: 1 });
    });

    it('stores no deck when no card passes, or when moderation cannot answer', async () => {
      for (const failing of [[['sexual'], ['sexual']], new Error('moderation down')]) {
        moderation = failing;
        mockTxInsert.mockClear();
        const result = await executeTool('generate_flashcards', { topic: 'Fractions', subject: 'mathematiques' }, baseContext) as Record<string, unknown>;
        expect(result).toMatchObject({ isError: true, errorCategory: 'business' });
        expect(mockTxInsert).not.toHaveBeenCalled();
      }
    });

    it('should generate without a topic context', async () => {
      const result = await executeTool('generate_flashcards', {
        topic: 'Fractions', subject: 'mathematiques',
      }, baseContext) as Record<string, unknown>;
      expect(result['generated']).toBe(true);
    });
  });

  describe('Unknown tool', () => {
    it('should return error message for unknown tool', async () => {
      const result = await executeTool('unknown_tool', {}, baseContext) as Record<string, unknown>;
      expect(result['isError']).toBe(true);
      expect(result['message']).toContain('Outil inconnu');
      expect(result['errorCategory']).toBe('validation');
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
