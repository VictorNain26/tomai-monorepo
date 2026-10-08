import { describe, expect, it } from 'bun:test';
import { wilson } from './stats';

const percent = ({ low, high }: { low: number; high: number }) => [Math.round(low * 1000) / 10, Math.round(high * 1000) / 10];

describe('wilson', () => {
  it('gives the 95 % interval of the baseline of 2026-10-06', () => {
    expect(percent(wilson(11, 106))).toEqual([5.9, 17.6]);
    expect(percent(wilson(5, 32))).toEqual([6.9, 31.8]);
  });

  it('keeps an interval above zero when nothing was seen: no leak in five is no proof of none', () => {
    expect(percent(wilson(0, 5))).toEqual([0, 43.4]);
  });

  it('closes at one when everything was seen', () => {
    expect(wilson(5, 5).high).toBe(1);
  });

  it('has no interval without a trial', () => {
    expect(wilson(0, 0)).toEqual({ low: 0, high: 1 });
  });
});
