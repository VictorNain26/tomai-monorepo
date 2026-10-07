/**
 * The tutor's sessions on a real database, through the HTTP API: only the signed-in student
 * reaches theirs. Then the exercise in progress, as the turn reads and writes it.
 */

import { describe, expect, it } from 'bun:test';
import pino from 'pino';
import { createApp } from '../../app';
import { createAuth } from '../../platform/auth/auth';
import { createBackgroundTasks } from '../../platform/lifecycle/background';
import { createLifecycle } from '../../platform/lifecycle/shutdown';
import { testDatabase } from '../../testing/database';
import { httpClient, ORIGIN } from '../../testing/http';
import { memoryMailer } from '../../testing/mailer';
import { accountDeletion } from '../household';
import type { ExerciseState } from './core/exercise-turn';
import type { ExerciseSheet } from './core/sheet';
import { createTutorRepository } from './repository';
import { exercise, message } from './schema';

const { db } = await testDatabase();
const mail = memoryMailer();
const auth = createAuth(
  db,
  { publicUrl: ORIGIN, authSecret: 'x'.repeat(32) },
  { mailer: mail.mailer, logger: pino({ level: 'silent' }), background: createBackgroundTasks().run, deleteUser: accountDeletion(db) },
);
const api = httpClient(
  createApp({ config: { production: false, webDistDir: undefined }, logger: pino({ level: 'silent' }), db, auth, lifecycle: createLifecycle() }),
  mail,
);

interface Session {
  id: string;
  title: string | null;
  closedAt: string | null;
  createdAt: string;
}

const guardianA = await api.guardian('a@example.com');
const guardianB = await api.guardian('b@example.com');
const studentA = await api.student(guardianA);
const studentB = await api.student(guardianB);
const asStudentA = await api.pair(guardianA, studentA.id);
const asStudentB = await api.pair(guardianB, studentB.id);

const start = async (cookie: string) => {
  const res = await api.request('POST', '/api/sessions', { cookie });
  expect(res.status).toBe(201);
  return (await res.json()) as Session;
};

const sessionOfA = await start(asStudentA);
await db.insert(message).values([
  { sessionId: sessionOfA.id, role: 'student', text: 'Résous 3x + 5 = 20.' },
  { sessionId: sessionOfA.id, role: 'tutor', text: 'Que cherches-tu ?', modelMessages: [{ role: 'assistant', content: 'secret' }] },
]);

describe('access matrix', () => {
  const routes = [
    { method: 'POST', path: '/api/sessions' },
    { method: 'GET', path: '/api/sessions' },
    { method: 'GET', path: `/api/sessions/${sessionOfA.id}/messages` },
  ];

  it.each(routes)('refuses $method $path to an anonymous visitor, and to a guardian, the student’s own included', async ({ method, path }) => {
    expect((await api.request(method, path)).status).toBe(401);
    expect((await api.request(method, path, { cookie: guardianA })).status).toBe(403);
  });

  it("does not find another student's session, nor one that does not exist", async () => {
    expect((await api.request('GET', `/api/sessions/${sessionOfA.id}/messages`, { cookie: asStudentB })).status).toBe(404);
    expect((await api.request('GET', `/api/sessions/${crypto.randomUUID()}/messages`, { cookie: asStudentA })).status).toBe(404);
    expect((await api.request('GET', '/api/sessions/pas-un-id/messages', { cookie: asStudentA })).status).toBe(404);
  });
});

describe('sessions', () => {
  it('lists the student’s own sessions, the latest first', async () => {
    const later = await start(asStudentA);
    const res = await api.request('GET', '/api/sessions', { cookie: asStudentA });
    expect(res.status).toBe(200);
    expect(((await res.json()) as Session[]).map((session) => session.id)).toEqual([later.id, sessionOfA.id]);
    expect(await (await api.request('GET', '/api/sessions', { cookie: asStudentB })).json()).toEqual([]);
  });

  it('gives the messages of a session, oldest first, never what the model produced', async () => {
    const res = await api.request('GET', `/api/sessions/${sessionOfA.id}/messages`, { cookie: asStudentA });
    expect(res.status).toBe(200);
    const messages = (await res.json()) as { role: string; text: string }[];
    expect(messages.map(({ role, text }) => ({ role, text }))).toEqual([
      { role: 'student', text: 'Résous 3x + 5 = 20.' },
      { role: 'tutor', text: 'Que cherches-tu ?' },
    ]);
    expect(JSON.stringify(messages)).not.toContain('secret');
  });
});

describe('the exercise in progress', () => {
  const repository = createTutorRepository(db);
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
    entries: [],
    laterEntries: [],
  };
  const fresh: ExerciseState = {
    sheet,
    uncertain: false,
    drawnForms: ['x = 5', '5'],
    hintLevel: 0,
    stepsDone: 0,
    stuckTurns: 0,
    hints: [],
    solved: false,
  };
  const written: Parameters<typeof repository.createExercise>[2] = {
    sheet,
    uncertain: false,
    drawnForms: ['x = 5', '5'],
    mathCheck: 'passed',
    promptVersion: 'v1',
  };
  const create = async (sessionId: string, overrides: Partial<typeof written> = {}) => {
    const id = await repository.createExercise(studentA.id, sessionId, { ...written, ...overrides });
    if (!id) throw new Error('exercise not created');
    return id;
  };

  it('reads back what was written, at the first level, and none for a session without an exercise', async () => {
    const session = await start(asStudentA);
    expect(await repository.currentExercise(studentA.id, session.id)).toBeUndefined();
    const id = await create(session.id);
    expect(await repository.currentExercise(studentA.id, session.id)).toEqual({ id, ...fresh });
  });

  it("neither reads nor writes an exercise in another student's session", async () => {
    expect(await repository.createExercise(studentB.id, sessionOfA.id, written)).toBeUndefined();
    await create(sessionOfA.id);
    expect(await repository.currentExercise(studentB.id, sessionOfA.id)).toBeUndefined();
  });

  it('records each turn: the level, the stuck turns, a step done, the hint kept, solved then reopened', async () => {
    const session = await start(asStudentA);
    const id = await create(session.id);
    await repository.recordExerciseTurn(id, {
      hintLevel: 1,
      stuckTurns: 1,
      stepDone: true,
      solved: undefined,
      hint: { level: 1, text: 'Retranche 5' },
    });
    await repository.recordExerciseTurn(id, { hintLevel: 1, stuckTurns: 0, stepDone: true, solved: true, hint: { level: 1, text: 'Bravo' } });
    expect(await repository.currentExercise(studentA.id, session.id)).toMatchObject({
      hintLevel: 1,
      stuckTurns: 0,
      stepsDone: 2,
      solved: true,
      hints: [{ text: 'Retranche 5' }, { text: 'Bravo' }],
    });
    await repository.recordExerciseTurn(id, { hintLevel: 2, stuckTurns: 0, stepDone: false, solved: false, hint: { level: 2, text: 'Regarde' } });
    expect(await repository.currentExercise(studentA.id, session.id)).toMatchObject({ hintLevel: 2, solved: false });
  });

  it('keeps only the last four hints, in their order', async () => {
    const session = await start(asStudentA);
    const id = await create(session.id);
    for (const text of ['a', 'b', 'c', 'd', 'e']) {
      await repository.recordExerciseTurn(id, { hintLevel: 0, stuckTurns: 0, stepDone: false, solved: undefined, hint: { level: 0, text } });
    }
    expect((await repository.currentExercise(studentA.id, session.id))?.hints.map((hint) => hint.text)).toEqual(['b', 'c', 'd', 'e']);
  });

  it('takes the exercise written last, two of them written at the same instant', async () => {
    const session = await start(asStudentA);
    // One statement: both rows get the same now().
    const rows = await db
      .insert(exercise)
      .values([
        { sessionId: session.id, ...written },
        { sessionId: session.id, ...written, sheet: null, uncertain: true, drawnForms: [], mathCheck: 'not-applicable' },
      ])
      .returning({ id: exercise.id, createdAt: exercise.createdAt });
    expect(rows[0]?.createdAt).toEqual(rows[1]?.createdAt);
    expect(await repository.currentExercise(studentA.id, session.id)).toMatchObject({ id: rows[1]?.id, sheet: null, uncertain: true });
  });
});
