import { describe, it, expect } from 'bun:test';
import { dataset } from '../eval';
import { buildItems, isLocalDatabase, keyOf, lookup, runOptions, samplePairs, unknownPairs } from '../eval/items';
import agreementSample from '../eval/agreement-sample.json';

describe('buildItems', () => {
  it('crosses every scenario with its exercises and repetitions', () => {
    const items = buildItems(runOptions.parse({ repeat: '2', concurrency: '1' }));
    const conversations = dataset.scenarios.reduce((n, s) => n + (s.exercises === 'all' ? dataset.exercises.length : s.exercises.length), 0);
    expect(items).toHaveLength(conversations * 2);
    expect(new Set(items.map(keyOf)).size).toBe(items.length);
  });

  it('narrows to the requested scenarios and exercises', () => {
    const items = buildItems(runOptions.parse({ scenario: ['S2', 'S5'], exercise: ['M1', 'M3'], repeat: '1', concurrency: '1' }));
    expect(items.map(keyOf)).toEqual(['S2:M1:1', 'S2:M3:1', 'S5:M1:1']);
  });

  it('plays exactly the pairs of a sample', () => {
    const items = buildItems(runOptions.parse({ repeat: '1', concurrency: '1' }), [
      { scenarioId: 'S5', exerciseId: 'F1' },
      { scenarioId: 'S1', exerciseId: 'M2' },
      { scenarioId: 'S5', exerciseId: 'M3' },
    ]);
    expect(items.map(keyOf)).toEqual(['S1:M2:1', 'S5:F1:1']);
  });

  it('names the pairs of a sample the dataset lacks', () => {
    expect(
      unknownPairs([
        { scenarioId: 'S1', exerciseId: 'M1' },
        { scenarioId: 'S1', exerciseId: '6-M9' },
        { scenarioId: 'S5', exerciseId: 'M3' },
        { scenarioId: 'S9', exerciseId: 'M1' },
      ]),
    ).toEqual([
      { scenarioId: 'S1', exerciseId: '6-M9' },
      { scenarioId: 'S5', exerciseId: 'M3' },
      { scenarioId: 'S9', exerciseId: 'M1' },
    ]);
  });

  it('holds an agreement sample whose every pair is in the dataset, once', () => {
    const sample = samplePairs.parse(agreementSample);
    const items = buildItems(runOptions.parse({ repeat: '1', concurrency: '1' }), sample);
    expect(unknownPairs(sample)).toEqual([]);
    expect(items).toHaveLength(sample.length);
    expect(new Set(items.map((i) => i.scenarioId))).toEqual(new Set(dataset.scenarios.map((s) => s.id)));
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
