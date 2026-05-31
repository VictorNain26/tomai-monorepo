/**
 * Tests unitaires - FSRS Service (services/fsrs.service.ts)
 * Tests: initializeCardFsrsData (pure), previewScheduling (pure),
 * reviewCard (DB mock), getDueCards priority (DB mock), getDeckStats (DB mock)
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';
import { State, Rating } from 'ts-fsrs';
import type { FSRSData } from '../db/schema.js';

// ============================================
// MOCKS
// ============================================

const mockLogger = createMockLogger();
mock.module('../lib/observability', () => ({ logger: mockLogger }));

// DB mock — queue-based for sequential selects
let selectQueue: unknown[][] = [];
let selectIdx = 0;

function nextSelectResult(): unknown[] {
  const result = selectQueue[selectIdx] ?? [];
  selectIdx++;
  return result;
}

const mockUpdateWhere = mock(() => Promise.resolve());
const mockUpdateSet = mock(() => ({ where: mockUpdateWhere }));
const mockDbUpdate = mock(() => ({ set: mockUpdateSet }));

mock.module('../db/connection', () => ({
  db: {
    select: mock(() => ({
      from: mock(() => ({
        where: mock(() => {
          // Return a thenable with chaining methods — supports:
          // await where()           (getDeckStats cards query)
          // where().limit()         (deck check, reviewCard)
          // where().orderBy()       (getDueCards cards query)
          const data = nextSelectResult();
          const p = Promise.resolve(data);
          (p as unknown as Record<string, unknown>).limit = mock(() => p);
          (p as unknown as Record<string, unknown>).orderBy = mock(() => p);
          return p;
        }),
      })),
    })),
    update: mockDbUpdate,
  },
}));

mock.module('../db/schema', () => ({
  learningCards: {
    id: 'id',
    deckId: 'deckId',
    position: 'position',
    fsrsData: 'fsrsData',
    cardType: 'cardType',
    content: 'content',
    updatedAt: 'updatedAt',
  },
  learningDecks: {
    id: 'id',
    userId: 'userId',
  },
}));

mock.module('drizzle-orm', () => ({
  eq: (...args: unknown[]) => ({ type: 'eq', args }),
  and: (...args: unknown[]) => ({ type: 'and', args }),
}));

// Import after mocks — NOT mocking ts-fsrs or learning-config (real logic)
const { fsrsService } = await import('../services/fsrs.service');

// Helper: create a card DB row with FSRS data
function makeCardRow(
  id: string,
  deckId: string,
  position: number,
  fsrsData: FSRSData | null,
  cardType = 'basic'
) {
  return { id, deckId, position, fsrsData, cardType, content: { front: 'Q', back: 'A' } };
}

beforeEach(() => {
  selectQueue = [];
  selectIdx = 0;
  mockDbUpdate.mockClear();
  mockUpdateSet.mockClear();
  mockUpdateWhere.mockClear();
});

describe('FSRS Service', () => {
  // ==================================================================
  // initializeCardFsrsData — PURE, no DB
  // ==================================================================
  describe('initializeCardFsrsData', () => {
    it('should return valid FSRSData with New state', () => {
      const data = fsrsService.initializeCardFsrsData();
      expect(data.state).toBe(State.New);
      expect(data.reps).toBe(0);
      expect(data.lapses).toBe(0);
      expect(data.stability).toBe(0);
      expect(data.difficulty).toBe(0);
    });

    it('should have a due date set (ISO string)', () => {
      const data = fsrsService.initializeCardFsrsData();
      expect(typeof data.due).toBe('string');
      // Should be parseable as a date
      expect(new Date(data.due as string).getTime()).toBeGreaterThan(0);
    });
  });

  // ==================================================================
  // previewScheduling — PURE, no DB (uses ts-fsrs + learning-config)
  // ==================================================================
  describe('previewScheduling', () => {
    it('should return 4 grades for a new card', () => {
      const preview = fsrsService.previewScheduling('troisieme', null);
      // Grades 1-4: Again, Hard, Good, Easy
      expect(preview[Rating.Again]).toBeDefined();
      expect(preview[Rating.Hard]).toBeDefined();
      expect(preview[Rating.Good]).toBeDefined();
      expect(preview[Rating.Easy]).toBeDefined();
    });

    it('should give Easy a longer interval than Again for new card', () => {
      const preview = fsrsService.previewScheduling('troisieme', null);
      const againDue = preview[Rating.Again].due.getTime();
      const easyDue = preview[Rating.Easy].due.getTime();
      expect(easyDue).toBeGreaterThan(againDue);
    });

    it('should produce valid previews for different education levels', () => {
      const emptyData = fsrsService.initializeCardFsrsData();
      const reviewedData = {
        ...emptyData,
        state: State.Review,
        reps: 5,
        stability: 10,
        difficulty: 5,
        lastReview: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      };

      const cpPreview = fsrsService.previewScheduling('cp', reviewedData);
      const terminalePreview = fsrsService.previewScheduling('terminale', reviewedData);

      // Both should produce valid 4-grade previews
      expect(cpPreview[Rating.Good]).toBeDefined();
      expect(terminalePreview[Rating.Good]).toBeDefined();
      // CP maxInterval=30 caps the Good interval
      expect(cpPreview[Rating.Good].interval).toBeLessThanOrEqual(30);
      // Terminale maxInterval=730, allows longer intervals
      expect(terminalePreview[Rating.Good].interval).toBeLessThanOrEqual(730);
    });

    it('should handle empty object fsrsData (treated as new card)', () => {
      const preview = fsrsService.previewScheduling('sixieme', {});
      expect(preview[Rating.Good]).toBeDefined();
      expect(preview[Rating.Good].due.getTime()).toBeGreaterThan(Date.now() - 1000);
    });
  });

  // ==================================================================
  // reviewCard — state transitions (DB mock)
  // ==================================================================
  describe('reviewCard', () => {
    it('should transition New card to Learning on Again', async () => {
      const newFsrsData = fsrsService.initializeCardFsrsData();
      selectQueue = [[makeCardRow('card-1', 'deck-1', 0, newFsrsData)]];

      const result = await fsrsService.reviewCard('card-1', Rating.Again, 'troisieme');
      expect(result.previousState).toBe(State.New);
      expect(result.newState).toBe(State.Learning);
      expect(result.reps).toBe(1);
      expect(result.lapses).toBe(0);
    });

    it('should transition New card to Learning on Good', async () => {
      const newFsrsData = fsrsService.initializeCardFsrsData();
      selectQueue = [[makeCardRow('card-2', 'deck-1', 1, newFsrsData)]];

      const result = await fsrsService.reviewCard('card-2', Rating.Good, 'troisieme');
      expect(result.previousState).toBe(State.New);
      // Good on a new card should move to Learning (short-term enabled)
      expect([State.Learning, State.Review]).toContain(result.newState);
      expect(result.reps).toBe(1);
    });

    it('should increase stability on Easy rating', async () => {
      const newFsrsData = fsrsService.initializeCardFsrsData();
      selectQueue = [[makeCardRow('card-3', 'deck-1', 0, newFsrsData)]];

      const result = await fsrsService.reviewCard('card-3', Rating.Easy, 'troisieme');
      expect(result.stability).toBeGreaterThan(0);
      expect(result.difficulty).toBeGreaterThan(0);
    });

    it('should update DB after review', async () => {
      const newFsrsData = fsrsService.initializeCardFsrsData();
      selectQueue = [[makeCardRow('card-4', 'deck-1', 0, newFsrsData)]];

      await fsrsService.reviewCard('card-4', Rating.Good, 'sixieme');
      expect(mockDbUpdate).toHaveBeenCalled();
      expect(mockUpdateSet).toHaveBeenCalled();
      expect(mockUpdateWhere).toHaveBeenCalled();
    });

    it('should throw for non-existent card', async () => {
      selectQueue = [[]]; // Empty result
      expect(
        fsrsService.reviewCard('card-missing', Rating.Good, 'troisieme')
      ).rejects.toThrow('Card not found');
    });
  });

  // ==================================================================
  // getDueCards — priority ordering (DB mock)
  // ==================================================================
  describe('getDueCards', () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    it('should prioritize overdue > learning > review > new', async () => {
      const deck = { id: 'deck-1', userId: 'user-1', cardCount: 4 };
      const cards = [
        makeCardRow('new-card', 'deck-1', 0, null), // New (priority ~1000)
        makeCardRow('learning-card', 'deck-1', 1, {
          state: State.Learning, due: yesterday.toISOString(),
          stability: 0.5, difficulty: 5, reps: 1, lapses: 0,
        }), // Learning due (priority 100)
        makeCardRow('review-card', 'deck-1', 2, {
          state: State.Review, due: yesterday.toISOString(),
          stability: 10, difficulty: 5, reps: 5, lapses: 0,
        }), // Review due (priority ~510)
        makeCardRow('overdue-card', 'deck-1', 3, {
          state: State.Review, due: twoDaysAgo.toISOString(),
          stability: 5, difficulty: 5, reps: 3, lapses: 0,
        }), // Overdue >24h (priority negative)
      ];

      selectQueue = [[deck], cards];

      const result = await fsrsService.getDueCards({
        deckId: 'deck-1', userId: 'user-1', limit: 10,
      });

      // Should have all 4 cards (overdue + learning + review are due, new included by default)
      expect(result.length).toBe(4);
      // Priority order: overdue first, then learning, then review, then new
      expect(result[0]?.id).toBe('overdue-card');
      expect(result[0]?.overdue).toBe(true);
      expect(result[1]?.id).toBe('learning-card');
      expect(result[2]?.id).toBe('review-card');
      expect(result[3]?.id).toBe('new-card');
    });

    it('should exclude new cards when includeNew=false', async () => {
      const deck = { id: 'deck-1', userId: 'user-1', cardCount: 2 };
      const cards = [
        makeCardRow('new-card', 'deck-1', 0, null),
        makeCardRow('due-card', 'deck-1', 1, {
          state: State.Review, due: yesterday.toISOString(),
          stability: 5, difficulty: 5, reps: 3, lapses: 0,
        }),
      ];

      selectQueue = [[deck], cards];

      const result = await fsrsService.getDueCards({
        deckId: 'deck-1', userId: 'user-1', includeNew: false,
      });

      expect(result.length).toBe(1);
      expect(result[0]?.id).toBe('due-card');
    });

    it('should exclude cards not yet due', async () => {
      const deck = { id: 'deck-1', userId: 'user-1', cardCount: 1 };
      const cards = [
        makeCardRow('future-card', 'deck-1', 0, {
          state: State.Review, due: tomorrow.toISOString(),
          stability: 20, difficulty: 5, reps: 10, lapses: 0,
        }),
      ];

      selectQueue = [[deck], cards];

      const result = await fsrsService.getDueCards({
        deckId: 'deck-1', userId: 'user-1', includeNew: false,
      });

      expect(result.length).toBe(0);
    });

    it('should respect limit', async () => {
      const deck = { id: 'deck-1', userId: 'user-1', cardCount: 5 };
      const cards = Array.from({ length: 5 }, (_, i) =>
        makeCardRow(`card-${i}`, 'deck-1', i, null)
      );

      selectQueue = [[deck], cards];

      const result = await fsrsService.getDueCards({
        deckId: 'deck-1', userId: 'user-1', limit: 2,
      });

      expect(result.length).toBe(2);
    });

    it('should throw for non-existent deck', async () => {
      selectQueue = [[]]; // No deck found

      expect(
        fsrsService.getDueCards({ deckId: 'bad-deck', userId: 'user-1' })
      ).rejects.toThrow('Deck not found');
    });
  });

  // ==================================================================
  // getDeckStats — counting by state (DB mock)
  // ==================================================================
  describe('getDeckStats', () => {
    it('should count cards by state correctly', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const deck = { id: 'deck-1', userId: 'user-1', cardCount: 4 };
      const cards = [
        makeCardRow('c1', 'deck-1', 0, null), // New
        makeCardRow('c2', 'deck-1', 1, {
          state: State.Learning, due: yesterday.toISOString(),
          stability: 1, difficulty: 5, reps: 1, lapses: 0,
        }),
        makeCardRow('c3', 'deck-1', 2, {
          state: State.Review, due: yesterday.toISOString(),
          stability: 10, difficulty: 5, reps: 5, lapses: 0,
        }),
        makeCardRow('c4', 'deck-1', 3, {
          state: State.Relearning, due: yesterday.toISOString(),
          stability: 2, difficulty: 7, reps: 3, lapses: 1,
        }),
      ];

      selectQueue = [[deck], cards];

      const stats = await fsrsService.getDeckStats('deck-1', 'user-1');
      expect(stats.totalCards).toBe(4);
      expect(stats.newCards).toBe(1);
      expect(stats.learningCards).toBe(1);
      expect(stats.reviewCards).toBe(1);
      expect(stats.relearningCards).toBe(1);
    });

    it('should calculate averages for non-new cards', async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const deck = { id: 'deck-1', userId: 'user-1', cardCount: 2 };
      const cards = [
        makeCardRow('c1', 'deck-1', 0, null), // New — excluded from averages
        makeCardRow('c2', 'deck-1', 1, {
          state: State.Review, due: yesterday.toISOString(),
          stability: 10, difficulty: 6, reps: 5, lapses: 0,
        }),
        makeCardRow('c3', 'deck-1', 2, {
          state: State.Review, due: yesterday.toISOString(),
          stability: 20, difficulty: 4, reps: 8, lapses: 0,
        }),
      ];

      selectQueue = [[deck], cards];

      const stats = await fsrsService.getDeckStats('deck-1', 'user-1');
      // Average of (10+20)/2 = 15
      expect(stats.averageStability).toBe(15);
      // Average of (6+4)/2 = 5
      expect(stats.averageDifficulty).toBe(5);
    });

    it('should return 0 averages when only new cards', async () => {
      const deck = { id: 'deck-1', userId: 'user-1', cardCount: 1 };
      const cards = [makeCardRow('c1', 'deck-1', 0, null)];

      selectQueue = [[deck], cards];

      const stats = await fsrsService.getDeckStats('deck-1', 'user-1');
      expect(stats.averageDifficulty).toBe(0);
      expect(stats.averageStability).toBe(0);
    });

    it('should count overdue and due today', async () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const oneMinAgo = new Date(now.getTime() - 60 * 1000);
      const deck = { id: 'deck-1', userId: 'user-1', cardCount: 2 };
      const cards = [
        makeCardRow('overdue', 'deck-1', 0, {
          state: State.Review, due: yesterday.toISOString(),
          stability: 5, difficulty: 5, reps: 3, lapses: 0,
        }), // overdue (due < now)
        makeCardRow('due-today', 'deck-1', 1, {
          state: State.Learning, due: oneMinAgo.toISOString(),
          stability: 1, difficulty: 5, reps: 1, lapses: 0,
        }), // due (due <= todayEnd)
      ];

      selectQueue = [[deck], cards];

      const stats = await fsrsService.getDeckStats('deck-1', 'user-1');
      expect(stats.overdueCards).toBe(2); // Both are past due
      expect(stats.dueToday).toBe(2); // Both due today
    });
  });
});
