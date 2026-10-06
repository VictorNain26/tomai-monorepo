import { describe, it, expect } from 'bun:test';
import { dataset } from '.';
import { datasetSchema } from './schema';
import { programmeFor, programmes } from '../referential';
import { SCHOOL_LEVELS, type SchoolLevel } from '../domain/levels';

const SCHOOL_YEAR = 2026;
const byId = new Map(programmes.flatMap(({ entries }) => entries.map((entry) => [entry.id, entry] as const)));

function rank(level: string): number {
  return SCHOOL_LEVELS.indexOf(level as SchoolLevel);
}

/** Whether an entry belongs to the programme in force for its own class in 2026-2027. */
function inForce(id: string): boolean {
  const entry = byId.get(id);
  return entry !== undefined && (programmeFor(entry.level, entry.subject, SCHOOL_YEAR)?.entries.some((e) => e.id === id) ?? false);
}

describe('alignment of the exercises with the referential', () => {
  it('is set exactly for the exercises whose subject has a programme in force', () => {
    for (const exercise of dataset.exercises) {
      const programme = programmeFor(exercise.level, exercise.subject, SCHOOL_YEAR);
      expect({ id: exercise.id, aligned: exercise.alignment !== null }).toEqual({ id: exercise.id, aligned: programme !== null });
    }
  });

  it('points to entries of the same subject, in force for their class, of the class or later', () => {
    for (const exercise of dataset.exercises) {
      if (!exercise.alignment) continue;
      const { entries, laterEntries } = exercise.alignment;
      for (const id of [...entries, ...laterEntries]) {
        const entry = byId.get(id);
        expect({
          exercise: exercise.id,
          id,
          subject: entry?.subject,
          inForce: inForce(id),
          notEarlier: rank(entry?.level ?? '') >= rank(exercise.level),
        }).toEqual({ exercise: exercise.id, id, subject: exercise.subject, inForce: true, notEarlier: true });
      }
      for (const id of laterEntries) {
        expect({ exercise: exercise.id, id, later: rank(byId.get(id)?.level ?? '') > rank(exercise.level) }).toEqual({
          exercise: exercise.id,
          id,
          later: true,
        });
      }
      expect({ exercise: exercise.id, distinct: new Set([...entries, ...laterEntries]).size }).toEqual({
        exercise: exercise.id,
        distinct: entries.length + laterEntries.length,
      });
    }
  });

  it('holds at least one entry of the class itself for every linked exercise', () => {
    for (const exercise of dataset.exercises) {
      if (!exercise.alignment) continue;
      expect({ id: exercise.id, inClass: exercise.alignment.entries.some((id) => byId.get(id)?.level === exercise.level) }).toEqual({
        id: exercise.id,
        inClass: true,
      });
    }
  });

  it('marks F1 and M4 as beyond 4e: a relative-pronoun COD and double distributivity are 3e expectations', () => {
    const beyond = dataset.exercises.filter((exercise) =>
      exercise.alignment?.entries.some((id) => rank(byId.get(id)?.level ?? '') > rank(exercise.level)),
    );
    expect(beyond.map((exercise) => exercise.id).sort()).toEqual(['F1', 'M4']);
  });
});

describe('alignment schema', () => {
  it('rejects an empty list of entries and an unknown key', () => {
    const [first] = dataset.exercises;
    const parse = (alignment: unknown) =>
      datasetSchema.safeParse({
        exercises: [{ ...first, alignment }],
        scenarios: dataset.scenarios.slice(0, 1).map((s) => ({ ...s, exercises: 'all' })),
      }).success;
    expect(parse({ entries: ['x'], laterEntries: [] })).toBe(true);
    expect(parse(null)).toBe(true);
    expect(parse({ entries: [], laterEntries: [] })).toBe(false);
    expect(parse({ entries: ['x'], laterEntries: [], extra: 1 })).toBe(false);
  });
});
