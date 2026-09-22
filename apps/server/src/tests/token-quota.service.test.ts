/**
 * Tests unitaires - Token Quota Service (services/token-quota.service.ts)
 * REWRITE — behavioral tests for helpers via incrementTokenUsage
 * Mock: DB + logger
 *
 * Note: tests covering the legacy "unlimited stub" branch of checkQuota /
 * checkDeckQuota have been removed. They were written when enforcement was
 * disabled by default; now that QUOTA_ENFORCEMENT_ENABLED defaults to true,
 * that branch is only reachable by explicit opt-out and the real behaviour
 * is exercised through incrementTokenUsage below.
 */

import { describe, it, expect, beforeEach, mock, setSystemTime } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';

// ============================================
// MOCKS
// ============================================

const mockLogger = createMockLogger();
mock.module('../lib/observability', () => ({ logger: mockLogger }));

// Repository mock state. `dbSelectResult[0]` is the snapshot the service reads
// before deciding resets; the increment mocks apply the service's reset
// decisions (booleans) to that snapshot — exactly what the real atomic UPDATE
// does, minus the SQL.
let dbSelectResult: Record<string, unknown>[] = [];
let dbInsertShouldThrow = false;

function currentRow(): Record<string, unknown> {
  return dbSelectResult[0] ?? {};
}

const mockApplyTokenIncrement = mock(
  (
    _userId: string,
    params: {
      tokensUsed: number;
      shouldResetWindow: boolean;
      shouldResetDaily: boolean;
    },
  ) => {
    const row = currentRow();
    return Promise.resolve({
      windowTokensUsed: params.shouldResetWindow
        ? params.tokensUsed
        : ((row.windowTokensUsed as number) ?? 0) + params.tokensUsed,
      tokensUsedToday: params.shouldResetDaily
        ? params.tokensUsed
        : ((row.tokensUsedToday as number) ?? 0) + params.tokensUsed,
    });
  },
);

const mockApplyDeckIncrement = mock(
  (_userId: string, params: { shouldResetDaily: boolean; shouldResetMonthly: boolean }) => {
    const row = currentRow();
    return Promise.resolve({
      decksGeneratedToday: params.shouldResetDaily
        ? 1
        : ((row.decksGeneratedToday as number) ?? 0) + 1,
      decksGeneratedThisMonth: params.shouldResetMonthly
        ? 1
        : ((row.decksGeneratedThisMonth as number) ?? 0) + 1,
    });
  },
);

mock.module('../db/repositories/user-subscriptions.repository', () => ({
  userSubscriptionsRepository: {
    findByUserId: mock(() => Promise.resolve(dbSelectResult[0])),
    findByUserIdWithPlanName: mock(() => Promise.resolve(dbSelectResult[0])),
    findPlanByName: mock(() => Promise.resolve({ id: 'plan-free' })),
    insertDefault: mock(() => {
      if (dbInsertShouldThrow) throw new Error('Insert failed');
      return Promise.resolve();
    }),
    applyTokenIncrement: mockApplyTokenIncrement,
    applyDeckIncrement: mockApplyDeckIncrement,
  },
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
  dbInsertShouldThrow = false;
  mockApplyTokenIncrement.mockClear();
  mockApplyDeckIncrement.mockClear();
});

describe('Token Quota Service', () => {
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

    it('should reset window AND daily when both expire simultaneously', async () => {
      // Edge case flagged in audit review O-2: window 5h rolls over at the same
      // time as the Paris daily reset. Both resets must apply atomically.
      const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
      const yesterdayMorning = new Date(Date.now() - 25 * 60 * 60 * 1000);
      dbSelectResult = [makeDbSubscription({
        windowStartAt: sixHoursAgo,
        windowTokensUsed: 4000,
        lastResetAt: yesterdayMorning,
        tokensUsedToday: 10000,
      })];
      const result = await tokenQuotaService.incrementTokenUsage('user-001', 500);
      expect(result.success).toBe(true);
      expect(result.newWindowTokensUsed).toBe(500);
      expect(result.newDailyTokensUsed).toBe(500);
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
    it('should handle missing subscription gracefully', async () => {
      dbSelectResult = [];
      const stats = await tokenQuotaService.getUsageStats('user-new');
      expect(stats.weeklyTokensUsed).toBe(0);
      expect(stats.totalTokensUsed).toBe(0);
    });

    it('reports zero weekly usage once the Paris week has rolled over', async () => {
      setSystemTime(new Date('2026-09-21T10:00:00Z'));
      dbSelectResult = [makeDbSubscription({
        tokensUsedThisWeek: 9000,
        lastWeeklyResetAt: new Date('2026-09-14T08:00:00Z'),
      })];
      const stats = await tokenQuotaService.getUsageStats('user-001');
      setSystemTime();
      expect(stats.weeklyTokensUsed).toBe(0);
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

  describe('getHoursUntilReset', () => {
    it('should return a non-empty time string (Xh or Xmin)', () => {
      const result = tokenQuotaService.getHoursUntilReset();
      expect(typeof result).toBe('string');
      expect(result).toMatch(/^\d+[hm]/); // matches "5h", "30min", etc.
    });
  });
});
