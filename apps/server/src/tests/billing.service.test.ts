/**
 * Tests unitaires - BillingService (services/billing/billing.service.ts)
 * Mock: DB + plan id helpers + logger
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';

const mockLogger = createMockLogger();
mock.module('../lib/observability', () => ({ logger: mockLogger }));

// Capture per-operation DB mock state
const mockOnConflictDoUpdate = mock(() => Promise.resolve());
const mockInsertValues = mock(() => ({ onConflictDoUpdate: mockOnConflictDoUpdate }));
const mockInsert = mock(() => ({ values: mockInsertValues }));

const mockUpdateWhere = mock(() => Promise.resolve());
let lastUpdateSetPayload: Record<string, unknown> | null = null;
const mockUpdateSet = mock((payload: Record<string, unknown>) => {
  lastUpdateSetPayload = payload;
  return { where: mockUpdateWhere };
});
const mockUpdate = mock(() => ({ set: mockUpdateSet }));

mock.module('../db/connection', () => ({
  db: { insert: mockInsert, update: mockUpdate },
}));

mock.module('../db/schema', () => ({
  familyBilling: { parentId: 'parentId' },
  userSubscriptions: { userId: 'userId' },
}));

mock.module('drizzle-orm', () => ({
  eq: (...args: unknown[]) => ({ type: 'eq', args }),
  inArray: (...args: unknown[]) => ({ type: 'inArray', args }),
}));

mock.module('../lib/plan-cache', () => ({
  getPremiumPlanId: mock(async () => 'plan-premium'),
  getFreePlanId: mock(async () => 'plan-free'),
}));

const { billingService } = await import('../services/billing');

beforeEach(() => {
  mockInsert.mockClear();
  mockInsertValues.mockClear();
  mockOnConflictDoUpdate.mockClear();
  mockUpdate.mockClear();
  mockUpdateSet.mockClear();
  mockUpdateWhere.mockClear();
  lastUpdateSetPayload = null;
});

describe('BillingService', () => {
  describe('activatePremium', () => {
    it('upserts family_billing with RevenueCat provider columns', async () => {
      await billingService.activatePremium({
        parentId: 'parent-001',
        childrenIds: [],
        period: { start: new Date('2026-01-01'), end: new Date('2026-02-01') },
        monthlyAmountCents: 1500,
        source: { provider: 'revenuecat', customerId: 'rc-user-1', productId: 'prod_monthly' },
      });
      expect(mockInsert).toHaveBeenCalledTimes(1);
      const values = (mockInsertValues.mock.calls[0]?.[0] ?? {}) as Record<string, unknown>;
      expect(values.revenuecatCustomerId).toBe('rc-user-1');
      expect(values.revenuecatSubscriptionId).toBe('prod_monthly');
      expect(values.billingStatus).toBe('active');
    });

    it('promotes each child to premium plan via upsert', async () => {
      await billingService.activatePremium({
        parentId: 'parent-003',
        childrenIds: ['child-a', 'child-b'],
        period: { start: new Date(), end: new Date() },
        source: { provider: 'revenuecat', customerId: 'rc-user-1', productId: 'prod_monthly' },
      });
      // 1 family_billing insert + 2 child upserts = 3 inserts
      expect(mockInsert).toHaveBeenCalledTimes(3);
    });
  });

  describe('extendActivePeriod', () => {
    it('updates family_billing status to active and resets counters when requested', async () => {
      await billingService.extendActivePeriod({
        parentId: 'parent-004',
        childrenIds: ['child-a'],
        period: { start: new Date(), end: new Date() },
        resetChildCounters: true,
      });
      // 1 update for billing + 1 update for children
      expect(mockUpdate).toHaveBeenCalledTimes(2);
    });

    it('skips child update when no children', async () => {
      await billingService.extendActivePeriod({
        parentId: 'parent-005',
        childrenIds: [],
        period: { start: new Date(), end: new Date() },
        resetChildCounters: false,
      });
      expect(mockUpdate).toHaveBeenCalledTimes(1);
    });
  });

  describe('markPastDue', () => {
    it('sets billingStatus past_due and pauses children', async () => {
      await billingService.markPastDue('parent-006', ['child-a']);
      expect(mockUpdate).toHaveBeenCalledTimes(2);
      // Capture the first .set() payload (the billing update)
      const firstSetPayload = (mockUpdateSet.mock.calls[0]?.[0] ?? {}) as Record<string, unknown>;
      expect(firstSetPayload.billingStatus).toBe('past_due');
    });
  });

  describe('markCanceled / markUncanceled', () => {
    it('toggles billingStatus without touching children', async () => {
      await billingService.markCanceled('parent-007');
      expect(mockUpdate).toHaveBeenCalledTimes(1);
      expect(lastUpdateSetPayload?.billingStatus).toBe('canceled');

      mockUpdate.mockClear();
      await billingService.markUncanceled('parent-007');
      expect(mockUpdate).toHaveBeenCalledTimes(1);
      expect(lastUpdateSetPayload?.billingStatus).toBe('active');
    });
  });

  describe('expireAndDowngrade', () => {
    it('sets billing expired and downgrades children to free plan', async () => {
      await billingService.expireAndDowngrade('parent-008', ['child-a']);
      // 1 update billing + 1 update children (downgrade to free)
      expect(mockUpdate).toHaveBeenCalledTimes(2);
    });

    it('zeroes monthlyAmountCents and resets premiumChildrenCount to 0', async () => {
      await billingService.expireAndDowngrade('parent-009', []);
      const payload = (mockUpdateSet.mock.calls[0]?.[0] ?? {}) as Record<string, unknown>;
      expect(payload.billingStatus).toBe('expired');
      expect(payload.premiumChildrenCount).toBe(0);
      expect(payload.monthlyAmountCents).toBe(0);
    });
  });
});
