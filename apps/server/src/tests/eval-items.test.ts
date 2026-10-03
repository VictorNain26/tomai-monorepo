import { describe, it, expect } from 'bun:test';
import { dataset } from '../eval';
import { buildItems, isLocalDatabase, keyOf, lookup, runOptions } from '../eval/items';

describe('buildItems', () => {
  it('crosses every scenario with its exercises and repetitions', () => {
    const items = buildItems(runOptions.parse({ repeat: '2', concurrency: '1' }));
    const conversations = dataset.scenarios.reduce(
      (n, s) => n + (s.exercises === 'all' ? dataset.exercises.length : s.exercises.length),
      0,
    );
    expect(items).toHaveLength(conversations * 2);
    expect(new Set(items.map(keyOf)).size).toBe(items.length);
  });

  it('narrows to the requested scenarios and exercises', () => {
    const items = buildItems(runOptions.parse({ scenario: ['S2', 'S5'], exercise: ['M1', 'M3'], repeat: '1', concurrency: '1' }));
    expect(items.map(keyOf)).toEqual(['S2:M1:1', 'S2:M3:1', 'S5:M1:1']);
  });

  it('runs the judge unless --skip-judge is given', () => {
    expect(runOptions.parse({ repeat: '1', concurrency: '1' })['skip-judge']).toBe(false);
    expect(runOptions.parse({ repeat: '1', concurrency: '1', 'skip-judge': true })['skip-judge']).toBe(true);
  });

  it('rejects out-of-range options', () => {
    expect(runOptions.safeParse({ repeat: '0', concurrency: '1' }).success).toBe(false);
    expect(runOptions.safeParse({ repeat: '1', concurrency: '9' }).success).toBe(false);
  });
});

describe('lookup', () => {
  it('finds the scenario and exercise of an item, and fails on an unknown one', () => {
    expect(lookup({ scenarioId: 'S2', exerciseId: 'M1', repetition: 1 }).exercise.id).toBe('M1');
    expect(() => lookup({ scenarioId: 'S9', exerciseId: 'M1', repetition: 1 })).toThrow('unknown item S9:M1:1');
  });
});

describe('isLocalDatabase', () => {
  it('accepts a database on this machine only', () => {
    expect(isLocalDatabase('postgresql://postgres:postgres@localhost:5432/test')).toBe(true);
    expect(isLocalDatabase('postgres://u:p@127.0.0.1/tomai')).toBe(true);
    expect(isLocalDatabase('postgres://u:p@db.example.eu:5432/tomai')).toBe(false);
    expect(isLocalDatabase('not a url')).toBe(false);
  });
});
