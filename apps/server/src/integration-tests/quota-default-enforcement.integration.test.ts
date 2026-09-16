import { describe, it, expect } from 'bun:test';
import { sql } from 'drizzle-orm';
import { checkQuota, checkDeckQuota } from '../services/quota/quota-functions.js';
import { QUOTA_CONFIG } from '../services/quota/quota-config.js';

/**
 * Integration test — quota enforcement is ON by default
 * (QUOTA_ENFORCEMENT_ENABLED defaults to `true` in config/env.ts).
 *
 * A user with no `user_subscriptions` row gets free-plan limits at zero
 * usage, read from the migrated DB — not unlimited access.
 */

async function checkDbReachable(): Promise<boolean> {
  try {
    const { db } = await import('../db/connection');
    await db.execute(sql`SELECT 1`);
    return true;
  } catch {
    return false;
  }
}

const dbReachable = await checkDbReachable();

describe.skipIf(!dbReachable)('checkQuota (enforcement enabled by default)', () => {
  it('returns allowed=true for brand-new users with free plan limits', async () => {
    const result = await checkQuota('new-user-id');

    expect(result.allowed).toBe(true);
    expect(result.plan).toBe('free');
    expect(result.mode).toBe('normal');
    expect(result.windowLimit).toBe(QUOTA_CONFIG.free.windowTokens);
    expect(result.dailyLimit).toBe(QUOTA_CONFIG.free.dailyMaxTokens);
  });

  it('reports zero usage for users without prior activity', async () => {
    const result = await checkQuota('another-user');

    expect(result.windowTokensUsed).toBe(0);
    expect(result.dailyTokensUsed).toBe(0);
    expect(result.windowUsagePercent).toBe(0);
    expect(result.dailyUsagePercent).toBe(0);
  });
});

describe.skipIf(!dbReachable)('checkDeckQuota (enforcement enabled by default)', () => {
  it('returns allowed=true for users with free plan', async () => {
    const result = await checkDeckQuota('any-user-id');

    expect(result.allowed).toBe(true);
  });

  it('reports the configured deck limits, not the unlimited bypass', async () => {
    const result = await checkDeckQuota('test');

    // Free plan currently has no deck quota, so these come back as the
    // premium daily/monthly defaults from QUOTA_CONFIG for a user without a
    // subscription row.
    expect(result.dailyLimit).toBe(QUOTA_CONFIG.premium.dailyDecks);
    expect(result.monthlyLimit).toBe(QUOTA_CONFIG.premium.monthlyDecks);
  });
});
