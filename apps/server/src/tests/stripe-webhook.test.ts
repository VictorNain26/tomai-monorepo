/**
 * Tests unitaires - Stripe Webhook Handler (routes/stripe-webhook.handler.ts)
 * REWRITE — teste la vraie route Elysia via app.handle()
 * Mock: Stripe SDK, DB, webhook-idempotence, logger
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';
import { makeFamilyBilling } from './_helpers/fixtures';

// ============================================
// MOCKS
// ============================================

const mockLogger = createMockLogger();
mock.module('../lib/observability', () => ({ logger: mockLogger }));

// Idempotency mock state
let isProcessedResult = false;
const mockMarkStripeProcessed = mock(async () => {});
mock.module('../services/webhook-idempotence.service', () => ({
  isStripeEventProcessed: mock(async () => isProcessedResult),
  markStripeEventProcessed: mockMarkStripeProcessed,
}));

// DB mock — trackable per-operation
const mockOnConflictDoUpdate = mock(() => Promise.resolve());
const mockInsertValues = mock(() => ({ onConflictDoUpdate: mockOnConflictDoUpdate }));
const mockInsert = mock(() => ({ values: mockInsertValues }));

const mockUpdateWhere = mock(() => Promise.resolve());
const mockUpdateSet = mock(() => ({ where: mockUpdateWhere }));
const mockUpdate = mock(() => ({ set: mockUpdateSet }));

let dbSelectResult: unknown[] = [];

mock.module('../db/connection', () => ({
  db: {
    select: mock(() => ({
      from: mock(() => ({
        where: mock(() => ({
          limit: mock(() => Promise.resolve(dbSelectResult)),
        })),
      })),
    })),
    insert: mockInsert,
    update: mockUpdate,
  },
}));

mock.module('../db/schema', () => ({
  familyBilling: { parentId: 'parentId', stripeCustomerId: 'stripeCustomerId' },
  userSubscriptions: { userId: 'userId' },
  subscriptionPlans: { id: 'id', name: 'name' },
}));

// BillingService now centralizes the webhook DB mutations (commit Item 6).
// Stub it so the handler tests only observe "was X called" without touching DB.
const mockActivatePremium = mock(async () => {});
const mockExtendActivePeriod = mock(async () => {});
const mockMarkPastDue = mock(async () => {});
const mockExpireAndDowngrade = mock(async () => {});
mock.module('../services/billing', () => ({
  billingService: {
    activatePremium: mockActivatePremium,
    extendActivePeriod: mockExtendActivePeriod,
    markPastDue: mockMarkPastDue,
    expireAndDowngrade: mockExpireAndDowngrade,
    markCanceled: mock(async () => {}),
    markUncanceled: mock(async () => {}),
  },
}));

// lib/stripe/config is now imported directly (no longer via stripeService)
mock.module('../lib/stripe/config', () => ({
  getPremiumPlanId: mock(async () => 'plan-premium'),
  getFreePlanId: mock(async () => 'plan-free'),
}));

mock.module('drizzle-orm', () => ({
  eq: (...args: unknown[]) => ({ type: 'eq', args }),
  inArray: (...args: unknown[]) => ({ type: 'inArray', args }),
}));

// Stripe SDK mock
let constructEventResult: Record<string, unknown> | null = null;
let constructEventShouldThrow: Error | null = null;

mock.module('../lib/stripe', () => ({
  requireStripe: mock(() => ({
    subscriptions: {
      retrieve: mock(async () => ({
        items: { data: [{ current_period_start: 1718400000, current_period_end: 1721000000 }] },
        metadata: { childrenIds: '["child-001"]' },
        status: 'active',
        cancel_at_period_end: false,
      })),
    },
  })),
  stripeService: {
    constructWebhookEventAsync: mock(async () => {
      if (constructEventShouldThrow) throw constructEventShouldThrow;
      return constructEventResult;
    }),
    getPremiumPlanConfig: mock(async () => ({ basePrice: 1500, extraChildPrice: 500 })),
    calculateMonthlyPrice: mock((_count: number) => 1500),
    getPremiumPlanId: mock(async () => 'plan-premium'),
    getFreePlanId: mock(async () => 'plan-free'),
  },
  parseChildrenIdsFromMetadata: mock((s: string | undefined) => {
    if (!s) return [];
    try { return JSON.parse(s); } catch { return []; }
  }),
}));

// Import after mocks
const { createWebhookRoutes } = await import('../routes/stripe-webhook.handler');
const { Elysia } = await import('elysia');

function createTestApp() {
  return new Elysia().use(createWebhookRoutes('whsec_test'));
}

function makeStripeRequest(body: string, headers?: Record<string, string>) {
  return new Request('http://localhost/webhooks/stripe/', {
    method: 'POST',
    body,
    headers: {
      'content-type': 'application/json',
      'stripe-signature': 'sig_test',
      ...headers,
    },
  });
}

beforeEach(() => {
  isProcessedResult = false;
  constructEventShouldThrow = null;
  dbSelectResult = [];
  mockInsert.mockClear();
  mockInsertValues.mockClear();
  mockOnConflictDoUpdate.mockClear();
  mockUpdate.mockClear();
  mockUpdateSet.mockClear();
  mockUpdateWhere.mockClear();
  mockMarkStripeProcessed.mockClear();
  mockActivatePremium.mockClear();
  mockExtendActivePeriod.mockClear();
  mockMarkPastDue.mockClear();
  mockExpireAndDowngrade.mockClear();
  constructEventResult = {
    id: 'evt_test_001',
    type: 'checkout.session.completed',
    data: {
      object: {
        customer: 'cus_123',
        subscription: 'sub_123',
        metadata: { parentId: 'parent-001', childrenIds: '["child-001"]', childrenCount: '1' },
      },
    },
  };
});

describe('Stripe Webhook Handler', () => {
  describe('Security', () => {
    it('should reject oversized Content-Length (413)', async () => {
      const app = createTestApp();
      const req = makeStripeRequest('{}', { 'content-length': '300000' });
      const res = await app.handle(req);
      expect(res.status).toBe(413);
      const json = await res.json() as { error: string };
      expect(json.error).toContain('too large');
    });

    it('should reject missing stripe-signature (400)', async () => {
      const app = createTestApp();
      const req = new Request('http://localhost/webhooks/stripe/', {
        method: 'POST',
        body: '{}',
        headers: { 'content-type': 'application/json' },
      });
      const res = await app.handle(req);
      expect(res.status).toBe(400);
      const json = await res.json() as { error: string };
      expect(json.error).toContain('Missing stripe-signature');
    });

    it('should reject invalid signature (400)', async () => {
      constructEventShouldThrow = new Error('Invalid signature');
      const app = createTestApp();
      const req = makeStripeRequest('{}');
      const res = await app.handle(req);
      expect(res.status).toBe(400);
      const json = await res.json() as { error: string };
      expect(json.error).toContain('Invalid signature');
    });
  });

  describe('Idempotency', () => {
    it('should skip duplicate events', async () => {
      isProcessedResult = true;
      const app = createTestApp();
      const req = makeStripeRequest('{}');
      const res = await app.handle(req);
      expect(res.status).toBe(200);
      const json = await res.json() as { received: boolean; duplicate: boolean };
      expect(json.duplicate).toBe(true);
      expect(json.received).toBe(true);
    });
  });

  describe('checkout.session.completed', () => {
    it('should activate premium via BillingService', async () => {
      const app = createTestApp();
      const req = makeStripeRequest('{}');
      const res = await app.handle(req);
      expect(res.status).toBe(200);
      const json = await res.json() as { received: boolean; event: string };
      expect(json.received).toBe(true);
      expect(json.event).toBe('checkout.session.completed');
      expect(mockActivatePremium).toHaveBeenCalledWith(
        expect.objectContaining({
          parentId: 'parent-001',
          childrenIds: ['child-001'],
          source: expect.objectContaining({ provider: 'stripe' }),
        }),
      );
    });

    it('should handle checkout without subscription (early return)', async () => {
      constructEventResult = {
        id: 'evt_test_002',
        type: 'checkout.session.completed',
        data: { object: { customer: 'cus_123', subscription: null, metadata: {} } },
      };
      const app = createTestApp();
      const req = makeStripeRequest('{}');
      const res = await app.handle(req);
      expect(res.status).toBe(200);
      expect(mockActivatePremium).not.toHaveBeenCalled();
    });

    it('should handle checkout without parentId (early return)', async () => {
      constructEventResult = {
        id: 'evt_test_003',
        type: 'checkout.session.completed',
        data: { object: { customer: 'cus_123', subscription: 'sub_x', metadata: {} } },
      };
      const app = createTestApp();
      const req = makeStripeRequest('{}');
      const res = await app.handle(req);
      expect(res.status).toBe(200);
      expect(mockActivatePremium).not.toHaveBeenCalled();
    });
  });

  describe('invoice.paid', () => {
    it('should extend active period via BillingService', async () => {
      const billing = makeFamilyBilling();
      dbSelectResult = [billing];
      constructEventResult = {
        id: 'evt_inv_001',
        type: 'invoice.paid',
        data: {
          object: { customer: 'cus_test123', subscription: 'sub_test123' },
        },
      };
      const app = createTestApp();
      const req = makeStripeRequest('{}');
      const res = await app.handle(req);
      expect(res.status).toBe(200);
      expect(mockExtendActivePeriod).toHaveBeenCalledWith(
        expect.objectContaining({
          parentId: billing.parentId,
          resetChildCounters: true,
        }),
      );
    });

    it('should skip non-subscription invoice', async () => {
      constructEventResult = {
        id: 'evt_inv_002',
        type: 'invoice.paid',
        data: { object: { customer: 'cus_123' } },
      };
      const app = createTestApp();
      const req = makeStripeRequest('{}');
      const res = await app.handle(req);
      expect(res.status).toBe(200);
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  describe('invoice.payment_failed', () => {
    it('should mark past_due via BillingService', async () => {
      const billing = makeFamilyBilling();
      dbSelectResult = [billing];
      constructEventResult = {
        id: 'evt_fail_001',
        type: 'invoice.payment_failed',
        data: { object: { customer: 'cus_test123', subscription: 'sub_test123' } },
      };
      const app = createTestApp();
      const req = makeStripeRequest('{}');
      const res = await app.handle(req);
      expect(res.status).toBe(200);
      expect(mockMarkPastDue).toHaveBeenCalledWith(billing.parentId, expect.any(Array));
    });
  });

  describe('customer.subscription.updated', () => {
    it('should handle active subscription — billingStatus active', async () => {
      const billing = makeFamilyBilling();
      dbSelectResult = [billing];
      constructEventResult = {
        id: 'evt_sub_001',
        type: 'customer.subscription.updated',
        data: {
          object: {
            customer: 'cus_test123',
            status: 'active',
            cancel_at_period_end: false,
            items: { data: [{ current_period_start: 1718400000, current_period_end: 1721000000 }] },
            metadata: { childrenIds: '["child-001"]' },
          },
        },
      };
      const app = createTestApp();
      const req = makeStripeRequest('{}');
      const res = await app.handle(req);
      expect(res.status).toBe(200);
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ billingStatus: 'active' })
      );
    });

    it('should handle cancel_at_period_end — billingStatus canceled', async () => {
      const billing = makeFamilyBilling();
      dbSelectResult = [billing];
      constructEventResult = {
        id: 'evt_sub_002',
        type: 'customer.subscription.updated',
        data: {
          object: {
            customer: 'cus_test123',
            status: 'active',
            cancel_at_period_end: true,
            items: { data: [] },
            metadata: {},
          },
        },
      };
      const app = createTestApp();
      const req = makeStripeRequest('{}');
      const res = await app.handle(req);
      expect(res.status).toBe(200);
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ billingStatus: 'canceled' })
      );
    });

    it('should handle canceled subscription — billingStatus expired', async () => {
      const billing = makeFamilyBilling();
      dbSelectResult = [billing];
      constructEventResult = {
        id: 'evt_sub_003',
        type: 'customer.subscription.updated',
        data: {
          object: {
            customer: 'cus_test123',
            status: 'canceled',
            cancel_at_period_end: false,
            items: { data: [] },
            metadata: { childrenIds: '["child-001"]' },
          },
        },
      };
      const app = createTestApp();
      const req = makeStripeRequest('{}');
      const res = await app.handle(req);
      expect(res.status).toBe(200);
      expect(mockUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ billingStatus: 'expired' })
      );
    });
  });

  describe('customer.subscription.deleted', () => {
    it('should expire via BillingService (stripe flag clears subscription id)', async () => {
      const billing = makeFamilyBilling();
      dbSelectResult = [billing];
      constructEventResult = {
        id: 'evt_del_001',
        type: 'customer.subscription.deleted',
        data: {
          object: {
            customer: 'cus_test123',
            metadata: { childrenIds: '["child-001"]' },
          },
        },
      };
      const app = createTestApp();
      const req = makeStripeRequest('{}');
      const res = await app.handle(req);
      expect(res.status).toBe(200);
      expect(mockExpireAndDowngrade).toHaveBeenCalledWith(
        billing.parentId,
        ['child-001'],
        { clearStripeSubscriptionId: true },
      );
    });
  });

  describe('subscription_schedule.updated', () => {
    it('should handle remove_children action — updates billing + downgrades children', async () => {
      constructEventResult = {
        id: 'evt_sched_001',
        type: 'subscription_schedule.updated',
        data: {
          object: {
            metadata: {
              pendingAction: 'remove_children',
              parentId: 'parent-001',
              removedChildrenIds: '["child-002"]',
            },
            current_phase: { start_date: 1000 },
            phases: [
              { start_date: 500 },
              { start_date: 1000, metadata: { action: 'remove_children', childrenCount: '1' } },
            ],
          },
        },
      };
      const app = createTestApp();
      const req = makeStripeRequest('{}');
      const res = await app.handle(req);
      expect(res.status).toBe(200);
      // Side-effects: update familyBilling (new childrenCount) + update removed children to free
      expect(mockUpdate).toHaveBeenCalled();
      expect(mockUpdateSet).toHaveBeenCalled();
    });

    it('should skip non-remove_children action (no DB writes)', async () => {
      constructEventResult = {
        id: 'evt_sched_002',
        type: 'subscription_schedule.updated',
        data: { object: { metadata: {}, phases: [] } },
      };
      const app = createTestApp();
      const req = makeStripeRequest('{}');
      const res = await app.handle(req);
      expect(res.status).toBe(200);
      expect(mockUpdate).not.toHaveBeenCalled();
    });
  });

  describe('Error containment', () => {
    it('should return 500 when handler throws', async () => {
      constructEventResult = {
        id: 'evt_err_001',
        type: 'checkout.session.completed',
        data: { object: null },
      };
      const app = createTestApp();
      const req = makeStripeRequest('{}');
      const res = await app.handle(req);
      expect(res.status).toBe(500);
      const json = await res.json() as { error: string };
      expect(json.error).toContain('Webhook processing failed');
    });

    it('should handle unhandled event types gracefully (200)', async () => {
      constructEventResult = {
        id: 'evt_unknown_001',
        type: 'unknown.event.type',
        data: { object: {} },
      };
      const app = createTestApp();
      const req = makeStripeRequest('{}');
      const res = await app.handle(req);
      expect(res.status).toBe(200);
      const json = await res.json() as { received: boolean };
      expect(json.received).toBe(true);
    });
  });
});
