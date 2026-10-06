import { describe, it, expect, afterEach, setSystemTime } from 'bun:test';
import {
  getDailyResetTime,
  lastDailyReset,
} from '../modules/billing/quota-config';

const at = (iso: string) => setSystemTime(new Date(iso));

afterEach(() => {
  setSystemTime();
});

describe('lastDailyReset — what the budget counts from', () => {
  it('is today at 10:00 Paris after it, yesterday before it', () => {
    expect(lastDailyReset(new Date('2026-10-06T08:30:00Z'))).toEqual(new Date('2026-10-06T08:00:00Z')); // 10:30 CEST
    expect(lastDailyReset(new Date('2026-10-06T07:30:00Z'))).toEqual(new Date('2026-10-05T08:00:00Z')); // 09:30 CEST
  });

  it('keeps 10:00 Paris across the October fallback and the March jump', () => {
    // 25 October 2026, 09:30 CET: the reset is still the day before, at 10:00 CEST.
    expect(lastDailyReset(new Date('2026-10-25T08:30:00Z'))).toEqual(new Date('2026-10-24T08:00:00Z'));
    // 29 March 2026, 10:30 CEST: today's reset, at 10:00 CEST (08:00 UTC).
    expect(lastDailyReset(new Date('2026-03-29T08:30:00Z'))).toEqual(new Date('2026-03-29T08:00:00Z'));
  });
});

describe('getDailyResetTime', () => {
  it('shows minutes in the last hour before the reset', () => {
    at('2026-09-22T07:59:00Z'); // 09:59 CEST
    expect(getDailyResetTime()).toBe('1min');
    at('2026-09-22T07:59:30Z');
    expect(getDailyResetTime()).toBe('1min');
  });

  it('rounds to the nearest hour otherwise', () => {
    at('2026-09-22T06:30:00Z'); // 08:30 CEST
    expect(getDailyResetTime()).toBe('2h');
    at('2026-09-22T08:00:00Z'); // 10:00 CEST, reset just happened
    expect(getDailyResetTime()).toBe('24h');
  });

  it('counts real elapsed time across the March DST jump', () => {
    at('2026-03-29T00:30:00Z'); // 01:30 CET, reset at 10:00 CEST = 7h30 later
    expect(getDailyResetTime()).toBe('8h');
  });
});
