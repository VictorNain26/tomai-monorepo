/**
 * Tests unitaires - LearningService (services/learning/learning.service.ts)
 * Mock: DB + fsrs + logger
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';

const mockLogger = createMockLogger();
mock.module('../lib/observability', () => ({ logger: mockLogger }));

// Transaction mock — runs the callback with a tx that exposes insert
let txInsertReturning: unknown[][] = [];
let txInsertCallCount = 0;
const mockTxInsertValues = mock(() => ({
  returning: mock(async () => txInsertReturning[txInsertCallCount++] ?? []),
}));
const mockTxInsert = mock(() => ({ values: mockTxInsertValues }));

const mockTransaction = mock(async (fn: (tx: unknown) => Promise<unknown>) => {
  txInsertCallCount = 0;
  return fn({ insert: mockTxInsert });
});

let dbSelectResult: unknown[] = [];
const mockSelect = mock(() => ({
  from: mock(() => ({
    where: mock(() => ({
      limit: mock(() => Promise.resolve(dbSelectResult)),
      orderBy: mock(() => Promise.resolve(dbSelectResult)),
    })),
    orderBy: mock(() => Promise.resolve(dbSelectResult)),
  })),
}));

const mockUpdateReturning = mock(async () => [{ id: 'deck-1', title: 'updated' }]);
const mockUpdateWhere = mock(() => ({ returning: mockUpdateReturning }));
const mockUpdateSet = mock(() => ({ where: mockUpdateWhere }));
const mockUpdate = mock(() => ({ set: mockUpdateSet }));

const mockDeleteWhere = mock(() => Promise.resolve());
const mockDelete = mock(() => ({ where: mockDeleteWhere }));

mock.module('../db/connection', () => ({
  db: {
    transaction: mockTransaction,
    select: mockSelect,
    update: mockUpdate,
    delete: mockDelete,
  },
}));

mock.module('../db/schema', () => ({
  learningDecks: { id: 'id', userId: 'userId', updatedAt: 'updatedAt' },
  learningCards: { deckId: 'deckId', position: 'position' },
}));

mock.module('drizzle-orm', () => ({
  eq: (...args: unknown[]) => ({ type: 'eq', args }),
  and: (...args: unknown[]) => ({ type: 'and', args }),
  desc: (x: unknown) => ({ type: 'desc', x }),
  asc: (x: unknown) => ({ type: 'asc', x }),
}));

mock.module('../services/fsrs.service', () => ({
  fsrsService: {
    initializeCardFsrsData: mock(() => ({ state: 0 })),
  },
}));

const { learningService } = await import('../services/learning/learning.service');

beforeEach(() => {
  dbSelectResult = [];
  txInsertReturning = [];
  txInsertCallCount = 0;
  mockTransaction.mockClear();
  mockTxInsert.mockClear();
  mockTxInsertValues.mockClear();
  mockSelect.mockClear();
  mockUpdate.mockClear();
  mockUpdateReturning.mockClear();
  mockDelete.mockClear();
  mockDeleteWhere.mockClear();
});

describe('LearningService', () => {
  describe('createDeckWithCards', () => {
    it('runs both inserts inside a single transaction', async () => {
      txInsertReturning = [
        [{ id: 'deck-1', userId: 'user-1', title: 'Maths', cardCount: 2 }],
        [
          { id: 'card-1', deckId: 'deck-1', position: 0 },
          { id: 'card-2', deckId: 'deck-1', position: 1 },
        ],
      ];
      const result = await learningService.createDeckWithCards({
        userId: 'user-1',
        deck: {
          title: 'Maths',
          description: 'test',
          subject: 'Mathématiques',
          source: 'prompt',
        },
        cards: [
          { cardType: 'flashcard', content: { front: 'Q1', back: 'A1' } },
          { cardType: 'qcm', content: { question: 'Q2' } },
        ],
      });
      expect(mockTransaction).toHaveBeenCalledTimes(1);
      expect(mockTxInsert).toHaveBeenCalledTimes(2);
      expect(result.deck.id).toBe('deck-1');
      expect(result.cards).toHaveLength(2);
    });

    it('skips card insert when cards array is empty', async () => {
      txInsertReturning = [[{ id: 'deck-empty', userId: 'user-1', cardCount: 0 }]];
      const result = await learningService.createDeckWithCards({
        userId: 'user-1',
        deck: { title: 'Empty', description: null, subject: 'test', source: 'prompt' },
        cards: [],
      });
      expect(mockTxInsert).toHaveBeenCalledTimes(1);
      expect(result.cards).toEqual([]);
    });

    it('throws when deck insert returns no row', async () => {
      txInsertReturning = [[]];
      await expect(
        learningService.createDeckWithCards({
          userId: 'user-1',
          deck: { title: 'x', description: null, subject: 'x', source: 'prompt' },
          cards: [{ cardType: 'flashcard', content: {} }],
        }),
      ).rejects.toThrow('Failed to create deck');
    });
  });

  describe('getDeckWithCards', () => {
    it('returns null when deck does not belong to user', async () => {
      dbSelectResult = [];
      const result = await learningService.getDeckWithCards('user-1', 'deck-1');
      expect(result).toBeNull();
    });
  });

  describe('updateDeck', () => {
    it('returns null when deck does not belong to user', async () => {
      dbSelectResult = [];
      const result = await learningService.updateDeck('user-1', 'deck-1', { title: 'new' });
      expect(result).toBeNull();
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('returns updated deck when ownership matches', async () => {
      dbSelectResult = [{ id: 'deck-1' }];
      const result = await learningService.updateDeck('user-1', 'deck-1', { title: 'new' });
      expect(mockUpdate).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ id: 'deck-1', title: 'updated' });
    });
  });

  describe('deleteDeck', () => {
    it('returns false when deck does not belong to user', async () => {
      dbSelectResult = [];
      const deleted = await learningService.deleteDeck('user-1', 'deck-1');
      expect(deleted).toBe(false);
      expect(mockDelete).not.toHaveBeenCalled();
    });

    it('deletes when ownership matches', async () => {
      dbSelectResult = [{ id: 'deck-1' }];
      const deleted = await learningService.deleteDeck('user-1', 'deck-1');
      expect(deleted).toBe(true);
      expect(mockDelete).toHaveBeenCalledTimes(1);
    });
  });
});
