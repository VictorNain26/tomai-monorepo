/**
 * The summary of the week end to end, through the HTTP API on a real database: the student reads
 * theirs, their guardian the same, nobody else; what is older than seven days stays out.
 */

import { describe, expect, it } from 'bun:test';
import { and, eq, gt } from 'drizzle-orm';
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
import { exercise, message, studySession, turnRecord } from './schema';

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

const DAY = 24 * 60 * 60_000;
const ago = (days: number, minutes = 0) => new Date(Date.now() - days * DAY + minutes * 60_000);
const newExercise = { sheet, uncertain: false, drawnForms: ['5'], mathCheck: 'passed' as const, promptVersion: 'v' };

/** A session the student opened at `when`. */
async function openSession(cookie: string, when: Date) {
  const { id } = (await (await api.request('POST', '/api/sessions', { cookie, body: { accompanied: false } })).json()) as { id: string };
  await db.update(studySession).set({ createdAt: when }).where(eq(studySession.id, id));
  return id;
}

/** What `write` stores in the session, dated `when`: the rows just written are the only ones past it. */
async function at(sessionId: string, when: Date, write: () => Promise<void>) {
  await write();
  await db
    .update(message)
    .set({ createdAt: when })
    .where(and(eq(message.sessionId, sessionId), gt(message.createdAt, when)));
  await db
    .update(turnRecord)
    .set({ createdAt: when })
    .where(and(eq(turnRecord.sessionId, sessionId), gt(turnRecord.createdAt, when)));
  await db
    .update(exercise)
    .set({ createdAt: when })
    .where(and(eq(exercise.sessionId, sessionId), gt(exercise.createdAt, when)));
  await db
    .update(studySession)
    .set({ closedAt: when })
    .where(and(eq(studySession.id, sessionId), gt(studySession.closedAt, when)));
}

/** A maths session opened `daysAgo` days ago, a turn at each of `minutes` after it, its exercise not solved after a first hint. */
async function mathsSession(cookie: string, daysAgo: number, minutes: number[]) {
  const sessionId = await openSession(cookie, ago(daysAgo));
  for (const [index, offset] of minutes.entries()) {
    await at(sessionId, ago(daysAgo, offset), () =>
      repository.saveTurn(sessionId, turn(index === 0 ? { subject: 'mathematiques', newExercise } : {})),
    );
  }
  await db.update(exercise).set({ hintLevel: 1 }).where(eq(exercise.sessionId, sessionId));
  return sessionId;
}

const summaryOf = (cookie: string, path = '/api/summary') => api.request('GET', path, { cookie });

// Eight days ago: out of the week.
await mathsSession(asLea, 8, [0, 5, 10]);
// Yesterday: the first message sent four minutes after opening, two more, then a pause of twenty.
await mathsSession(asLea, 1, [4, 6, 26]);

describe('the summary of the week', () => {
  it('gives the student the subjects, the time spent and what resists, of the last seven days only', async () => {
    const res = await summaryOf(asLea);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      minutes: 5,
      sessions: 1,
      subjects: [{ subject: 'mathematiques', minutes: 5 }],
      resisting: [{ notionId: notion.id, label: notion.text, worked: 1, lastSolved: false, lastHelp: 'Indice conceptuel', watch: null }],
    });
  });

  it('keeps an exercise begun before the week and worked again in it', async () => {
    const zoe = await api.student(guardian, { name: 'Zoé', level: 'quatrieme', birthMonth: birthMonthAged(13) });
    const asZoe = await api.pair(guardian, zoe.id);
    const sessionId = await mathsSession(asZoe, 8, [0]);
    const begun = await repository.currentExercise(zoe.id, sessionId);
    await at(sessionId, ago(1), () => repository.saveTurn(sessionId, turn({ exerciseId: begun?.id ?? null })));
    expect(await (await summaryOf(asZoe)).json()).toMatchObject({ sessions: 1, resisting: [{ notionId: notion.id, worked: 1 }] });
  });

  it('counts no time past a distress, whose messages all get the fixed reply', async () => {
    const max = await api.student(guardian, { name: 'Max', level: 'quatrieme', birthMonth: birthMonthAged(13) });
    const asMax = await api.pair(guardian, max.id);
    const sessionId = await mathsSession(asMax, 1, [0, 4]);
    const fixed = { studentText: 'Je veux plus', tutorText: 'Réponse fixe', replay: null };
    const record = { model: 'm', promptVersion: 'v', newExercise: false, findings: [] };
    await at(sessionId, ago(1, 5), () => repository.closeForDistress(max.id, sessionId, 'rules', fixed, { ...record, outcome: 'distress' }));
    for (const offset of [10, 15, 20]) {
      await at(sessionId, ago(1, offset), () => repository.saveTurn(sessionId, turn({ exchange: fixed, record: { ...record, outcome: 'closed' } })));
    }
    expect(await (await summaryOf(asMax)).json()).toMatchObject({ minutes: 5, subjects: [{ subject: 'mathematiques', minutes: 5 }] });
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
