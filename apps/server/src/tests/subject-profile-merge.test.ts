/**
 * Tests unitaires — mergeDedup (student-subject-profile repository)
 */

import { describe, it, expect } from 'bun:test';

// mergeDedup is a pure function — no DB, no mocks needed.
import { mergeDedup } from '../db/repositories/student-subject-profile.repository.js';

describe('mergeDedup', () => {
  it('appends new entries to existing ones', () => {
    const result = mergeDedup(['a', 'b'], ['c'], 100);
    expect(result).toEqual(['a', 'b', 'c']);
  });

  it('does not duplicate entries already present (case-insensitive)', () => {
    const result = mergeDedup(['Fractions'], ['fractions'], 100);
    expect(result).toEqual(['Fractions']);
  });

  it('deduplicates regardless of casing in added list', () => {
    const result = mergeDedup(['algèbre'], ['Algèbre', 'ALGÈBRE'], 100);
    expect(result).toEqual(['algèbre']);
  });

  it('trims whitespace from added entries', () => {
    const result = mergeDedup([], ['  addition  ', 'soustraction '], 100);
    expect(result).toEqual(['addition', 'soustraction']);
  });

  it('ignores empty strings after trim', () => {
    const result = mergeDedup(['x'], ['', '   '], 100);
    expect(result).toEqual(['x']);
  });

  it('respects the cap by keeping the most recent entries (slice(-cap))', () => {
    const result = mergeDedup(['a', 'b', 'c'], ['d', 'e'], 4);
    // ['a','b','c','d','e'].slice(-4) = ['b','c','d','e']
    expect(result).toEqual(['b', 'c', 'd', 'e']);
  });

  it('preserves order: existing first, then new unique entries', () => {
    const result = mergeDedup(['x', 'y'], ['z', 'x'], 100);
    expect(result).toEqual(['x', 'y', 'z']);
  });

  it('works with empty existing list', () => {
    const result = mergeDedup([], ['foo', 'bar'], 100);
    expect(result).toEqual(['foo', 'bar']);
  });

  it('works with empty added list', () => {
    const result = mergeDedup(['foo', 'bar'], [], 100);
    expect(result).toEqual(['foo', 'bar']);
  });
});
