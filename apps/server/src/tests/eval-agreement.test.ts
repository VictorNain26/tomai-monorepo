import { describe, it, expect } from 'bun:test';
import { alphaInterval, krippendorffAlpha, rawAgreement } from '../eval/agreement';

// Expected values computed once with `krippendorff` 0.8.2 of PyPI
// (https://github.com/pln-fing-udelar/fast-krippendorff), units as rows of two coders.
describe('krippendorffAlpha', () => {
  it('matches the PyPI reference on ordinal scales', () => {
    expect(
      krippendorffAlpha(
        [
          [0, 0],
          [1, 1],
          [2, 2],
          [1, 2],
          [0, 1],
          [2, 2],
          [1, 1],
          [0, 0],
          [2, 1],
          [1, 1],
        ],
        'ordinal',
      ),
    ).toBeCloseTo(0.7343290043290043, 12);
    expect(
      krippendorffAlpha(
        [
          [1, 1],
          [0.5, 1],
          [0, 0],
          [1, 0.5],
          [0.5, 0.5],
          [1, 1],
          [0, 0.5],
        ],
        'ordinal',
      ),
    ).toBeCloseTo(0.6412337662337662, 12);
    expect(
      krippendorffAlpha(
        [
          [0, 0],
          [1, 1],
          [2, 2],
        ],
        'ordinal',
      ),
    ).toBeCloseTo(1, 12);
    expect(krippendorffAlpha([[1, 0.5]], 'ordinal')).toBeCloseTo(0, 12);
  });

  it('matches the PyPI reference on nominal scales, including a rare value', () => {
    expect(
      krippendorffAlpha(
        [
          [1, 1],
          [0, 0],
          [1, 0],
          [1, 1],
          [1, 1],
          [0, 0],
          [0, 1],
          [1, 1],
        ],
        'nominal',
      ),
    ).toBeCloseTo(0.5, 12);
    const skewed = [...Array.from({ length: 9 }, () => [1, 1]), [1, 0]];
    expect(krippendorffAlpha(skewed, 'nominal')).toBeCloseTo(0, 12);
    expect(rawAgreement(skewed)).toBe(0.9);
  });

  it('matches the PyPI reference with three coders', () => {
    expect(
      krippendorffAlpha(
        [
          [0, 0, 1],
          [1, 1, 1],
          [2, 2, 2],
          [2, 1, 2],
          [0, 0, 0],
          [1, 2, 1],
        ],
        'ordinal',
      ),
    ).toBeCloseTo(0.7347189847189848, 12);
    expect(
      krippendorffAlpha(
        [
          [1, 1, 0],
          [0, 0, 0],
          [1, 1, 1],
          [0, 1, 0],
          [1, 1, 1],
        ],
        'nominal',
      ),
    ).toBeCloseTo(0.4814814814814815, 12);
  });

  it('is undefined when a single value occurs, and ignores units rated once', () => {
    expect(
      krippendorffAlpha(
        [
          [1, 1],
          [1, 1],
        ],
        'nominal',
      ),
    ).toBeNull();
    expect(krippendorffAlpha([[0, 0], [1, 1], [2]], 'nominal')).toBeCloseTo(1, 12);
  });
});

describe('alphaInterval', () => {
  const units = [
    [0, 0],
    [1, 1],
    [2, 2],
    [1, 2],
    [0, 1],
    [2, 2],
    [1, 1],
    [0, 0],
    [2, 1],
    [1, 1],
  ];

  it('brackets the point estimate and is the same on every run', () => {
    const interval = alphaInterval(units, 'ordinal');
    if (!interval) throw new Error('no interval');
    expect(interval[0]).toBeLessThan(0.7343290043290043);
    expect(interval[1]).toBeGreaterThan(0.7343290043290043);
    expect(interval[1]).toBeLessThanOrEqual(1);
    expect(alphaInterval(units, 'ordinal')).toEqual(interval);
  });

  it('is null when no resample has two values', () => {
    expect(
      alphaInterval(
        [
          [1, 1],
          [1, 1],
        ],
        'nominal',
        { samples: 10 },
      ),
    ).toBeNull();
  });
});
