/**
 * Unit tests — LearningService (src/services/learning/learning.service.ts)
 *
 * Strategy:
 *  - Mock the repository modules so we verify delegation + ownership logic
 *    without hitting Postgres.
 *  - Mock `db.transaction` to a pass-through that calls the provided callback
 *    with a fake tx handle, letting us assert that multi-step operations run
 *    inside a single transaction and roll back on failure.
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';

const mockLogger = createMockLogger();
mock.module('../lib/observability', () => ({ logger: mockLogger }));

// --- Transaction envelope mock ---------------------------------------------
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

// --- Deck repository mocks -------------------------------------------------
const mockDeckInsert = mock(async () => ({ id: 'deck-1', userId: 'user-1', cardCount: 0 }));
const mockDeckFindById = mock(async () => null as unknown);
const mockDeckListByUser = mock(async () => [] as unknown[]);
const mockDeckUpdateById = mock(async () => ({ id: 'deck-1', title: 'updated' } as unknown));
const mockDeckDeleteById = mock(async () => {});

mock.module('../db/repositories/learning-decks.repository', () => ({
  learningDecksRepository: {
    insert: mockDeckInsert,
    findById: mockDeckFindById,
    listByUser: mockDeckListByUser,
    updateById: mockDeckUpdateById,
    deleteById: mockDeckDeleteById,
  },
}));

// --- Card repository mocks -------------------------------------------------
const mockCardInsertMany = mock(async (): Promise<unknown[]> => []);
const mockCardListByDeck = mock(async (): Promise<unknown[]> => []);
const mockCardFindByIdWithOwner = mock(async (): Promise<unknown> => null);
const mockCardUpdateById = mock(async (): Promise<unknown> => null);
const mockCardDeleteById = mock(async (): Promise<unknown> => null);
const mockCardCountByDeckId = mock(async (): Promise<number> => 0);
const mockCardCountDueByUser = mock(async (): Promise<number> => 0);

mock.module('../db/repositories/learning-cards.repository', () => ({
  learningCardsRepository: {
    insertMany: mockCardInsertMany,
    listByDeck: mockCardListByDeck,
    findByIdWithOwner: mockCardFindByIdWithOwner,
    updateById: mockCardUpdateById,
    deleteById: mockCardDeleteById,
    countByDeckId: mockCardCountByDeckId,
    countDueByUser: mockCardCountDueByUser,
  },
}));

// --- FSRS service mock -----------------------------------------------------
const mockFsrsInit = mock(() => ({ state: 0 }));
const mockFsrsReviewCard = mock(async () => ({
  cardId: 'card-1',
  rating: 3,
  previousState: 0,
  newState: 2,
  nextDue: new Date(),
  stability: 1,
  difficulty: 0.3,
  reps: 1,
  lapses: 0,
}));
const mockFsrsPreviewScheduling = mock(() => ({
  1: { due: new Date(), interval: 0 },
  2: { due: new Date(), interval: 1 },
  3: { due: new Date(), interval: 3 },
  4: { due: new Date(), interval: 7 },
}));

mock.module('../services/fsrs.service', () => ({
  fsrsService: {
    initializeCardFsrsData: mockFsrsInit,
    reviewCard: mockFsrsReviewCard,
    previewScheduling: mockFsrsPreviewScheduling,
  },
  Rating: { Again: 1, Hard: 2, Good: 3, Easy: 4 },
}));

const { learningService } = await import('../services/learning/learning.service');
const { DeckNotFoundError, DeckOwnershipError, CardNotFoundError, CardValidationError } =
  await import('../services/learning/learning-errors');

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
  mockCardFindByIdWithOwner.mockClear();
  mockCardUpdateById.mockClear();
  mockCardDeleteById.mockClear();
  mockCardCountByDeckId.mockClear();
  mockCardCountDueByUser.mockClear();
  mockFsrsReviewCard.mockClear();
  mockFsrsPreviewScheduling.mockClear();
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
      const deckTxArg = (mockDeckInsert.mock.calls[0] as unknown[])[1];
      const cardsTxArg = (mockCardInsertMany.mock.calls[0] as unknown[])[1];
      expect(deckTxArg).toBe(cardsTxArg);
      expect(result.deck).toMatchObject({ id: 'deck-1', userId: 'user-1' });
      expect(result.cards).toHaveLength(2);
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

      expect(
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

      expect(
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
      expect((mockDeckListByUser.mock.calls[0] as unknown[])[0]).toBe('user-1');
      expect((mockDeckListByUser.mock.calls[0] as unknown[])[1]).toEqual({ limit: 10, offset: 5 });
      expect((result as typeof decks)).toEqual(decks);
    });
  });

  describe('getDeckWithCardsOrThrow', () => {
    it('returns deck + cards on ownership match', async () => {
      const deck = { id: 'deck-1', userId: 'user-1' };
      const cards = [{ id: 'c1' }];
      mockDeckFindById.mockImplementationOnce(async () => deck);
      mockCardListByDeck.mockImplementationOnce(async () => cards);

      const result = await learningService.getDeckWithCardsOrThrow('user-1', 'deck-1');

      expect(result.deck).toMatchObject({ id: 'deck-1', userId: 'user-1' });
      expect(result.cards).toHaveLength(1);
    });

    it('throws DeckNotFoundError when the deck does not exist', async () => {
      mockDeckFindById.mockImplementationOnce(async () => null);

      expect(
        learningService.getDeckWithCardsOrThrow('user-1', 'missing'),
      ).rejects.toBeInstanceOf(DeckNotFoundError);
      expect(mockCardListByDeck).not.toHaveBeenCalled();
    });

    it('throws DeckOwnershipError when the deck belongs to someone else', async () => {
      mockDeckFindById.mockImplementationOnce(async () => ({
        id: 'deck-1',
        userId: 'other-user',
      } as unknown));

      expect(
        learningService.getDeckWithCardsOrThrow('user-1', 'deck-1'),
      ).rejects.toBeInstanceOf(DeckOwnershipError);
      expect(mockCardListByDeck).not.toHaveBeenCalled();
    });
  });

  describe('updateDeckOrThrow', () => {
    it('throws DeckNotFoundError when the deck does not exist', async () => {
      mockDeckFindById.mockImplementationOnce(async () => null);

      expect(
        learningService.updateDeckOrThrow('user-1', 'missing', { title: 'new' }),
      ).rejects.toBeInstanceOf(DeckNotFoundError);
      expect(mockDeckUpdateById).not.toHaveBeenCalled();
    });

    it('throws DeckOwnershipError when the caller is not the owner', async () => {
      mockDeckFindById.mockImplementationOnce(async () => ({
        id: 'deck-1',
        userId: 'other-user',
      } as unknown));

      expect(
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
      expect(result).toMatchObject({ id: 'deck-1', title: 'new' });
    });

    it('rethrows DeckNotFoundError on concurrent-delete race (update returns null)', async () => {
      mockDeckFindById.mockImplementationOnce(async () => ({
        id: 'deck-1',
        userId: 'user-1',
      }));
      mockDeckUpdateById.mockImplementationOnce(async () => null);

      expect(
        learningService.updateDeckOrThrow('user-1', 'deck-1', { title: 'new' }),
      ).rejects.toBeInstanceOf(DeckNotFoundError);
    });
  });

  describe('deleteDeckOrThrow', () => {
    it('throws DeckNotFoundError when the deck does not exist', async () => {
      mockDeckFindById.mockImplementationOnce(async () => null);

      expect(
        learningService.deleteDeckOrThrow('user-1', 'missing'),
      ).rejects.toBeInstanceOf(DeckNotFoundError);
      expect(mockDeckDeleteById).not.toHaveBeenCalled();
    });

    it('throws DeckOwnershipError when the caller is not the owner', async () => {
      mockDeckFindById.mockImplementationOnce(async () => ({
        id: 'deck-1',
        userId: 'other-user',
      } as unknown));

      expect(
        learningService.deleteDeckOrThrow('user-1', 'deck-1'),
      ).rejects.toBeInstanceOf(DeckOwnershipError);
      expect(mockDeckDeleteById).not.toHaveBeenCalled();
    });

    it('deletes when ownership matches', async () => {
      mockDeckFindById.mockImplementationOnce(async () => ({
        id: 'deck-1',
        userId: 'user-1',
      } as unknown));

      await learningService.deleteDeckOrThrow('user-1', 'deck-1');

      expect(mockDeckDeleteById).toHaveBeenCalledWith('deck-1');
    });
  });

  describe('addCardsToDeckOrThrow', () => {
    it('throws DeckNotFoundError when the deck does not exist', async () => {
      mockDeckFindById.mockImplementationOnce(async () => null);

      expect(
        learningService.addCardsToDeckOrThrow('user-1', 'deck-1', {
          cards: [{ cardType: 'flashcard', content: {} }],
        }),
      ).rejects.toBeInstanceOf(DeckNotFoundError);
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('throws DeckOwnershipError when the deck belongs to someone else', async () => {
      mockDeckFindById.mockImplementationOnce(async () => ({
        id: 'deck-1',
        userId: 'other-user',
        cardCount: 0,
      } as unknown));

      expect(
        learningService.addCardsToDeckOrThrow('user-1', 'deck-1', {
          cards: [{ cardType: 'flashcard', content: {} }],
        }),
      ).rejects.toBeInstanceOf(DeckOwnershipError);
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('inserts cards and recomputes cardCount from the live count inside the tx', async () => {
      const deck = { id: 'deck-1', userId: 'user-1', cardCount: 2 };
      const inserted = [{ id: 'card-3', deckId: 'deck-1' }];
      mockDeckFindById.mockImplementationOnce(async () => deck);
      // First count → startPosition (2), second count → newCount after insert (3)
      mockCardCountByDeckId.mockImplementationOnce(async () => 2).mockImplementationOnce(async () => 3);
      mockCardInsertMany.mockImplementationOnce(async () => inserted);
      mockDeckUpdateById.mockImplementationOnce(async () => ({ ...deck, cardCount: 3 }));

      const result = await learningService.addCardsToDeckOrThrow('user-1', 'deck-1', {
        cards: [{ cardType: 'flashcard', content: { front: 'q', back: 'a' } }],
      });

      expect(mockTransaction).toHaveBeenCalledTimes(1);
      expect(mockCardInsertMany).toHaveBeenCalledTimes(1);
      expect(mockCardCountByDeckId).toHaveBeenCalledTimes(2);
      expect(mockDeckUpdateById).toHaveBeenCalledTimes(1);
      // cardCount is the live recount, not arithmetic on the pre-tx snapshot
      const updateArg = (mockDeckUpdateById.mock.calls[0] as unknown[])[1] as { cardCount: number };
      expect(updateArg.cardCount).toBe(3);
      // All writes share the same tx handle
      const insertTx = (mockCardInsertMany.mock.calls[0] as unknown[])[1];
      const updateTx = (mockDeckUpdateById.mock.calls[0] as unknown[])[2];
      const countTx = (mockCardCountByDeckId.mock.calls[0] as unknown[])[1];
      expect(insertTx).toBe(updateTx);
      expect(insertTx).toBe(countTx);
      expect((result as typeof inserted)).toEqual(inserted);
    });

    it('rolls back when the card insert throws', async () => {
      mockDeckFindById.mockImplementationOnce(async () => ({
        id: 'deck-1',
        userId: 'user-1',
        cardCount: 0,
      }));
      mockCardInsertMany.mockImplementationOnce(async () => {
        throw new Error('insert fail');
      });

      expect(
        learningService.addCardsToDeckOrThrow('user-1', 'deck-1', {
          cards: [{ cardType: 'flashcard', content: { front: 'q', back: 'a' } }],
        }),
      ).rejects.toThrow('insert fail');
      expect(transactionFailed).toBe(true);
    });

    it('throws CardValidationError before any write when card content is invalid', async () => {
      mockDeckFindById.mockImplementationOnce(async () => ({
        id: 'deck-1',
        userId: 'user-1',
        cardCount: 0,
      }));

      expect(
        learningService.addCardsToDeckOrThrow('user-1', 'deck-1', {
          cards: [{ cardType: 'flashcard', content: { front: 'only front' } }],
        }),
      ).rejects.toBeInstanceOf(CardValidationError);
      expect(mockTransaction).not.toHaveBeenCalled();
      expect(mockCardInsertMany).not.toHaveBeenCalled();
    });
  });

  describe('updateCardOrThrow', () => {
    it('throws CardNotFoundError when the card is not found or not owned', async () => {
      mockCardFindByIdWithOwner.mockImplementationOnce(async () => null);

      expect(
        learningService.updateCardOrThrow('user-1', 'card-1', { position: 5 }),
      ).rejects.toBeInstanceOf(CardNotFoundError);
      expect(mockCardUpdateById).not.toHaveBeenCalled();
    });

    it('delegates the update and returns the updated card', async () => {
      const card = { id: 'card-1', deckId: 'deck-1', position: 0 };
      const updated = { ...card, position: 5 };
      mockCardFindByIdWithOwner.mockImplementationOnce(async () => ({
        card,
        deckUserId: 'user-1',
      }));
      mockCardUpdateById.mockImplementationOnce(async () => updated);

      const result = await learningService.updateCardOrThrow('user-1', 'card-1', { position: 5 });

      expect(mockCardUpdateById).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({ position: 5 });
    });

    it('throws CardNotFoundError on concurrent-delete race (update returns null)', async () => {
      mockCardFindByIdWithOwner.mockImplementationOnce(async () => ({
        card: { id: 'card-1', deckId: 'deck-1' },
        deckUserId: 'user-1',
      }));
      mockCardUpdateById.mockImplementationOnce(async () => null);

      expect(
        learningService.updateCardOrThrow('user-1', 'card-1', { position: 5 }),
      ).rejects.toBeInstanceOf(CardNotFoundError);
    });

    it('validates new content against the existing card type when cardType is omitted', async () => {
      mockCardFindByIdWithOwner.mockImplementationOnce(async () => ({
        card: { id: 'card-1', deckId: 'deck-1', cardType: 'flashcard' },
        deckUserId: 'user-1',
      }));

      expect(
        learningService.updateCardOrThrow('user-1', 'card-1', {
          content: { front: 'only front' },
        }),
      ).rejects.toBeInstanceOf(CardValidationError);
      expect(mockCardUpdateById).not.toHaveBeenCalled();
    });

    it('persists only content/position, never the cardType', async () => {
      mockCardFindByIdWithOwner.mockImplementationOnce(async () => ({
        card: { id: 'card-1', deckId: 'deck-1', cardType: 'flashcard' },
        deckUserId: 'user-1',
      }));
      mockCardUpdateById.mockImplementationOnce(async () => ({
        id: 'card-1',
        cardType: 'flashcard',
      }));

      await learningService.updateCardOrThrow('user-1', 'card-1', {
        cardType: 'qcm',
        content: { question: 'Q', options: ['a', 'b'], correctIndex: 0 },
        position: 3,
      });

      const persisted = (mockCardUpdateById.mock.calls[0] as unknown[])[1] as Record<string, unknown>;
      expect(persisted).not.toHaveProperty('cardType');
      expect(persisted).toMatchObject({ position: 3 });
    });
  });

  describe('deleteCardOrThrow', () => {
    it('throws CardNotFoundError when the card is not found or not owned', async () => {
      mockCardFindByIdWithOwner.mockImplementationOnce(async () => null);

      expect(
        learningService.deleteCardOrThrow('user-1', 'card-1'),
      ).rejects.toBeInstanceOf(CardNotFoundError);
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('deletes the card and recounts cardCount atomically', async () => {
      const card = { id: 'card-1', deckId: 'deck-1' };
      mockCardFindByIdWithOwner.mockImplementationOnce(async () => ({
        card,
        deckUserId: 'user-1',
      }));
      mockCardDeleteById.mockImplementationOnce(async () => card);
      mockCardCountByDeckId.mockImplementationOnce(async () => 1);
      mockDeckUpdateById.mockImplementationOnce(async () => ({ id: 'deck-1', cardCount: 1 }));

      await learningService.deleteCardOrThrow('user-1', 'card-1');

      expect(mockTransaction).toHaveBeenCalledTimes(1);
      expect(mockCardDeleteById).toHaveBeenCalledTimes(1);
      expect(mockCardCountByDeckId).toHaveBeenCalledTimes(1);
      expect(mockDeckUpdateById).toHaveBeenCalledTimes(1);
      // All writes share the same tx handle
      const deleteTx = (mockCardDeleteById.mock.calls[0] as unknown[])[1];
      const countTx = (mockCardCountByDeckId.mock.calls[0] as unknown[])[1];
      const updateTx = (mockDeckUpdateById.mock.calls[0] as unknown[])[2];
      expect(deleteTx).toBe(countTx);
      expect(deleteTx).toBe(updateTx);
    });

    it('rolls back when the delete fails', async () => {
      mockCardFindByIdWithOwner.mockImplementationOnce(async () => ({
        card: { id: 'card-1', deckId: 'deck-1' },
        deckUserId: 'user-1',
      }));
      mockCardDeleteById.mockImplementationOnce(async () => {
        throw new Error('delete fail');
      });

      expect(
        learningService.deleteCardOrThrow('user-1', 'card-1'),
      ).rejects.toThrow('delete fail');
      expect(transactionFailed).toBe(true);
    });
  });

  describe('getDueSummaryForUser', () => {
    it('delegates to the card repository countDueByUser', async () => {
      mockCardCountDueByUser.mockImplementationOnce(async () => 7);

      const result = await learningService.getDueSummaryForUser('user-1');

      expect(mockCardCountDueByUser).toHaveBeenCalledWith('user-1');
      expect(result).toBe(7);
    });
  });

  describe('reviewCardOrThrow', () => {
    it('throws CardNotFoundError when the card is not found or not owned', async () => {
      mockCardFindByIdWithOwner.mockImplementationOnce(async () => null);

      expect(
        learningService.reviewCardOrThrow('user-1', 'card-1', 3 as never, 'sixieme'),
      ).rejects.toBeInstanceOf(CardNotFoundError);
      expect(mockFsrsReviewCard).not.toHaveBeenCalled();
    });

    it('delegates to fsrsService.reviewCard when ownership matches', async () => {
      mockCardFindByIdWithOwner.mockImplementationOnce(async () => ({
        card: { id: 'card-1', deckId: 'deck-1' },
        deckUserId: 'user-1',
      }));

      await learningService.reviewCardOrThrow('user-1', 'card-1', 3 as never, 'sixieme');

      expect(mockFsrsReviewCard).toHaveBeenCalledTimes(1);
      expect((mockFsrsReviewCard.mock.calls[0] as unknown[])[0]).toBe('card-1');
      expect((mockFsrsReviewCard.mock.calls[0] as unknown[])[1]).toBe(3);
    });
  });

  describe('previewCardOrThrow', () => {
    it('throws CardNotFoundError when the card is not found or not owned', async () => {
      mockCardFindByIdWithOwner.mockImplementationOnce(async () => null);

      expect(
        learningService.previewCardOrThrow('user-1', 'card-1', 'sixieme'),
      ).rejects.toBeInstanceOf(CardNotFoundError);
      expect(mockFsrsPreviewScheduling).not.toHaveBeenCalled();
    });

    it('delegates to fsrsService.previewScheduling when ownership matches', async () => {
      const card = { id: 'card-1', deckId: 'deck-1', fsrsData: { state: 0 } };
      mockCardFindByIdWithOwner.mockImplementationOnce(async () => ({
        card,
        deckUserId: 'user-1',
      }));

      await learningService.previewCardOrThrow('user-1', 'card-1', 'sixieme');

      expect(mockFsrsPreviewScheduling).toHaveBeenCalledTimes(1);
      expect((mockFsrsPreviewScheduling.mock.calls[0] as unknown[])[0]).toBe('sixieme');
    });
  });
});
