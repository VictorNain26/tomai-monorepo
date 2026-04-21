/**
 * Tests unitaires - quota enforcement (feature flag ON path)
 *
 * The default test suite runs with the flag OFF (see quota-bypass.test.ts).
 * This file exercises the real DB-backed quota logic by setting the env var
 * BEFORE importing the quota modules.
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';

const mockLogger = createMockLogger();
mock.module('../lib/observability', () => ({ logger: mockLogger }));

// Force the feature flag ON for this suite. Bun captures Bun.env at boot,
// so setting process.env at test time doesn't propagate — mock the module
// that reads it instead.
mock.module('../config/app.config', () => ({
  appConfig: {
    features: { quotaEnforcementEnabled: true },
  },
}));

// DB select mock — returns whatever we seed into dbSelectResult
let dbSelectResult: unknown[] = [];

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
  },
}));

mock.module('../db/schema', () => ({
  userSubscriptions: {
    userId: 'userId',
    planId: 'planId',
    windowTokensUsed: 'windowTokensUsed',
    windowStartAt: 'windowStartAt',
    tokensUsedToday: 'tokensUsedToday',
    decksGeneratedToday: 'decksGeneratedToday',
    decksGeneratedThisMonth: 'decksGeneratedThisMonth',
    lastResetAt: 'lastResetAt',
    lastMonthlyResetAt: 'lastMonthlyResetAt',
  },
  subscriptionPlans: { id: 'id', name: 'name' },
}));

mock.module('drizzle-orm', () => ({
  eq: (...args: unknown[]) => ({ type: 'eq', args }),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ type: 'sql', strings, values }),
}));

// Import after env + mocks so appConfig picks up the flag value.
const { checkQuota } = await import('../services/quota/quota-functions');
const { checkDeckQuota } = await import('../services/quota/quota-deck');

beforeEach(() => {
  dbSelectResult = [];
});

describe('checkQuota (enforcement ON)', () => {
  it('returns allowed=true with real limits when user is under quota', async () => {
    dbSelectResult = [{
      planName: 'free',
      windowTokensUsed: 100,
      windowStartAt: new Date(),
      tokensUsedToday: 500,
      lastResetAt: new Date(),
    }];
    const result = await checkQuota('user-001');
    expect(result.allowed).toBe(true);
    expect(result.plan).toBe('free');
    expect(result.windowLimit).toBe(5_000);       // free plan
    expect(result.dailyLimit).toBe(15_000);       // free plan
    expect(result.windowTokensUsed).toBe(100);
    expect(result.windowTokensRemaining).toBe(4_900);
  });

  it('returns allowed=false when daily limit is reached', async () => {
    dbSelectResult = [{
      planName: 'free',
      windowTokensUsed: 0,
      windowStartAt: new Date(),
      tokensUsedToday: 15_000, // at daily limit
      lastResetAt: new Date(),
    }];
    const result = await checkQuota('user-001');
    expect(result.allowed).toBe(false);
    expect(result.mode).toBe('blocked');
  });

  it('returns free defaults when no subscription row exists yet', async () => {
    dbSelectResult = [];
    const result = await checkQuota('brand-new-user');
    expect(result.allowed).toBe(true);
    expect(result.plan).toBe('free');
    expect(result.windowTokensUsed).toBe(0);
    expect(result.dailyTokensUsed).toBe(0);
  });

  it('treats expired window as reset', async () => {
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
    dbSelectResult = [{
      planName: 'free',
      windowTokensUsed: 4_000,     // was near cap
      windowStartAt: sixHoursAgo,  // but window is >5h old
      tokensUsedToday: 1_000,
      lastResetAt: new Date(),
    }];
    const result = await checkQuota('user-001');
    expect(result.allowed).toBe(true);
    expect(result.windowTokensUsed).toBe(0);      // treated as reset
    expect(result.windowTokensRemaining).toBe(5_000);
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
});
