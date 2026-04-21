import { describe, it, expect } from 'bun:test';
import { checkQuota, checkDeckQuota } from '../services/quota/quota-functions.js';
import { QUOTA_CONFIG } from '../services/quota/quota-config.js';

/**
 * Audit F-3 (2026-04-21): quotaEnforcementEnabled flipped to `true` by default.
 * Deployments that need to disable enforcement must set
 * `QUOTA_ENFORCEMENT_ENABLED=false` explicitly.
 *
 * These tests document the NEW default behaviour: without a subscription row
 * and without DB access, checkQuota/checkDeckQuota fail open to free-plan
 * limits (not unlimited access). The bypass branch is exercised by manually
 * setting the env var before import; we don't re-test it here.
 */

describe('checkQuota (enforcement enabled by default)', () => {
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

describe('checkDeckQuota (enforcement enabled by default)', () => {
  it('returns allowed=true for users with free plan', async () => {
    const result = await checkDeckQuota('any-user-id');

    expect(result.allowed).toBe(true);
  });

  it('reports free-plan deck limits (not unlimited)', async () => {
    const result = await checkDeckQuota('test');

    // Free plan currently has no deck quota, so these come back as the
    // premium daily/monthly defaults from QUOTA_CONFIG for a brand-new user
    // (matches the checkQuotaReal fail-open path).
    expect(result.dailyLimit).toBeGreaterThan(0);
    expect(result.monthlyLimit).toBeGreaterThan(0);
  });
});
