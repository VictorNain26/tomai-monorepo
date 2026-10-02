import { describe, it, expect } from 'bun:test';
import { dataset } from '../eval';
import { programmeFor, programmes } from '../referential';

const SCHOOL_YEAR = 2026;
const ORDER = ['sixieme', 'cinquieme', 'quatrieme', 'troisieme'];
const byId = new Map(programmes.flatMap(({ entries }) => entries.map((entry) => [entry.id, entry] as const)));

function rank(level: string): number {
  return ORDER.indexOf(level);
}

describe('alignment of the exercises with the referential', () => {
  it('is set exactly for the exercises whose subject has a programme in force', () => {
    for (const exercise of dataset.exercises) {
      const programme = programmeFor(exercise.level, exercise.subject, SCHOOL_YEAR);
      expect({ id: exercise.id, aligned: exercise.alignment !== null }).toEqual({ id: exercise.id, aligned: programme !== null });
    }
  });

  it('points to existing entries of the same subject, in force for the class or for a later one', () => {
    for (const exercise of dataset.exercises) {
      if (!exercise.alignment) continue;
      const inForce = new Set(programmeFor(exercise.level, exercise.subject, SCHOOL_YEAR)?.entries.map((e) => e.id));
      for (const id of [...exercise.alignment.entries, ...exercise.alignment.laterEntries]) {
        const entry = byId.get(id);
        expect({ exercise: exercise.id, id, found: entry !== undefined, subject: entry?.subject }).toEqual({
          exercise: exercise.id, id, found: true, subject: exercise.subject,
        });
      }
      for (const id of exercise.alignment.entries) {
        const entry = byId.get(id);
        if (entry?.level === exercise.level) expect({ exercise: exercise.id, id, inForce: inForce.has(id) }).toEqual({ exercise: exercise.id, id, inForce: true });
      }
      for (const id of exercise.alignment.laterEntries) {
        expect({ exercise: exercise.id, id, later: rank(byId.get(id)?.level ?? '') > rank(exercise.level) }).toEqual({ exercise: exercise.id, id, later: true });
      }
    }
  });

  it('marks M4 as the only exercise beyond its class: double distributivity is a 3e expectation', () => {
    const beyond = dataset.exercises.filter((exercise) =>
      exercise.alignment?.entries.some((id) => rank(byId.get(id)?.level ?? '') > rank(exercise.level)),
    );
    expect(beyond.map((exercise) => exercise.id)).toEqual(['M4']);
  });
});
