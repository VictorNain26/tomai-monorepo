/**
 * Tests unitaires - RevenueCat Webhook Handler (routes/revenuecat-webhook.handler.ts)
 * REWRITE — teste la vraie route Elysia via app.handle()
 * Mock: DB, webhook-idempotence, logger, env module
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';
import { makeRevenueCatEvent } from './_helpers/fixtures';

// ============================================
// MOCKS — env module MUST be set BEFORE handler import
// (WEBHOOK_AUTH_HEADER is read at module load time)
// ============================================

const TEST_WEBHOOK_SECRET = 'Bearer ' + 'x'.repeat(64); // ≥32 chars required in prod

const mockLogger = createMockLogger();
mock.module('../lib/observability', () => ({ logger: mockLogger }));

// Mock env module BEFORE importing the handler (which reads env.REVENUECAT_WEBHOOK_AUTH at load time)
mock.module('../config/env', () => ({
  env: {
    REVENUECAT_WEBHOOK_AUTH: TEST_WEBHOOK_SECRET,
    NODE_ENV: 'test',
  },
  isProduction: () => false,
}));

// Idempotency mock state
let isProcessedResult = false;
const mockMarkProcessed = mock(async () => {});
mock.module('../services/webhook-idempotence.service', () => ({
  isRevenueCatEventProcessed: mock(async () => isProcessedResult),
  markRevenueCatEventProcessed: mockMarkProcessed,
}));

// DB mock — trackable per-operation
const mockOnConflictDoUpdate = mock(() => Promise.resolve());
const mockInsertValues = mock(() => ({ onConflictDoUpdate: mockOnConflictDoUpdate }));
const mockInsert = mock(() => ({ values: mockInsertValues }));

const mockUpdateWhere = mock(() => Promise.resolve());
const mockUpdateSet = mock(() => ({ where: mockUpdateWhere }));
const mockUpdate = mock(() => ({ set: mockUpdateSet }));

let mockDbSelectResult: unknown[] = [];

mock.module('../db/connection', () => ({
  db: {
    select: mock(() => ({
      from: mock(() => ({
        where: mock(() => ({
          limit: mock(() => Promise.resolve(mockDbSelectResult)),
        })),
      })),
    })),
    insert: mockInsert,
    update: mockUpdate,
  },
}));

mock.module('../db/schema', () => ({
  familyBilling: { parentId: 'parentId' },
  userSubscriptions: { userId: 'userId' },
  subscriptionPlans: { id: 'id', name: 'name' },
}));

mock.module('drizzle-orm', () => ({
  eq: (...args: unknown[]) => ({ type: 'eq', args }),
  inArray: (...args: unknown[]) => ({ type: 'inArray', args }),
}));

// Plan lookup delegated to lib/plan-cache; mock returns fixed IDs
mock.module('../lib/plan-cache', () => ({
  getPremiumPlanId: mock(async () => 'plan-premium-001'),
  getFreePlanId: mock(async () => 'plan-free-001'),
}));

// Import AFTER env + mocks are set (critical for WEBHOOK_AUTH_HEADER)
const { createRevenueCatWebhookRoutes } = await import('../routes/revenuecat-webhook.handler');
const { Elysia } = await import('elysia');

function createTestApp() {
  return new Elysia().use(createRevenueCatWebhookRoutes());
}

function makeRCRequest(body: Record<string, unknown>, authHeader?: string) {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (authHeader) headers['authorization'] = authHeader;
  return new Request('http://localhost/webhooks/revenuecat/', {
    method: 'POST',
    body: JSON.stringify(body),
    headers,
  });
}

beforeEach(() => {
  isProcessedResult = false;
  mockDbSelectResult = [];
  mockInsert.mockClear();
  mockInsertValues.mockClear();
  mockOnConflictDoUpdate.mockClear();
  mockUpdate.mockClear();
  mockUpdateSet.mockClear();
  mockUpdateWhere.mockClear();
  mockMarkProcessed.mockClear();
});

describe('RevenueCat Webhook Handler', () => {
  describe('Authorization', () => {
    it('should reject invalid auth header (401)', async () => {
      const app = createTestApp();
      const event = makeRevenueCatEvent('TEST');
      const req = makeRCRequest(event, 'Bearer wrong-secret-that-does-not-match');
      const res = await app.handle(req);
      expect(res.status).toBe(401);
      const json = await res.json() as { error: string };
      expect(json.error).toBe('Unauthorized');
    });

    it('should reject missing auth header (401)', async () => {
      const app = createTestApp();
      const event = makeRevenueCatEvent('TEST');
      const req = makeRCRequest(event); // no auth header
      const res = await app.handle(req);
      expect(res.status).toBe(401);
    });

    it('should accept valid auth header (200)', async () => {
      const app = createTestApp();
      const event = makeRevenueCatEvent('TEST');
      const req = makeRCRequest(event, TEST_WEBHOOK_SECRET);
      const res = await app.handle(req);
      expect(res.status).toBe(200);
    });
  });

  describe('Idempotency', () => {
    it('should skip duplicate events and return duplicate flag', async () => {
      isProcessedResult = true;
      const app = createTestApp();
      const event = makeRevenueCatEvent('INITIAL_PURCHASE');
      const req = makeRCRequest(event, TEST_WEBHOOK_SECRET);
      const res = await app.handle(req);
      expect(res.status).toBe(200);
      const json = await res.json() as { received: boolean; duplicate: boolean };
      expect(json.duplicate).toBe(true);
      expect(json.received).toBe(true);
    });
  });

  describe('Event handling', () => {
    it('should handle TEST event (200)', async () => {
      const app = createTestApp();
      const event = makeRevenueCatEvent('TEST');
      const req = makeRCRequest(event, TEST_WEBHOOK_SECRET);
      const res = await app.handle(req);
      expect(res.status).toBe(200);
      const json = await res.json() as { received: boolean; event: string };
      expect(json.event).toBe('TEST');
    });

    it('should handle INITIAL_PURCHASE — inserts familyBilling + userSubscriptions', async () => {
      mockDbSelectResult = [{ id: 'plan-premium' }];
      const app = createTestApp();
      const event = makeRevenueCatEvent('INITIAL_PURCHASE', {
        subscriber_attributes: {
          children_ids: { value: '["child-001"]', updated_at_ms: Date.now() },
        },
      });
      const req = makeRCRequest(event, TEST_WEBHOOK_SECRET);
      const res = await app.handle(req);
      expect(res.status).toBe(200);
      // Side-effects: insert called for familyBilling + for each child's userSubscription
      expect(mockInsert).toHaveBeenCalled();
      expect(mockInsertValues).toHaveBeenCalled();
      expect(mockOnConflictDoUpdate).toHaveBeenCalled();
    });

    it('should handle RENEWAL — updates familyBilling + children status', async () => {
      const app = createTestApp();
      const event = makeRevenueCatEvent('RENEWAL', {
        subscriber_attributes: {
          children_ids: { value: '["child-001"]', updated_at_ms: Date.now() },
        },
      });
      const req = makeRCRequest(event, TEST_WEBHOOK_SECRET);
      const res = await app.handle(req);
      expect(res.status).toBe(200);
      // Side-effects: update familyBilling (status active) + update userSubscriptions (status active)
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockUpdateSet).toHaveBeenCalled();
      expect(mockUpdateWhere).toHaveBeenCalled();
    });

    it('should handle CANCELLATION — updates familyBilling status to canceled', async () => {
      const app = createTestApp();
      const event = makeRevenueCatEvent('CANCELLATION');
      const req = makeRCRequest(event, TEST_WEBHOOK_SECRET);
      const res = await app.handle(req);
      expect(res.status).toBe(200);
      // Side-effect: update familyBilling with billingStatus: 'canceled'
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ billingStatus: 'canceled' })
      );
    });

    it('should handle EXPIRATION — expires billing + downgrades children to free', async () => {
      mockDbSelectResult = [{ id: 'plan-free' }];
      const app = createTestApp();
      const event = makeRevenueCatEvent('EXPIRATION', {
        subscriber_attributes: {
          children_ids: { value: '["child-001"]', updated_at_ms: Date.now() },
        },
      });
      const req = makeRCRequest(event, TEST_WEBHOOK_SECRET);
      const res = await app.handle(req);
      expect(res.status).toBe(200);
      // Side-effects: update familyBilling (expired) + update userSubscriptions (free plan)
      expect(mockUpdate).toHaveBeenCalled();
      // First call: familyBilling → expired
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ billingStatus: 'expired', premiumChildrenCount: 0 })
      );
    });

    it('should handle BILLING_ISSUE — sets billing to past_due', async () => {
      const app = createTestApp();
      const event = makeRevenueCatEvent('BILLING_ISSUE');
      const req = makeRCRequest(event, TEST_WEBHOOK_SECRET);
      const res = await app.handle(req);
      expect(res.status).toBe(200);
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ billingStatus: 'past_due' })
      );
    });

    it('should handle UNCANCELLATION — reactivates billing', async () => {
      const app = createTestApp();
      const event = makeRevenueCatEvent('UNCANCELLATION');
      const req = makeRCRequest(event, TEST_WEBHOOK_SECRET);
      const res = await app.handle(req);
      expect(res.status).toBe(200);
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ billingStatus: 'active' })
      );
    });

    it('should handle PRODUCT_CHANGE (like renewal)', async () => {
      const app = createTestApp();
      const event = makeRevenueCatEvent('PRODUCT_CHANGE');
      const req = makeRCRequest(event, TEST_WEBHOOK_SECRET);
      const res = await app.handle(req);
      expect(res.status).toBe(200);
      const json = await res.json() as { event: string };
      expect(json.event).toBe('PRODUCT_CHANGE');
    });
  });

  describe('parseChildrenIds', () => {
    it('should parse valid JSON array from subscriber attributes', async () => {
      mockDbSelectResult = [{ id: 'plan-premium' }];
      const app = createTestApp();
      const event = makeRevenueCatEvent('INITIAL_PURCHASE', {
        subscriber_attributes: {
          children_ids: { value: '["child-1","child-2"]', updated_at_ms: Date.now() },
        },
      });
      const req = makeRCRequest(event, TEST_WEBHOOK_SECRET);
      const res = await app.handle(req);
      expect(res.status).toBe(200);
      // Both children should be processed → insert called multiple times
      expect(mockInsert).toHaveBeenCalled();
    });

    it('should handle invalid JSON gracefully (no children processed)', async () => {
      const app = createTestApp();
      const event = makeRevenueCatEvent('INITIAL_PURCHASE', {
        subscriber_attributes: {
          children_ids: { value: 'not-json', updated_at_ms: Date.now() },
        },
      });
      const req = makeRCRequest(event, TEST_WEBHOOK_SECRET);
      const res = await app.handle(req);
      expect(res.status).toBe(200);
    });

    it('should handle missing subscriber_attributes', async () => {
      const app = createTestApp();
      const event = makeRevenueCatEvent('INITIAL_PURCHASE');
      const req = makeRCRequest(event, TEST_WEBHOOK_SECRET);
      const res = await app.handle(req);
      expect(res.status).toBe(200);
    });
  });

  describe('Payload validation', () => {
    it('should reject a null event with 400 (not 500)', async () => {
      const app = createTestApp();
      const req = makeRCRequest(
        { api_version: '4.0', event: null } as unknown as Record<string, unknown>,
        TEST_WEBHOOK_SECRET
      );
      const res = await app.handle(req);
      expect(res.status).toBe(400);
      const json = await res.json() as { error: string };
      expect(json.error).toBe('Invalid payload');
    });

    it('should reject a payload missing required event fields with 400', async () => {
      const app = createTestApp();
      const req = makeRCRequest(
        { api_version: '4.0', event: { type: 'RENEWAL' } } as unknown as Record<string, unknown>,
        TEST_WEBHOOK_SECRET
      );
      const res = await app.handle(req);
      expect(res.status).toBe(400);
    });

    it('should reject an unknown event type with 400', async () => {
      const app = createTestApp();
      const event = makeRevenueCatEvent('TEST');
      (event as { event: { type: string } }).event.type = 'NOT_A_REAL_TYPE';
      const req = makeRCRequest(event, TEST_WEBHOOK_SECRET);
      const res = await app.handle(req);
      expect(res.status).toBe(400);
    });

    it('should still return 500 when a valid event makes a handler throw', async () => {
      mockMarkProcessed.mockImplementationOnce(async () => {
        throw new Error('DB down');
      });
      const app = createTestApp();
      const event = makeRevenueCatEvent('TEST');
      const req = makeRCRequest(event, TEST_WEBHOOK_SECRET);
      const res = await app.handle(req);
      expect(res.status).toBe(500);
    });
  });
});
