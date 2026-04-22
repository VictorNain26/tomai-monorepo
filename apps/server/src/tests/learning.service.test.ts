/**
 * Unit tests — LearningService (src/services/learning/learning.service.ts)
 *
 * Strategy:
 *  - Mock the repository modules so we verify delegation + ownership logic
 *    without hitting Postgres.
 *  - Mock `db.transaction` to a pass-through that calls the provided callback
 *    with a fake tx handle, letting us assert that `createDeckWithCards` runs
 *    both inserts inside a single transaction and rolls back on failure.
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';

const mockLogger = createMockLogger();
mock.module('../lib/observability', () => ({ logger: mockLogger }));

// --- Transaction envelope mock ---------------------------------------------
// The service calls `db.transaction(async (tx) => { ... })`. We want two
// things: (a) confirm it wraps the writes, (b) propagate exceptions so the
// outer promise rejects when the card insert throws (rollback semantics).
let transactionFailed = false;
const TX_MARKER = Symbol('tx');
const mockTransaction = mock(async (fn: (tx: unknown) => Promise<unknown>) => {
  try {
    return await fn({ [TX_MARKER]: true });
  } catch (err) {
    transactionFailed = true;
    throw err;
  }
});

mock.module('../db/connection', () => ({
  db: { transaction: mockTransaction },
}));

// --- Repository mocks -------------------------------------------------------
const mockDeckInsert = mock(async () => ({ id: 'deck-1', userId: 'user-1', cardCount: 0 }));
const mockDeckFindById = mock(async (_id: string) => null as unknown);
const mockDeckListByUser = mock(async () => [] as unknown[]);
const mockDeckUpdateById = mock(async () => ({ id: 'deck-1', title: 'updated' }));
const mockDeckDeleteById = mock(async () => {});

mock.module('../db/repositories/learning-decks.repository', () => ({
  learningDecksRepository: {
    insert: mockDeckInsert,
    findById: mockDeckFindById,
    // `findByUserAndId` is still exposed by the real repository but is no
    // longer reached by LearningService after Phase 2 (all ownership lookups
    // route through `findById` to distinguish NotFound vs Ownership errors).
    // Not mocked here — any stray call would surface as a test failure.
    listByUser: mockDeckListByUser,
    updateById: mockDeckUpdateById,
    deleteById: mockDeckDeleteById,
  },
}));

const mockCardInsertMany = mock(async () => [] as unknown[]);
const mockCardListByDeck = mock(async () => [] as unknown[]);

mock.module('../db/repositories/learning-cards.repository', () => ({
  learningCardsRepository: {
    insertMany: mockCardInsertMany,
    listByDeck: mockCardListByDeck,
  },
}));

// FSRS init is a pure helper — stub it to a deterministic shape.
mock.module('../services/fsrs.service', () => ({
  fsrsService: { initializeCardFsrsData: mock(() => ({ state: 0 })) },
}));

const { learningService } = await import('../services/learning/learning.service');
const { DeckNotFoundError, DeckOwnershipError } = await import(
  '../services/learning/learning-errors'
);

beforeEach(() => {
  transactionFailed = false;
  mockTransaction.mockClear();
  mockDeckInsert.mockClear();
  mockDeckFindById.mockClear();
  mockDeckListByUser.mockClear();
  mockDeckUpdateById.mockClear();
  mockDeckDeleteById.mockClear();
  mockCardInsertMany.mockClear();
  mockCardListByDeck.mockClear();
});

// ---------------------------------------------------------------------------
describe('LearningService', () => {
  describe('createDeckWithCards', () => {
    it('inserts the deck and cards inside a single transaction and returns both', async () => {
      const deckRow = { id: 'deck-1', userId: 'user-1', title: 'Maths', cardCount: 2 };
      const cardRows = [
        { id: 'card-1', deckId: 'deck-1', position: 0 },
        { id: 'card-2', deckId: 'deck-1', position: 1 },
      ];
      mockDeckInsert.mockImplementationOnce(async () => deckRow);
      mockCardInsertMany.mockImplementationOnce(async () => cardRows);

      const result = await learningService.createDeckWithCards({
        userId: 'user-1',
        deck: { title: 'Maths', description: 'test', subject: 'Mathématiques', source: 'prompt' },
        cards: [
          { cardType: 'flashcard', content: { front: 'Q1', back: 'A1' } },
          { cardType: 'qcm', content: { question: 'Q2' } },
        ],
      });

      expect(mockTransaction).toHaveBeenCalledTimes(1);
      expect(mockDeckInsert).toHaveBeenCalledTimes(1);
      expect(mockCardInsertMany).toHaveBeenCalledTimes(1);
      // Same tx handle is propagated to both writes
      const deckTxArg = mockDeckInsert.mock.calls[0]?.[1];
      const cardsTxArg = mockCardInsertMany.mock.calls[0]?.[1];
      expect(deckTxArg).toBe(cardsTxArg);
      expect(result).toEqual({ deck: deckRow, cards: cardRows });
    });

    it('skips the card insert when the cards array is empty', async () => {
      const deckRow = { id: 'deck-empty', userId: 'user-1', cardCount: 0 };
      mockDeckInsert.mockImplementationOnce(async () => deckRow);

      const result = await learningService.createDeckWithCards({
        userId: 'user-1',
        deck: { title: 'Empty', description: null, subject: 'test', source: 'prompt' },
        cards: [],
      });

      expect(mockDeckInsert).toHaveBeenCalledTimes(1);
      expect(mockCardInsertMany).not.toHaveBeenCalled();
      expect(result.cards).toEqual([]);
    });

    it('rolls back (propagates the rejection) when the card insert throws', async () => {
      mockDeckInsert.mockImplementationOnce(async () => ({
        id: 'deck-1',
        userId: 'user-1',
        cardCount: 1,
      }));
      mockCardInsertMany.mockImplementationOnce(async () => {
        throw new Error('boom');
      });

      await expect(
        learningService.createDeckWithCards({
          userId: 'user-1',
          deck: { title: 'x', description: null, subject: 'x', source: 'prompt' },
          cards: [{ cardType: 'flashcard', content: {} }],
        }),
      ).rejects.toThrow('boom');

      expect(transactionFailed).toBe(true);
    });

    it('rolls back when the card insert returns an empty result despite non-empty input', async () => {
      mockDeckInsert.mockImplementationOnce(async () => ({
        id: 'deck-1',
        userId: 'user-1',
        cardCount: 1,
      }));
      mockCardInsertMany.mockImplementationOnce(async () => []);

      await expect(
        learningService.createDeckWithCards({
          userId: 'user-1',
          deck: { title: 'x', description: null, subject: 'x', source: 'prompt' },
          cards: [{ cardType: 'flashcard', content: {} }],
        }),
      ).rejects.toThrow('Failed to insert cards');
      expect(transactionFailed).toBe(true);
    });
  });

  describe('listUserDecks', () => {
    it('delegates to the repository with the same options', async () => {
      const decks = [{ id: 'd1' }, { id: 'd2' }];
      mockDeckListByUser.mockImplementationOnce(async () => decks);

      const result = await learningService.listUserDecks('user-1', { limit: 10, offset: 5 });

      expect(mockDeckListByUser).toHaveBeenCalledTimes(1);
      expect(mockDeckListByUser.mock.calls[0]?.[0]).toBe('user-1');
      expect(mockDeckListByUser.mock.calls[0]?.[1]).toEqual({ limit: 10, offset: 5 });
      expect(result).toBe(decks);
    });
  });

  describe('getDeckWithCardsOrThrow', () => {
    it('returns deck + cards on ownership match', async () => {
      const deck = { id: 'deck-1', userId: 'user-1' };
      const cards = [{ id: 'c1' }];
      mockDeckFindById.mockImplementationOnce(async () => deck);
      mockCardListByDeck.mockImplementationOnce(async () => cards);

      const result = await learningService.getDeckWithCardsOrThrow('user-1', 'deck-1');

      expect(result).toEqual({ deck, cards });
    });

    it('throws DeckNotFoundError when the deck does not exist', async () => {
      mockDeckFindById.mockImplementationOnce(async () => null);

      await expect(
        learningService.getDeckWithCardsOrThrow('user-1', 'missing'),
      ).rejects.toBeInstanceOf(DeckNotFoundError);
      expect(mockCardListByDeck).not.toHaveBeenCalled();
    });

    it('throws DeckOwnershipError when the deck belongs to someone else', async () => {
      mockDeckFindById.mockImplementationOnce(async () => ({
        id: 'deck-1',
        userId: 'other-user',
      }));

      await expect(
        learningService.getDeckWithCardsOrThrow('user-1', 'deck-1'),
      ).rejects.toBeInstanceOf(DeckOwnershipError);
      expect(mockCardListByDeck).not.toHaveBeenCalled();
    });
  });

  describe('updateDeckOrThrow', () => {
    it('throws DeckNotFoundError when the deck does not exist', async () => {
      mockDeckFindById.mockImplementationOnce(async () => null);

      await expect(
        learningService.updateDeckOrThrow('user-1', 'missing', { title: 'new' }),
      ).rejects.toBeInstanceOf(DeckNotFoundError);
      expect(mockDeckUpdateById).not.toHaveBeenCalled();
    });

    it('throws DeckOwnershipError when the caller is not the owner', async () => {
      mockDeckFindById.mockImplementationOnce(async () => ({
        id: 'deck-1',
        userId: 'other-user',
      }));

      await expect(
        learningService.updateDeckOrThrow('user-1', 'deck-1', { title: 'new' }),
      ).rejects.toBeInstanceOf(DeckOwnershipError);
      expect(mockDeckUpdateById).not.toHaveBeenCalled();
    });

    it('delegates the update to the repository when ownership matches', async () => {
      mockDeckFindById.mockImplementationOnce(async () => ({
        id: 'deck-1',
        userId: 'user-1',
      }));
      mockDeckUpdateById.mockImplementationOnce(async () => ({
        id: 'deck-1',
        title: 'new',
      }));

      const result = await learningService.updateDeckOrThrow('user-1', 'deck-1', {
        title: 'new',
      });

      expect(mockDeckUpdateById).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ id: 'deck-1', title: 'new' });
    });

    it('rethrows DeckNotFoundError on concurrent-delete race (update returns null)', async () => {
      mockDeckFindById.mockImplementationOnce(async () => ({
        id: 'deck-1',
        userId: 'user-1',
      }));
      mockDeckUpdateById.mockImplementationOnce(async () => null);

      await expect(
        learningService.updateDeckOrThrow('user-1', 'deck-1', { title: 'new' }),
      ).rejects.toBeInstanceOf(DeckNotFoundError);
    });
  });

  describe('deleteDeckOrThrow', () => {
    it('throws DeckNotFoundError when the deck does not exist', async () => {
      mockDeckFindById.mockImplementationOnce(async () => null);

      await expect(
        learningService.deleteDeckOrThrow('user-1', 'missing'),
      ).rejects.toBeInstanceOf(DeckNotFoundError);
      expect(mockDeckDeleteById).not.toHaveBeenCalled();
    });

    it('throws DeckOwnershipError when the caller is not the owner', async () => {
      mockDeckFindById.mockImplementationOnce(async () => ({
        id: 'deck-1',
        userId: 'other-user',
      }));

      await expect(
        learningService.deleteDeckOrThrow('user-1', 'deck-1'),
      ).rejects.toBeInstanceOf(DeckOwnershipError);
      expect(mockDeckDeleteById).not.toHaveBeenCalled();
    });

    it('deletes when ownership matches', async () => {
      mockDeckFindById.mockImplementationOnce(async () => ({
        id: 'deck-1',
        userId: 'user-1',
      }));

      await learningService.deleteDeckOrThrow('user-1', 'deck-1');

      expect(mockDeckDeleteById).toHaveBeenCalledWith('deck-1');
    });
  });
});
