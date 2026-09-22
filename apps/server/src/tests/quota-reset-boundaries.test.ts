import { describe, it, expect, afterEach, setSystemTime } from 'bun:test';
import {
  getDailyResetTime,
  needsDailyReset,
  needsWeeklyReset,
} from '../services/quota/quota-config';

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

describe('needsWeeklyReset — Monday 00:00 Europe/Paris', () => {
  it('resets on Monday 00:30 Paris for a counter reset on Sunday', () => {
    at('2026-09-20T22:30:00Z'); // Monday 21/09 00:30 CEST
    expect(needsWeeklyReset(new Date('2026-09-20T12:00:00Z'))).toBe(true);
  });

  it('does not reset again on Monday noon once reset after Paris midnight', () => {
    at('2026-09-21T10:00:00Z'); // Monday 12:00 CEST
    expect(needsWeeklyReset(new Date('2026-09-20T22:30:00Z'))).toBe(false); // Monday 00:30 CEST
    expect(needsWeeklyReset(new Date('2026-09-20T21:59:00Z'))).toBe(true); // Sunday 23:59 CEST
  });

  it('uses the winter offset on the Monday after the October fallback', () => {
    at('2026-10-26T00:30:00Z'); // Monday 01:30 CET
    expect(needsWeeklyReset(new Date('2026-10-25T23:00:00Z'))).toBe(false); // Monday 00:00 CET
    expect(needsWeeklyReset(new Date('2026-10-25T22:59:00Z'))).toBe(true);
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
