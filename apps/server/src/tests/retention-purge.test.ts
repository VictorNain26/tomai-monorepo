/**
 * Tests unitaires - Retention Purge Service
 * TDD: tests written before implementation.
 * Mock: DB + logger
 */

import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';

// ============================================
// MOCKS
// ============================================

const mockLogger = createMockLogger();
mock.module('../lib/observability', () => ({ logger: mockLogger }));

mock.module('drizzle-orm', () => ({
  lt: (...args: unknown[]) => ({ type: 'lt', args }),
}));

let episodesDeleteResult: { rowCount?: number } = { rowCount: 0 };
let auditDeleteResult: { rowCount?: number } = { rowCount: 0 };
let deleteCallCount = 0;

// Each call to db.delete() alternates: first call = episodes, second = audit.
// Track which table is being deleted by call order.
const mockDb = {
  delete: mock(() => {
    deleteCallCount++;
    const callIndex = deleteCallCount;
    return {
      where: mock(() => {
        return Promise.resolve(
          callIndex === 1 ? episodesDeleteResult : auditDeleteResult,
        );
      }),
    };
  }),
};

mock.module('../db/connection', () => ({ db: mockDb }));
mock.module('../db/schema/learning.schema', () => ({
  sessionEpisodes: { ttlUntil: 'ttl_until' },
}));
mock.module('../db/schema/audit.schema', () => ({
  retrievalAudit: { createdAt: 'created_at' },
}));

// Import after mocks
const { purgeExpiredData, startRetentionPurgeScheduler } = await import(
  '../services/retention-purge.service'
);

beforeEach(() => {
  episodesDeleteResult = { rowCount: 0 };
  auditDeleteResult = { rowCount: 0 };
  deleteCallCount = 0;
  mockDb.delete.mockClear();
  mockLogger.info.mockClear();
  mockLogger.error.mockClear();
});

afterEach(() => {
  // Ensure no leaked intervals from scheduler tests
});

describe('Retention Purge Service', () => {
  describe('purgeExpiredData', () => {
    it('deletes expired episodes and old audit rows, returns both counts', async () => {
      episodesDeleteResult = { rowCount: 7 };
      auditDeleteResult = { rowCount: 42 };

      const result = await purgeExpiredData();

      expect(result.episodesDeleted).toBe(7);
      expect(result.auditRowsDeleted).toBe(42);
      // Two delete calls: one per table
      expect(mockDb.delete).toHaveBeenCalledTimes(2);
    });

    it('handles zero deletions gracefully', async () => {
      episodesDeleteResult = { rowCount: 0 };
      auditDeleteResult = { rowCount: 0 };

      const result = await purgeExpiredData();

      expect(result.episodesDeleted).toBe(0);
      expect(result.auditRowsDeleted).toBe(0);
    });

    it('handles missing rowCount (null/undefined) as 0', async () => {
      episodesDeleteResult = {};
      auditDeleteResult = {};

      const result = await purgeExpiredData();

      expect(result.episodesDeleted).toBe(0);
      expect(result.auditRowsDeleted).toBe(0);
    });

    it('logs one info entry with both counts after a successful run', async () => {
      episodesDeleteResult = { rowCount: 3 };
      auditDeleteResult = { rowCount: 10 };

      await purgeExpiredData();

      expect(mockLogger.info).toHaveBeenCalledTimes(1);
      const [, meta] = mockLogger.info.mock.calls[0] as unknown as [string, Record<string, unknown>];
      expect(meta.operation).toBe('retention-purge:run');
    });
  });

  describe('startRetentionPurgeScheduler', () => {
    it('runs an immediate purge at startup', async () => {
      episodesDeleteResult = { rowCount: 1 };
      auditDeleteResult = { rowCount: 2 };

      const stop = startRetentionPurgeScheduler();

      // Give the fire-and-forget microtask a chance to run
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockDb.delete).toHaveBeenCalled();

      stop();
    });

    it('returns a stop function that clears the interval without throwing', async () => {
      const stop = startRetentionPurgeScheduler();

      // Should not throw
      expect(() => stop()).not.toThrow();
    });
  });
});
