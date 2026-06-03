/**
 * Tests unitaires - Webhook Idempotence Service
 * Mock: DB + logger
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';

// ============================================
// MOCKS
// ============================================

const mockLogger = createMockLogger();
mock.module('../lib/observability', () => ({ logger: mockLogger }));

// Mock drizzle-orm operators (must include all operators used by the service)
mock.module('drizzle-orm', () => ({
  eq: (...args: unknown[]) => ({ type: 'eq', args }),
  lt: (...args: unknown[]) => ({ type: 'lt', args }),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ type: 'sql', strings, values }),
  inArray: (...args: unknown[]) => ({ type: 'inArray', args }),
  desc: (...args: unknown[]) => ({ type: 'desc', args }),
}));

// DB mock state
let dbSelectResult: unknown[] = [];
let dbInsertRowCount: number = 1;
let dbInsertShouldThrow: Error | null = null;
let dbDeleteResult: { rowCount?: number } = { rowCount: 0 };
let dbSelectShouldThrow: Error | null = null;
let dbDeleteShouldThrow: Error | null = null;

const mockDbChain = {
  select: mock(() => ({
    from: mock(() => ({
      where: mock(() => ({
        limit: mock(() => {
          if (dbSelectShouldThrow) throw dbSelectShouldThrow;
          return Promise.resolve(dbSelectResult);
        }),
      })),
    })),
  })),
  insert: mock(() => ({
    values: mock(() => {
      // Return object with onConflictDoNothing for tryClaim
      if (dbInsertShouldThrow) {
        return Promise.reject(dbInsertShouldThrow);
      }
      // Simulate .returning({ id: ... }).then result: array of inserted rows
      const result = Promise.resolve(dbInsertRowCount === 1 ? [{ id: 'evt_id' }] : []);
      return {
        onConflictDoNothing: mock(() => ({
          returning: mock(() => result),
        })),
      };
    }),
  })),
  delete: mock(() => ({
    where: mock(() => {
      if (dbDeleteShouldThrow) throw dbDeleteShouldThrow;
      return Promise.resolve(dbDeleteResult);
    }),
  })),
};

mock.module('../db/connection', () => ({ db: mockDbChain }));
mock.module('../db/schema', () => ({
  webhookEvents: { id: 'id', eventId: 'eventId', expiresAt: 'expiresAt' },
}));

// Import after mocks
const {
  webhookIdempotenceService,
  tryClaimRevenueCatEvent,
} = await import('../services/webhook-idempotence.service');

beforeEach(() => {
  dbSelectResult = [];
  dbInsertRowCount = 1;
  dbInsertShouldThrow = null;
  dbDeleteResult = { rowCount: 0 };
  dbSelectShouldThrow = null;
  dbDeleteShouldThrow = null;
});

describe('Webhook Idempotence Service', () => {
  describe('cleanupExpired', () => {
    it('should delete expired events and return count', async () => {
      dbDeleteResult = { rowCount: 15 };
      const result = await webhookIdempotenceService.cleanupExpired();
      expect(result).toBe(15);
    });

    it('should return 0 when nothing to clean', async () => {
      dbDeleteResult = { rowCount: 0 };
      const result = await webhookIdempotenceService.cleanupExpired();
      expect(result).toBe(0);
    });

    it('should return 0 on error', async () => {
      dbDeleteShouldThrow = new Error('DB error');
      const result = await webhookIdempotenceService.cleanupExpired();
      expect(result).toBe(0);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('tryClaim - Atomic idempotence', () => {
    it('should return true when event is newly claimed (result.length === 1)', async () => {
      dbInsertRowCount = 1;
      const result = await webhookIdempotenceService.tryClaim('evt_new', 'revenuecat', 'INITIAL_PURCHASE');
      expect(result).toBe(true);
    });

    it('should return false when event already claimed (result.length === 0)', async () => {
      dbInsertRowCount = 0;
      const result = await webhookIdempotenceService.tryClaim('evt_dup', 'revenuecat', 'RENEWAL');
      expect(result).toBe(false);
    });

    it('should throw on DB error (fail-closed)', async () => {
      dbInsertShouldThrow = new Error('Connection timeout');
      expect(async () => {
        await webhookIdempotenceService.tryClaim('evt_err', 'revenuecat', 'INITIAL_PURCHASE');
      }).toThrow();
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('tryClaimRevenueCatEvent - helper function', () => {
    it('should return true for new events', async () => {
      dbInsertRowCount = 1;
      const result = await tryClaimRevenueCatEvent('rc_evt_new', 'INITIAL_PURCHASE');
      expect(result).toBe(true);
    });

    it('should return false for duplicate events', async () => {
      dbInsertRowCount = 0;
      const result = await tryClaimRevenueCatEvent('rc_evt_dup', 'RENEWAL');
      expect(result).toBe(false);
    });
  });
});
