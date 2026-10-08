import { describe, expect, it } from 'bun:test';
import { programmeFor } from '../../../referential';
import type { PastExercise } from './memory';
import { weekStart, weekSummary, type WeekMessage } from './week-summary';

const [first, second] = programmeFor('quatrieme', 'mathematiques', 2026)?.entries ?? [];
if (!first || !second) throw new Error('the referential has no maths for the quatrième');

const T0 = Date.parse('2026-10-05T17:00:00Z');
const minutes = (n: number) => n * 60_000;

/** A session's messages, `at` in minutes after T0. */
const session = (sessionId: string, subject: WeekMessage['subject'], at: number[]): WeekMessage[] =>
  at.map((offset) => ({ sessionId, subject, at: new Date(T0 + minutes(offset)) }));

const exercise = (overrides: Partial<PastExercise>): PastExercise => ({
  position: 10,
  entries: [first.id],
  hintLevel: 0,
  solved: true,
  errorTypes: [],
  ...overrides,
});

describe('weekStart', () => {
  it('is seven days before now', () => {
    expect(weekStart(new Date('2026-10-12T08:30:00Z'))).toEqual(new Date('2026-10-05T08:30:00Z'));
  });
});

describe('weekSummary, the time', () => {
  it('adds the gaps between messages, a gap past ten minutes counted as a pause', () => {
    const summary = weekSummary(session('a', 'mathematiques', [0, 3, 8, 30, 32]), [], new Map());
    expect(summary.minutes).toBe(10);
  });

  it('counts a gap of ten minutes exactly, not a second more', () => {
    const at = (ms: number) => ({ sessionId: 'a', subject: 'francais' as const, at: new Date(T0 + ms) });
    expect(weekSummary([at(0), at(minutes(10))], [], new Map()).minutes).toBe(10);
    expect(weekSummary([at(0), at(minutes(10) + 1000)], [], new Map()).minutes).toBe(0);
  });

  it('never adds a gap between two sessions', () => {
    const summary = weekSummary([...session('a', 'mathematiques', [0]), ...session('b', 'mathematiques', [2])], [], new Map());
    expect(summary).toMatchObject({ minutes: 0, sessions: 2 });
  });

  it('rounds each subject to the nearest five minutes, and the total is their sum', () => {
    const summary = weekSummary([...session('a', 'mathematiques', [0, 7]), ...session('b', 'francais', [0, 8])], [], new Map());
    expect(summary.subjects).toEqual([
      { subject: 'francais', minutes: 10 },
      { subject: 'mathematiques', minutes: 5 },
    ]);
    expect(summary.minutes).toBe(15);
  });

  it('puts a session without a subject under general, and keeps a subject worked under a minute', () => {
    const summary = weekSummary([...session('a', null, [0, 6]), ...session('b', 'langues', [0])], [], new Map());
    expect(summary.subjects).toEqual([
      { subject: 'general', minutes: 5 },
      { subject: 'langues', minutes: 0 },
    ]);
  });

  it('says nothing of a week without a session', () => {
    expect(weekSummary([], [], new Map())).toEqual({ minutes: 0, sessions: 0, subjects: [], resisting: [] });
  });
});

describe('weekSummary, what resists', () => {
  it('keeps a notion whose last exercise is not solved, or solved with help up to an intermediate step', () => {
    const summary = weekSummary(
      [],
      [exercise({ position: 10, entries: [first.id], hintLevel: 0, solved: false }), exercise({ position: 11, entries: [second.id], hintLevel: 3 })],
      new Map(),
    );
    expect(summary.resisting.map(({ notionId, lastSolved, lastHelp }) => [notionId, lastSolved, lastHelp])).toEqual([
      [first.id, false, 'Relance'],
      [second.id, true, 'Étape intermédiaire'],
    ]);
  });

  it('leaves out a notion solved with a targeted hint at most', () => {
    expect(weekSummary([], [exercise({ hintLevel: 2 })], new Map()).resisting).toEqual([]);
  });

  it('reads the last exercise of the notion: one that resisted, then one solved alone, no longer resists', () => {
    const summary = weekSummary([], [exercise({ position: 10, solved: false, hintLevel: 4 }), exercise({ position: 12 })], new Map());
    expect(summary.resisting).toEqual([]);
  });

  it('names the error to watch, seen twice', () => {
    const [notion] = weekSummary([], [exercise({ solved: false, errorTypes: ['careless', 'careless'] })], new Map()).resisting;
    expect(notion?.watch).toBe("les erreurs d'inattention");
  });

  it('leaves out the exercises up to the notion the student marked as understood', () => {
    const summary = weekSummary([], [exercise({ position: 10, solved: false })], new Map([[first.id, 10]]));
    expect(summary.resisting).toEqual([]);
  });
});
