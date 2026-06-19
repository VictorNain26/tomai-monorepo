/**
 * pronote-mappers — unit tests
 *
 * Validates NormalizedGrade/Homework/Lesson → client types conversion,
 * including null-field handling.
 */

import {
  mapGrade,
  mapHomework,
  mapLesson,
} from '../../src/services/pronote/pronote-mappers';
import type { NormalizedGrade, NormalizedHomework, NormalizedLesson } from '../../src/services/pronote/pronote-mappers';

// ---------------------------------------------------------------------------
// mapGrade
// ---------------------------------------------------------------------------

const baseGrade: NormalizedGrade = {
  subject: 'Mathématiques',
  value: 14.5,
  scale: 20,
  date: '2026-05-12',
  comment: 'Bon travail',
  coefficient: 2,
  classAverage: 12.3,
  max: 18,
  min: 6,
};

describe('mapGrade', () => {
  it('maps all fields correctly for a complete grade', () => {
    const result = mapGrade(baseGrade, 0);
    expect(result).toMatchObject({
      subject: 'Mathématiques',
      value: 14.5,
      outOf: 20,
      coefficient: 2,
      date: '2026-05-12',
      description: 'Bon travail',
      average: 12.3,
      max: 18,
      min: 6,
    });
    // id must be stable and non-empty
    expect(typeof result.id).toBe('string');
    expect(result.id.length).toBeGreaterThan(0);
  });

  it('produces stable ids: same inputs yield same id', () => {
    const r1 = mapGrade(baseGrade, 0);
    const r2 = mapGrade(baseGrade, 0);
    expect(r1.id).toBe(r2.id);
  });

  it('produces distinct ids for different indices', () => {
    const r0 = mapGrade(baseGrade, 0);
    const r1 = mapGrade(baseGrade, 1);
    expect(r0.id).not.toBe(r1.id);
  });

  it('handles null value (unmarked)', () => {
    const result = mapGrade({ ...baseGrade, value: null }, 0);
    expect(result.value).toBeNull();
  });

  it('handles null comment → empty description', () => {
    const result = mapGrade({ ...baseGrade, comment: null }, 0);
    expect(result.description).toBe('');
  });

  it('handles null classAverage → undefined average', () => {
    const result = mapGrade({ ...baseGrade, classAverage: null }, 0);
    expect(result.average).toBeUndefined();
  });

  it('handles null max → undefined max', () => {
    const result = mapGrade({ ...baseGrade, max: null }, 0);
    expect(result.max).toBeUndefined();
  });

  it('handles null min → undefined min', () => {
    const result = mapGrade({ ...baseGrade, min: null }, 0);
    expect(result.min).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// mapHomework
// ---------------------------------------------------------------------------

const baseHomework: NormalizedHomework = {
  subject: 'Histoire',
  description: 'Lire chapitre 3',
  dueDate: '2026-05-20',
  done: false,
};

describe('mapHomework', () => {
  it('maps all fields correctly', () => {
    const result = mapHomework(baseHomework, 0);
    expect(result).toMatchObject({
      subject: 'Histoire',
      description: 'Lire chapitre 3',
      dueDate: '2026-05-20',
      done: false,
      difficulty: 0,
    });
    expect(typeof result.id).toBe('string');
    expect(result.id.length).toBeGreaterThan(0);
  });

  it('produces stable ids for same inputs', () => {
    const r1 = mapHomework(baseHomework, 0);
    const r2 = mapHomework(baseHomework, 0);
    expect(r1.id).toBe(r2.id);
  });

  it('produces distinct ids for different indices', () => {
    const r0 = mapHomework(baseHomework, 0);
    const r1 = mapHomework(baseHomework, 1);
    expect(r0.id).not.toBe(r1.id);
  });

  it('maps done=true correctly', () => {
    const result = mapHomework({ ...baseHomework, done: true }, 0);
    expect(result.done).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// mapLesson
// ---------------------------------------------------------------------------

const baseLesson: NormalizedLesson = {
  subject: 'Physique',
  start: '2026-05-13T08:00:00.000Z',
  end: '2026-05-13T09:00:00.000Z',
  room: 'B201',
  canceled: false,
};

describe('mapLesson', () => {
  it('maps all fields correctly', () => {
    const result = mapLesson(baseLesson, 0);
    expect(result).toMatchObject({
      subject: 'Physique',
      startDate: '2026-05-13T08:00:00.000Z',
      endDate: '2026-05-13T09:00:00.000Z',
      classrooms: ['B201'],
      teacherNames: [],
      canceled: false,
    });
    expect(typeof result.id).toBe('string');
    expect(result.id.length).toBeGreaterThan(0);
  });

  it('produces stable ids for same inputs', () => {
    const r1 = mapLesson(baseLesson, 0);
    const r2 = mapLesson(baseLesson, 0);
    expect(r1.id).toBe(r2.id);
  });

  it('handles null room → empty classrooms', () => {
    const result = mapLesson({ ...baseLesson, room: null }, 0);
    expect(result.classrooms).toEqual([]);
  });

  it('maps canceled=true correctly', () => {
    const result = mapLesson({ ...baseLesson, canceled: true }, 0);
    expect(result.canceled).toBe(true);
  });
});
