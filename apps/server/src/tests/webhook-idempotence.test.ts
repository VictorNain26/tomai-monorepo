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
      if (dbInsertShouldThrow) throw dbInsertShouldThrow;
      return Promise.resolve();
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
  isStripeEventProcessed,
  markStripeEventProcessed,
  isRevenueCatEventProcessed,
  markRevenueCatEventProcessed,
} = await import('../services/webhook-idempotence.service');

beforeEach(() => {
  dbSelectResult = [];
  dbInsertShouldThrow = null;
  dbDeleteResult = { rowCount: 0 };
  dbSelectShouldThrow = null;
  dbDeleteShouldThrow = null;
});

describe('Webhook Idempotence Service', () => {
  describe('isProcessed', () => {
    it('should return true when event exists', async () => {
      dbSelectResult = [{ id: 'uuid-123' }];
      expect(await webhookIdempotenceService.isProcessed('evt_123')).toBe(true);
    });

    it('should return false when event does not exist', async () => {
      dbSelectResult = [];
      expect(await webhookIdempotenceService.isProcessed('evt_new')).toBe(false);
    });

    it('should fail-open on DB error (return false)', async () => {
      dbSelectShouldThrow = new Error('Connection refused');
      expect(await webhookIdempotenceService.isProcessed('evt_err')).toBe(false);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('markProcessed', () => {
    it('should insert successfully and return true', async () => {
      dbInsertShouldThrow = null;
      const result = await webhookIdempotenceService.markProcessed('evt_1', 'stripe', 'checkout.session.completed');
      expect(result).toBe(true);
    });

    it('should handle duplicate key gracefully and return false', async () => {
      dbInsertShouldThrow = new Error('duplicate key value violates unique constraint');
      const result = await webhookIdempotenceService.markProcessed('evt_dup', 'stripe', 'invoice.paid');
      expect(result).toBe(false);
    });

    it('should return false on generic DB error', async () => {
      dbInsertShouldThrow = new Error('Connection timeout');
      const result = await webhookIdempotenceService.markProcessed('evt_err', 'revenuecat', 'INITIAL_PURCHASE');
      expect(result).toBe(false);
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

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

  describe('Stripe/RevenueCat helper functions', () => {
    it('isStripeEventProcessed should delegate to isProcessed', async () => {
      dbSelectResult = [{ id: 'x' }];
      expect(await isStripeEventProcessed('evt_stripe')).toBe(true);
    });

    it('markStripeEventProcessed should delegate to markProcessed', async () => {
      dbInsertShouldThrow = null;
      await markStripeEventProcessed('evt_s1', 'invoice.paid');
      // Should not throw
    });

    it('isRevenueCatEventProcessed should delegate to isProcessed', async () => {
      dbSelectResult = [];
      expect(await isRevenueCatEventProcessed('rc_evt_1')).toBe(false);
    });

    it('markRevenueCatEventProcessed should delegate to markProcessed', async () => {
      dbInsertShouldThrow = null;
      await markRevenueCatEventProcessed('rc_evt_1', 'RENEWAL');
      // Should not throw
    });
  });
});
