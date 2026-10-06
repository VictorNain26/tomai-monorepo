/**
 * Deck quota counters (modules/billing/quota-deck.ts). Mock: repository + logger.
 */

import { describe, it, expect, beforeEach, mock, setSystemTime, afterEach } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';

mock.module('../platform/observability/logger', () => ({ logger: createMockLogger() }));

let row: Record<string, unknown> | null = null;

const applyDeckIncrement = mock(
  (_userId: string, params: { shouldResetDaily: boolean; shouldResetMonthly: boolean }) => Promise.resolve({
    decksGeneratedToday: params.shouldResetDaily ? 1 : ((row?.['decksGeneratedToday'] as number | undefined) ?? 0) + 1,
    decksGeneratedThisMonth: params.shouldResetMonthly ? 1 : ((row?.['decksGeneratedThisMonth'] as number | undefined) ?? 0) + 1,
  }),
);

mock.module('../modules/billing/user-subscriptions.repository', () => ({
  userSubscriptionsRepository: {
    ensure: mock(() => (row ? Promise.resolve(row) : Promise.reject(new Error('Insert failed')))),
    applyDeckIncrement,
  },
}));

const { incrementDeckUsage } = await import('../modules/billing/quota-deck');

beforeEach(() => {
  row = null;
  applyDeckIncrement.mockClear();
});

afterEach(() => {
  setSystemTime();
});

describe('incrementDeckUsage', () => {
  it('increments the deck counters from the current row', async () => {
    row = { decksGeneratedToday: 1, decksGeneratedThisMonth: 10, lastResetAt: new Date(), lastMonthlyResetAt: new Date() };
    const result = await incrementDeckUsage('user-001');
    expect(result).toMatchObject({ success: true, newDecksGeneratedToday: 2, newDecksGeneratedThisMonth: 11, decksRemainingToday: 3, decksRemainingThisMonth: 39 });
  });

  it('starts the month over on the first of the month in Paris', async () => {
    // 1 November 2026, 00:30 in Paris (CET): the October counter starts over.
    setSystemTime(new Date('2026-10-31T23:30:00Z'));
    row = {
      decksGeneratedToday: 0, decksGeneratedThisMonth: 50,
      lastResetAt: new Date('2026-10-31T09:00:00Z'), lastMonthlyResetAt: new Date('2026-10-01T08:00:00Z'),
    };
    expect(await incrementDeckUsage('user-001')).toMatchObject({ success: true, newDecksGeneratedThisMonth: 1 });
  });

  it('reports a failure without throwing', async () => {
    expect((await incrementDeckUsage('user-err')).success).toBe(false);
  });
});
