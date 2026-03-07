/**
 * Tests unitaires - Token Quota Service (services/token-quota.service.ts)
 * REWRITE — behavioral tests for helpers via incrementTokenUsage
 * Mock: DB + logger
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';

// ============================================
// MOCKS
// ============================================

const mockLogger = createMockLogger();
mock.module('../lib/observability', () => ({ logger: mockLogger }));

// DB mock state
let dbSelectResult: unknown[] = [];
let dbUpdateResult = { rowCount: 1 };
let dbInsertShouldThrow = false;

const mockUpdateWhere = mock(() => Promise.resolve(dbUpdateResult));
const mockUpdateSet = mock(() => ({ where: mockUpdateWhere }));
const mockDbUpdate = mock(() => ({ set: mockUpdateSet }));

mock.module('../db/connection', () => ({
  db: {
    select: mock(() => ({
      from: mock(() => ({
        where: mock(() => ({
          limit: mock(() => Promise.resolve(dbSelectResult)),
        })),
        innerJoin: mock(() => ({
          where: mock(() => ({
            limit: mock(() => Promise.resolve(dbSelectResult)),
          })),
        })),
      })),
    })),
    insert: mock(() => ({
      values: mock(() => {
        if (dbInsertShouldThrow) throw new Error('Insert failed');
        return Promise.resolve();
      }),
    })),
    update: mockDbUpdate,
  },
}));

mock.module('../db/schema', () => ({
  userSubscriptions: {
    userId: 'userId',
    planId: 'planId',
    windowTokensUsed: 'windowTokensUsed',
    windowStartAt: 'windowStartAt',
    tokensUsedToday: 'tokensUsedToday',
    tokensUsedThisWeek: 'tokensUsedThisWeek',
    totalTokensUsed: 'totalTokensUsed',
    totalMessagesCount: 'totalMessagesCount',
    lastResetAt: 'lastResetAt',
    lastWeeklyResetAt: 'lastWeeklyResetAt',
    lastMonthlyResetAt: 'lastMonthlyResetAt',
    decksGeneratedToday: 'decksGeneratedToday',
    decksGeneratedThisMonth: 'decksGeneratedThisMonth',
    updatedAt: 'updatedAt',
  },
  subscriptionPlans: {
    id: 'id',
    name: 'name',
    dailyTokenLimit: 'dailyTokenLimit',
  },
}));

mock.module('drizzle-orm', () => ({
  eq: (...args: unknown[]) => ({ type: 'eq', args }),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ type: 'sql', strings, values }),
}));

// Import after mocks
const { tokenQuotaService } = await import('../services/token-quota.service');

// Helper to create a subscription DB row for incrementTokenUsage
function makeDbSubscription(overrides?: Record<string, unknown>) {
  return {
    planId: 'plan-free',
    planName: 'free',
    dailyLimit: 15000,
    windowTokensUsed: 0,
    windowStartAt: new Date(),
    tokensUsedToday: 0,
    tokensUsedThisWeek: 0,
    totalTokensUsed: 0,
    totalMessagesCount: 0,
    lastResetAt: new Date(),
    lastWeeklyResetAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  dbSelectResult = [];
  dbUpdateResult = { rowCount: 1 };
  dbInsertShouldThrow = false;
  mockDbUpdate.mockClear();
  mockUpdateSet.mockClear();
  mockUpdateWhere.mockClear();
});

describe('Token Quota Service', () => {
  describe('checkQuota (currently disabled — returns unlimited)', () => {
    it('should return allowed=true with normal mode', async () => {
      const result = await tokenQuotaService.checkQuota('user-001');
      expect(result.allowed).toBe(true);
      expect(result.mode).toBe('normal');
      expect(result.plan).toBe('premium');
    });
  });

  describe('incrementTokenUsage — behavioral window/reset tests', () => {
    it('should increment counters when window is fresh (not expired)', async () => {
      dbSelectResult = [makeDbSubscription({
        windowStartAt: new Date(), // Just started → not expired
        windowTokensUsed: 1000,
        tokensUsedToday: 2000,
      })];
      const result = await tokenQuotaService.incrementTokenUsage('user-001', 500);
      expect(result.success).toBe(true);
      expect(result.newWindowTokensUsed).toBe(1500); // 1000 + 500
      expect(result.newDailyTokensUsed).toBe(2500); // 2000 + 500
    });

    it('should reset window tokens when window expired (>5h)', async () => {
      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
      dbSelectResult = [makeDbSubscription({
        windowStartAt: sixHoursAgo,
        windowTokensUsed: 4000, // Should be reset to 0 before adding
        tokensUsedToday: 2000,
      })];
      const result = await tokenQuotaService.incrementTokenUsage('user-001', 500);
      expect(result.success).toBe(true);
      // Window was reset → only the new 500 tokens
      expect(result.newWindowTokensUsed).toBe(500);
    });

    it('should not reset window at exactly 4h59m (still valid)', async () => {
      const fourHours59Min = new Date(Date.now() - (4 * 60 + 59) * 60 * 1000);
      dbSelectResult = [makeDbSubscription({
        windowStartAt: fourHours59Min,
        windowTokensUsed: 3000,
      })];
      const result = await tokenQuotaService.incrementTokenUsage('user-001', 500);
      expect(result.success).toBe(true);
      expect(result.newWindowTokensUsed).toBe(3500); // 3000 + 500, not reset
    });

    it('should return correct mode when near window limit (>= 95% → throttle)', async () => {
      // Free windowTokens = 5000. 4750 used + 200 = 4950 → 99% → blocked
      dbSelectResult = [makeDbSubscription({
        windowTokensUsed: 4800,
        tokensUsedToday: 0,
      })];
      const result = await tokenQuotaService.incrementTokenUsage('user-001', 200);
      expect(result.success).toBe(true);
      expect(result.newWindowTokensUsed).toBe(5000);
      // 5000/5000 = 100% → blocked
      expect(result.mode).toBe('blocked');
    });

    it('should return normal mode when well under limit', async () => {
      dbSelectResult = [makeDbSubscription({
        windowTokensUsed: 0,
        tokensUsedToday: 0,
      })];
      const result = await tokenQuotaService.incrementTokenUsage('user-001', 500);
      expect(result.success).toBe(true);
      // 500/5000 = 10% → normal
      expect(result.mode).toBe('normal');
    });

    it('should return warning mode at ~85% usage', async () => {
      // 4250/5000 = 85% → warning
      dbSelectResult = [makeDbSubscription({
        windowTokensUsed: 3750,
        tokensUsedToday: 0,
      })];
      const result = await tokenQuotaService.incrementTokenUsage('user-001', 500);
      expect(result.success).toBe(true);
      // 4250/5000 = 85% → exactly at WARNING threshold
      expect(result.mode).toBe('warning');
    });

    it('should return throttle mode at ~95% usage', async () => {
      // 4750/5000 = 95% → throttle
      dbSelectResult = [makeDbSubscription({
        windowTokensUsed: 4500,
        tokensUsedToday: 0,
      })];
      const result = await tokenQuotaService.incrementTokenUsage('user-001', 250);
      expect(result.success).toBe(true);
      // 4750/5000 = 95% → throttle
      expect(result.mode).toBe('throttle');
    });

    it('should return success=false on DB error', async () => {
      dbSelectResult = [];
      dbInsertShouldThrow = true;
      const result = await tokenQuotaService.incrementTokenUsage('user-err', 100);
      expect(result.success).toBe(false);
    });
  });

  describe('getUsageStats', () => {
    it('should combine quota and DB stats', async () => {
      dbSelectResult = [{
        tokensUsedThisWeek: 5000,
        totalTokensUsed: 50000,
        totalMessagesCount: 200,
      }];
      const stats = await tokenQuotaService.getUsageStats('user-001');
      expect(stats.weeklyTokensUsed).toBe(5000);
      expect(stats.totalTokensUsed).toBe(50000);
      expect(stats.totalMessagesCount).toBe(200);
      expect(stats.plan).toBe('premium'); // checkQuota returns premium when disabled
    });

    it('should handle missing subscription gracefully', async () => {
      dbSelectResult = [];
      const stats = await tokenQuotaService.getUsageStats('user-new');
      expect(stats.weeklyTokensUsed).toBe(0);
      expect(stats.totalTokensUsed).toBe(0);
    });
  });

  describe('checkDeckQuota (currently disabled)', () => {
    it('should return allowed=true with high limits', async () => {
      const result = await tokenQuotaService.checkDeckQuota('user-001');
      expect(result.allowed).toBe(true);
      expect(result.decksRemainingToday).toBe(999);
      expect(result.decksRemainingThisMonth).toBe(999);
    });
  });

  describe('incrementDeckUsage', () => {
    it('should increment deck counters from existing state', async () => {
      dbSelectResult = [{
        planId: 'plan-premium',
        planName: 'premium',
        dailyLimit: 75000,
        decksGeneratedToday: 1,
        decksGeneratedThisMonth: 10,
        lastResetAt: new Date(),
        lastMonthlyResetAt: new Date(),
      }];
      const result = await tokenQuotaService.incrementDeckUsage('user-001');
      expect(result.success).toBe(true);
      expect(result.newDecksGeneratedToday).toBe(2);
      expect(result.newDecksGeneratedThisMonth).toBe(11);
      // Remaining: daily 5-2=3, monthly 50-11=39
      expect(result.decksRemainingToday).toBe(3);
      expect(result.decksRemainingThisMonth).toBe(39);
    });

    it('should return success=false on error', async () => {
      dbSelectResult = [];
      dbInsertShouldThrow = true;
      const result = await tokenQuotaService.incrementDeckUsage('user-err');
      expect(result.success).toBe(false);
    });
  });

  describe('resetAllDailyTokens', () => {
    it('should batch update and return affected count', async () => {
      dbUpdateResult = { rowCount: 42 };
      const result = await tokenQuotaService.resetAllDailyTokens();
      expect(result.resetCount).toBe(42);
    });

    it('should return 0 when no rows affected', async () => {
      dbUpdateResult = { rowCount: 0 };
      const result = await tokenQuotaService.resetAllDailyTokens();
      expect(result.resetCount).toBe(0);
    });
  });

  describe('getHoursUntilReset', () => {
    it('should return a non-empty time string (Xh or Xmin)', () => {
      const result = tokenQuotaService.getHoursUntilReset();
      expect(typeof result).toBe('string');
      expect(result).toMatch(/^\d+[hm]/); // matches "5h", "30min", etc.
    });
  });
});
