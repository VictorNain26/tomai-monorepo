/**
 * Tests unitaires - quota enforcement (feature flag ON path)
 *
 * Forces the flag ON through the env module and mocks the subscription
 * repository, so the quota logic runs without a DB. The DB-backed default
 * path lives in integration-tests/quota-default-enforcement.integration.test.ts.
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';

const mockLogger = createMockLogger();
mock.module('../platform/observability/logger', () => ({ logger: mockLogger }));

// Force the feature flag ON for this suite. Bun captures Bun.env at boot,
// so setting process.env at test time doesn't propagate — mock the module
// that reads it instead.
mock.module('../platform/config/env', () => ({
  env: {
    QUOTA_ENFORCEMENT_ENABLED: true,
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://test:test@localhost/test',
    BETTER_AUTH_SECRET: 'test-secret-for-unit-tests-min-32-chars!',
    BETTER_AUTH_URL: 'http://localhost:3000',
  },
}));

// Repository mock: the subscription row from dbSelectResult, the day's spend from spent.
let dbSelectResult: Record<string, unknown>[] = [];
let dbShouldThrow: Error | null = null;
let spent = 0;
const spentSince = mock((_userId: string, _since: Date) =>
  dbShouldThrow ? Promise.reject(dbShouldThrow) : Promise.resolve(spent),
);

mock.module('../modules/billing/user-subscriptions.repository', () => ({
  userSubscriptionsRepository: {
    findByUserId: mock(() =>
      dbShouldThrow ? Promise.reject(dbShouldThrow) : Promise.resolve(dbSelectResult[0]),
    ),
    spentSince,
  },
}));

// Import after env + mocks so env picks up the flag value.
const { checkQuota, dailyUsage } = await import('../modules/billing/quota');
const { checkDeckQuota } = await import('../modules/billing/quota-deck');
const { lastDailyReset } = await import('../modules/billing/quota-config');

beforeEach(() => {
  dbSelectResult = [];
  dbShouldThrow = null;
  spent = 0;
  spentSince.mockClear();
});

describe('checkQuota (enforcement ON)', () => {
  it("allows a Gratuit user under the day's budget, counted since the last 10 h reset", async () => {
    dbSelectResult = [{ plan: 'free' }];
    spent = 12_000;
    const result = await checkQuota('user-001');
    expect(result).toMatchObject({ allowed: true, plan: 'free', usage: { spentMicroEur: 12_000, budgetMicroEur: 20_000, usagePercent: 60 } });
    expect(spentSince.mock.calls[0]?.[1]).toEqual(lastDailyReset(new Date()));
  });

  it('refuses once the budget is spent, speech included since every call is in cost_tracking', async () => {
    dbSelectResult = [{ plan: 'free' }];
    spent = 20_000;
    expect(await checkQuota('user-001')).toMatchObject({ allowed: false, usage: { usagePercent: 100 } });
  });

  it('refuses a call whose known cost would go past the budget, and allows one that fits', async () => {
    dbSelectResult = [{ plan: 'free' }];
    spent = 15_000;
    expect((await checkQuota('user-001', 8_000)).allowed).toBe(false);
    expect((await checkQuota('user-001', 5_000)).allowed).toBe(true);
  });

  it('gives the Complet plan its own budget', async () => {
    dbSelectResult = [{ plan: 'premium' }];
    spent = 20_000;
    expect(await checkQuota('user-001')).toMatchObject({ allowed: true, plan: 'premium', usage: { budgetMicroEur: 100_000 } });
  });

  it('treats a user without a subscription row as Gratuit', async () => {
    expect(await checkQuota('brand-new-user')).toMatchObject({ allowed: true, plan: 'free', usage: { spentMicroEur: 0 } });
  });

  it('fails OPEN when the DB read throws: allowed, the plan not held against the user, no usage claimed', async () => {
    // Deliberate billing-safety choice: a DB blip must not block paying users.
    // This locks the direction of the fallback so a refactor can't silently
    // flip it to fail-closed.
    dbShouldThrow = new Error('connection terminated unexpectedly');
    expect(await checkQuota('user-001')).toEqual({ allowed: true, plan: 'premium', usage: null });
  });
});

describe('dailyUsage', () => {
  it('throws on a failed read instead of showing a spend it could not read', async () => {
    dbShouldThrow = new Error('connection terminated unexpectedly');
    expect(dailyUsage('user-001')).rejects.toThrow('connection terminated');
  });
});

describe('checkDeckQuota (enforcement ON)', () => {
  it('returns allowed=true under premium deck limits', async () => {
    dbSelectResult = [{
      decksGeneratedToday: 2,
      decksGeneratedThisMonth: 10,
      lastResetAt: new Date(),
      lastMonthlyResetAt: new Date(),
    }];
    const result = await checkDeckQuota('user-001');
    expect(result.allowed).toBe(true);
    expect(result.decksRemainingToday).toBe(3);     // 5 - 2
    expect(result.decksRemainingThisMonth).toBe(40); // 50 - 10
    expect(result.dailyLimit).toBe(5);
    expect(result.monthlyLimit).toBe(50);
  });

  it('returns allowed=false when daily deck limit is reached', async () => {
    dbSelectResult = [{
      decksGeneratedToday: 5, // at limit
      decksGeneratedThisMonth: 10,
      lastResetAt: new Date(),
      lastMonthlyResetAt: new Date(),
    }];
    const result = await checkDeckQuota('user-001');
    expect(result.allowed).toBe(false);
    expect(result.decksRemainingToday).toBe(0);
  });

  it('returns full allowance for brand-new user with no subscription row', async () => {
    dbSelectResult = [];
    const result = await checkDeckQuota('brand-new-user');
    expect(result.allowed).toBe(true);
    expect(result.decksRemainingToday).toBe(5);
    expect(result.decksRemainingThisMonth).toBe(50);
  });

  it('fails OPEN (allowed=true) when the DB read throws', async () => {
    dbShouldThrow = new Error('connection terminated unexpectedly');
    const result = await checkDeckQuota('user-001');
    expect(result.allowed).toBe(true);
  });
});
