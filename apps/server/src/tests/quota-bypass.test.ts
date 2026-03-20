import { describe, it, expect } from 'bun:test';
import { checkQuota, checkDeckQuota } from '../services/quota/quota-functions.js';

/**
 * These tests document that quota enforcement is currently BYPASSED.
 * checkQuota and checkDeckQuota return hardcoded "always allowed" values.
 *
 * When real enforcement is implemented, these tests should be replaced
 * with proper DB-backed tests that verify plan limits are respected.
 */

describe('checkQuota (enforcement bypassed)', () => {
  it('always returns allowed=true regardless of userId', async () => {
    const result = await checkQuota('any-user-id');

    expect(result.allowed).toBe(true);
    expect(result.plan).toBe('premium');
    expect(result.mode).toBe('normal');
  });

  it('returns inflated limits (999999) indicating bypass', async () => {
    const result = await checkQuota('another-user');

    expect(result.windowLimit).toBe(999_999);
    expect(result.dailyLimit).toBe(999_999);
    expect(result.windowTokensRemaining).toBe(999_999);
    expect(result.dailyTokensRemaining).toBe(999_999);
  });

  it('reports zero usage', async () => {
    const result = await checkQuota('test');

    expect(result.windowTokensUsed).toBe(0);
    expect(result.dailyTokensUsed).toBe(0);
    expect(result.windowUsagePercent).toBe(0);
    expect(result.dailyUsagePercent).toBe(0);
  });
});

describe('checkDeckQuota (enforcement bypassed)', () => {
  it('always returns allowed=true regardless of userId', async () => {
    const result = await checkDeckQuota('any-user-id');

    expect(result.allowed).toBe(true);
  });

  it('returns inflated limits (999) indicating bypass', async () => {
    const result = await checkDeckQuota('test');

    expect(result.decksRemainingToday).toBe(999);
    expect(result.decksRemainingThisMonth).toBe(999);
    expect(result.dailyLimit).toBe(999);
    expect(result.monthlyLimit).toBe(999);
  });
});
