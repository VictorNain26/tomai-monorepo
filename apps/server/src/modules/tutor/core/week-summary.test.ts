import { describe, expect, it } from 'bun:test';
import { programmeFor } from '../../../referential';
import type { PastExercise } from './memory';
import { weekStart, weekSummary, type WeekMessage } from './week-summary';

const [first, second] = programmeFor('quatrieme', 'mathematiques', 2026)?.entries ?? [];
if (!first || !second) throw new Error('the referential has no maths for the quatrième');

const T0 = Date.parse('2026-10-05T17:00:00Z');
const minutes = (n: number) => n * 60_000;

/** A session's messages, `at` in minutes after T0; the session opened with its first message unless `startedAt` says otherwise. */
const session = (sessionId: string, subject: WeekMessage['subject'], at: number[], startedAt = at[0] ?? 0): WeekMessage[] =>
  at.map((offset) => ({ sessionId, subject, startedAt: new Date(T0 + minutes(startedAt)), at: new Date(T0 + minutes(offset)) }));

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
    const at = (ms: number) => ({ sessionId: 'a', subject: 'francais' as const, startedAt: new Date(T0), at: new Date(T0 + ms) });
    expect(weekSummary([at(0), at(minutes(10))], [], new Map()).minutes).toBe(10);
    expect(weekSummary([at(0), at(minutes(10) + 1000)], [], new Map()).minutes).toBe(0);
  });

  it('counts the first message from the opening of the session, written while the reply is awaited', () => {
    expect(weekSummary(session('a', 'mathematiques', [6, 6], 0), [], new Map()).minutes).toBe(5);
  });

  it('counts a session opened long before its first message from that message only', () => {
    expect(weekSummary(session('a', 'mathematiques', [30, 36], 0), [], new Map()).minutes).toBe(5);
  });

  it('never adds a gap between two sessions', () => {
    const summary = weekSummary([...session('a', 'mathematiques', [0]), ...session('b', 'mathematiques', [2])], [], new Map());
    expect(summary).toMatchObject({ minutes: 0, sessions: 2 });
  });

  it('rounds each subject to the nearest five minutes', () => {
    const summary = weekSummary([...session('a', 'mathematiques', [0, 7]), ...session('b', 'francais', [0, 8])], [], new Map());
    expect(summary.subjects).toEqual([
      { subject: 'francais', minutes: 10 },
      { subject: 'mathematiques', minutes: 5 },
    ]);
  });

  it('rounds the total time itself, not the sum of rounded subjects', () => {
    const subjects = ['mathematiques', 'francais', 'langues', 'sciences'] as const;
    const summary = weekSummary(
      subjects.flatMap((subject) => session(subject, subject, [0, 2])),
      [],
      new Map(),
    );
    expect(summary.subjects.map(({ minutes: spent }) => spent)).toEqual([0, 0, 0, 0]);
    expect(summary.minutes).toBe(10);
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
  it('keeps a notion whose last exercise is not solved after some help, or solved with help up to an intermediate step', () => {
    const summary = weekSummary(
      [],
      [exercise({ position: 10, entries: [first.id], hintLevel: 1, solved: false }), exercise({ position: 11, entries: [second.id], hintLevel: 3 })],
      new Map(),
    );
    expect(summary.resisting.map(({ notionId, lastSolved, lastHelp }) => [notionId, lastSolved, lastHelp])).toEqual([
      [first.id, false, 'avec un rappel de la règle'],
      [second.id, true, 'avec une étape faite ensemble'],
    ]);
  });

  it('leaves out an exercise brought and left without any help: nothing says it resisted', () => {
    expect(weekSummary([], [exercise({ hintLevel: 0, solved: false })], new Map()).resisting).toEqual([]);
  });

  it('leaves out a notion solved with a targeted hint at most', () => {
    expect(weekSummary([], [exercise({ hintLevel: 2 })], new Map()).resisting).toEqual([]);
  });

  it('reads the last exercise of the notion: one that resisted, then one solved alone, no longer resists', () => {
    const summary = weekSummary([], [exercise({ position: 10, solved: false, hintLevel: 4 }), exercise({ position: 12 })], new Map());
    expect(summary.resisting).toEqual([]);
  });

  it('names the error to watch, seen twice', () => {
    const [notion] = weekSummary([], [exercise({ hintLevel: 1, solved: false, errorTypes: ['careless', 'careless'] })], new Map()).resisting;
    expect(notion?.watch).toBe("les erreurs d'inattention");
  });

  it('leaves out the exercises up to the notion the student marked as understood', () => {
    const summary = weekSummary([], [exercise({ position: 10, hintLevel: 1, solved: false })], new Map([[first.id, 10]]));
    expect(summary.resisting).toEqual([]);
  });
});
