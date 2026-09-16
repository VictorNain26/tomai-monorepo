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
mock.module('../lib/observability', () => ({ logger: mockLogger }));

// Force the feature flag ON for this suite. Bun captures Bun.env at boot,
// so setting process.env at test time doesn't propagate — mock the module
// that reads it instead.
mock.module('../config/env', () => ({
  env: {
    QUOTA_ENFORCEMENT_ENABLED: true,
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://test:test@localhost/test',
    BETTER_AUTH_SECRET: 'test-secret-for-unit-tests-min-32-chars!',
    BETTER_AUTH_URL: 'http://localhost:3000',
  },
}));

// Repository mock — returns whatever we seed into dbSelectResult. checkQuota /
// checkDeckQuota are read-only, so only the finder methods are exercised.
let dbSelectResult: Record<string, unknown>[] = [];
let dbShouldThrow: Error | null = null;

mock.module('../db/repositories/user-subscriptions.repository', () => ({
  userSubscriptionsRepository: {
    findByUserId: mock(() =>
      dbShouldThrow ? Promise.reject(dbShouldThrow) : Promise.resolve(dbSelectResult[0]),
    ),
    findByUserIdWithPlanName: mock(() =>
      dbShouldThrow ? Promise.reject(dbShouldThrow) : Promise.resolve(dbSelectResult[0]),
    ),
  },
}));

// Import after env + mocks so env picks up the flag value.
const { checkQuota } = await import('../services/quota/quota-functions');
const { checkDeckQuota } = await import('../services/quota/quota-deck');

beforeEach(() => {
  dbSelectResult = [];
  dbShouldThrow = null;
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

  it('fails OPEN (allowed=true, free defaults) when the DB read throws', async () => {
    // Deliberate billing-safety choice: a DB blip must not block paying users.
    // This locks the direction of the fallback so a refactor can't silently
    // flip it to fail-closed.
    dbShouldThrow = new Error('connection terminated unexpectedly');
    const result = await checkQuota('user-001');
    expect(result.allowed).toBe(true);
    expect(result.plan).toBe('free');
    expect(result.windowLimit).toBe(5_000);
    expect(result.dailyLimit).toBe(15_000);
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
