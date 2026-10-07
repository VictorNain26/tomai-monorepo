import { describe, expect, it } from 'bun:test';
import { quotaDayStart } from './quota';

const start = (iso: string) => quotaDayStart(new Date(iso)).toISOString();

describe('quotaDayStart', () => {
  it('starts the day at 4 a.m. in Paris, in summer time (UTC+2) and in winter time (UTC+1)', () => {
    expect(start('2026-10-07T18:00:00Z')).toBe('2026-10-07T02:00:00.000Z');
    expect(start('2026-12-15T18:00:00Z')).toBe('2026-12-15T03:00:00.000Z');
  });

  it('keeps an evening past midnight in the day before, until 4 a.m.', () => {
    // 1:30 a.m. in Paris on 8 October, summer time.
    expect(start('2026-10-07T23:30:00Z')).toBe('2026-10-07T02:00:00.000Z');
    // 3:59 a.m. then 4:00 a.m. in Paris.
    expect(start('2026-10-08T01:59:00Z')).toBe('2026-10-07T02:00:00.000Z');
    expect(start('2026-10-08T02:00:00Z')).toBe('2026-10-08T02:00:00.000Z');
  });

  it('crosses a month and a year back', () => {
    expect(start('2026-11-01T01:00:00Z')).toBe('2026-10-31T03:00:00.000Z');
    expect(start('2027-01-01T01:00:00Z')).toBe('2026-12-31T03:00:00.000Z');
  });

  it('takes the offset of the day it starts on, across a change of clocks', () => {
    // The clocks go back at 3 a.m. on 25 October 2026: that day's 4 a.m. is UTC+1.
    expect(start('2026-10-25T12:00:00Z')).toBe('2026-10-25T03:00:00.000Z');
    // Before 4 a.m. that night, the day before started in summer time.
    expect(start('2026-10-25T01:30:00Z')).toBe('2026-10-24T02:00:00.000Z');
    // The clocks go forward on 28 March 2027.
    expect(start('2027-03-28T12:00:00Z')).toBe('2027-03-28T02:00:00.000Z');
  });
});
