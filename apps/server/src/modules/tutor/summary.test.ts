/**
 * The summary of the week end to end, through the HTTP API on a real database: the student reads
 * theirs, their guardian the same, nobody else; what is older than seven days stays out.
 */

import { describe, expect, it } from 'bun:test';
import { asc, eq } from 'drizzle-orm';
import pino from 'pino';
import { createApp } from '../../app';
import { createAuth } from '../../platform/auth/auth';
import { createBackgroundTasks } from '../../platform/lifecycle/background';
import { createLifecycle } from '../../platform/lifecycle/shutdown';
import { programmeFor } from '../../referential';
import { testDatabase } from '../../testing/database';
import { birthMonthAged, httpClient, ORIGIN } from '../../testing/http';
import { memoryMailer } from '../../testing/mailer';
import { fakeMistral } from '../../testing/mistral';
import { accountDeletion } from '../household';
import { schoolYearOf, type ExerciseSheet } from './core/sheet';
import { createTutorRepository, type SavedTurn } from './repository';
import { exercise, message } from './schema';

const { db } = await testDatabase();
const mail = memoryMailer();
const silent = pino({ level: 'silent' });
const auth = createAuth(
  db,
  { publicUrl: ORIGIN, authSecret: 'x'.repeat(32) },
  { mailer: mail.mailer, logger: silent, background: createBackgroundTasks().run, deleteUser: accountDeletion(db) },
);
const api = httpClient(
  createApp({
    config: { production: false, webDistDir: undefined, apiRateLimit: 1000, trustedProxyHops: 0 },
    logger: silent,
    db,
    ...fakeMistral().deps(db, silent),
    auth,
    lifecycle: createLifecycle(),
    background: createBackgroundTasks().run,
  }),
  mail,
  db,
);
const repository = createTutorRepository(db);

const [notion] = programmeFor('quatrieme', 'mathematiques', schoolYearOf(new Date()))?.entries ?? [];
if (!notion) throw new Error('the referential has no maths for the quatrième');

const guardian = await api.guardian('parent@example.com');
const lea = await api.student(guardian, { name: 'Léa', level: 'quatrieme', birthMonth: birthMonthAged(13) });
const asLea = await api.pair(guardian, lea.id);
const otherGuardian = await api.guardian('autre@example.com');
const noe = await api.student(otherGuardian, { name: 'Noé', level: 'quatrieme', birthMonth: birthMonthAged(13) });
const asNoe = await api.pair(otherGuardian, noe.id);

const sheet: ExerciseSheet = {
  statement: 'Résous 3x + 5 = 20.',
  kind: 'short',
  answer: 'x = 5',
  answerForms: ['5'],
  mathEquation: '3*x + 5 = 20',
  mathAnswer: 'x = 5',
  steps: [],
  commonErrors: [],
  rule: null,
  facts: [],
  expectedElements: [],
  entries: [notion.id],
  laterEntries: [],
};
const turn = (overrides: Partial<SavedTurn>): SavedTurn => ({
  exchange: { studentText: 'Je bloque sur le + 5', tutorText: 'Que fais-tu du + 5 ?', replay: null },
  subject: null,
  newExercise: null,
  exerciseId: null,
  progress: null,
  record: { model: 'm', promptVersion: 'v', newExercise: false, findings: [], outcome: 'passed' },
  ...overrides,
});

/** A maths session of three turns, `gaps` minutes apart, its exercise left unsolved; started `daysAgo` days ago. */
async function mathsSession(cookie: string, daysAgo: number, gaps: [number, number]) {
  const { id: sessionId } = (await (await api.request('POST', '/api/sessions', { cookie })).json()) as { id: string };
  await repository.saveTurn(
    sessionId,
    turn({ subject: 'mathematiques', newExercise: { sheet, uncertain: false, drawnForms: ['5'], mathCheck: 'passed', promptVersion: 'v' } }),
  );
  await repository.saveTurn(sessionId, turn({}));
  await repository.saveTurn(sessionId, turn({}));
  const start = Date.now() - daysAgo * 24 * 60 * 60_000;
  const offsets = [0, gaps[0], gaps[0] + gaps[1]].flatMap((minutes) => [minutes, minutes]);
  const rows = await db.select({ id: message.id }).from(message).where(eq(message.sessionId, sessionId)).orderBy(asc(message.position));
  for (const [index, row] of rows.entries()) {
    await db
      .update(message)
      .set({ createdAt: new Date(start + (offsets[index] ?? 0) * 60_000) })
      .where(eq(message.id, row.id));
  }
  await db
    .update(exercise)
    .set({ createdAt: new Date(start) })
    .where(eq(exercise.sessionId, sessionId));
}

const summaryOf = (cookie: string, path = '/api/summary') => api.request('GET', path, { cookie });

// Eight days ago: out of the week.
await mathsSession(asLea, 8, [5, 5]);
// Yesterday: six minutes of work, then a pause of twenty.
await mathsSession(asLea, 1, [6, 20]);

describe('the summary of the week', () => {
  it('gives the student the subjects, the time spent and what resists, of the last seven days only', async () => {
    const res = await summaryOf(asLea);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      minutes: 5,
      sessions: 1,
      subjects: [{ subject: 'mathematiques', minutes: 5 }],
      resisting: [{ notionId: notion.id, label: notion.text, worked: 1, lastSolved: false, lastHelp: 'Relance', watch: null }],
    });
  });

  it('gives their guardian the same summary', async () => {
    const res = await summaryOf(guardian, `/api/summary/${lea.id}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(await (await summaryOf(asLea)).json());
  });

  it('gives a student with no session this week an empty summary', async () => {
    expect(await (await summaryOf(asNoe)).json()).toEqual({ minutes: 0, sessions: 0, subjects: [], resisting: [] });
  });

  it('refuses another guardian, a student asking for another, and a guardian asking as a student', async () => {
    expect((await summaryOf(otherGuardian, `/api/summary/${lea.id}`)).status).toBe(404);
    expect((await summaryOf(asNoe, `/api/summary/${lea.id}`)).status).toBe(404);
    expect((await summaryOf(guardian)).status).toBe(403);
  });

  it('refuses anyone signed out', async () => {
    expect((await api.request('GET', '/api/summary')).status).toBe(401);
    expect((await api.request('GET', `/api/summary/${noe.id}`)).status).toBe(401);
  });
});
