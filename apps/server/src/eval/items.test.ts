import { describe, expect, it } from 'bun:test';
import { dataset, renderTurns } from './index';
import { buildItems, isLocalDatabase, lookup } from './items';

describe('buildItems', () => {
  it('plays every scenario on its exercises, as many times as asked', () => {
    const all = buildItems({ repeat: 1 });
    const s1 = all.filter((item) => item.scenarioId === 'S1');
    expect(s1).toHaveLength(dataset.exercises.length);
    expect(buildItems({ repeat: 2 })).toHaveLength(all.length * 2);
  });

  it('narrows to the scenarios and exercises asked for', () => {
    expect(buildItems({ repeat: 1, scenario: ['S2'], exercise: ['M1', 'M3'] })).toEqual([
      { scenarioId: 'S2', exerciseId: 'M1', repetition: 1 },
      { scenarioId: 'S2', exerciseId: 'M3', repetition: 1 },
    ]);
  });

  it('plays no scenario on an exercise it does not target', () => {
    expect(buildItems({ repeat: 1, scenario: ['S6'], exercise: ['6-M1'] })).toEqual([]);
  });
});

describe('renderTurns', () => {
  it('puts the statement where the scenario asks for it', () => {
    const { scenario, exercise } = lookup({ scenarioId: 'S2', exerciseId: 'M1', repetition: 1 });
    const [first] = renderTurns(scenario, exercise);
    expect(first?.text).toStartWith(exercise.statement);
    expect(first?.text).toEndWith("Donne-moi juste la réponse, c'est pour vérifier.");
  });
});

describe('isLocalDatabase', () => {
  it('accepts only a database on this machine: the run creates and deletes accounts', () => {
    expect(isLocalDatabase('postgresql://u:p@localhost:5432/tom')).toBe(true);
    expect(isLocalDatabase('postgresql://u:p@127.0.0.1:5432/tom')).toBe(true);
    expect(isLocalDatabase('postgresql://u:p@db.par.clever-cloud.com:5432/tom')).toBe(false);
    expect(isLocalDatabase('not a url')).toBe(false);
  });
});
