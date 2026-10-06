import { describe, it, expect, afterEach, setSystemTime } from 'bun:test';
import {
  getDailyResetTime,
  lastDailyReset,
  needsDailyReset,
  needsMonthlyReset,
} from '../modules/billing/quota-config';

const at = (iso: string) => setSystemTime(new Date(iso));

afterEach(() => {
  setSystemTime();
});

describe('needsDailyReset — 10:00 Europe/Paris boundary', () => {
  it('does not reset twice after the October DST fallback', () => {
    at('2026-10-25T08:30:00Z'); // 09:30 CET
    expect(needsDailyReset(new Date('2026-10-24T08:30:00Z'))).toBe(false); // 10:30 CEST the day before
    expect(needsDailyReset(new Date('2026-10-24T07:59:00Z'))).toBe(true); // 09:59 CEST the day before
  });

  it('uses the summer offset on the March DST day', () => {
    at('2026-03-29T08:30:00Z'); // 10:30 CEST
    expect(needsDailyReset(new Date('2026-03-29T07:30:00Z'))).toBe(true); // 09:30 CEST
    expect(needsDailyReset(new Date('2026-03-29T08:00:00Z'))).toBe(false); // 10:00 CEST
  });
});

describe('lastDailyReset — what the budget counts from', () => {
  it('is today at 10:00 Paris after it, yesterday before it', () => {
    expect(lastDailyReset(new Date('2026-10-06T08:30:00Z'))).toEqual(new Date('2026-10-06T08:00:00Z')); // 10:30 CEST
    expect(lastDailyReset(new Date('2026-10-06T07:30:00Z'))).toEqual(new Date('2026-10-05T08:00:00Z')); // 09:30 CEST
  });
});

describe('needsMonthlyReset — the 1st at 00:00 Europe/Paris', () => {
  it('resets on the 1st just after Paris midnight, even when UTC is still in the previous month', () => {
    at('2026-10-31T23:30:00Z'); // 1 November 00:30 CET
    expect(needsMonthlyReset(new Date('2026-10-31T22:00:00Z'))).toBe(true); // 31 October 23:00 CET
    expect(needsMonthlyReset(new Date('2026-10-31T23:00:00Z'))).toBe(false); // 1 November 00:00 CET
  });

  it('does not reset within the month', () => {
    at('2026-10-20T10:00:00Z');
    expect(needsMonthlyReset(new Date('2026-10-01T08:00:00Z'))).toBe(false);
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
