/**
 * The learner memory end to end, through the HTTP API on a real database, against the fake
 * Mistral: who agrees to it, what the writer reads of it, what the student sees and erases.
 */

import { describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import pino from 'pino';
import { createApp } from '../../app';
import { createAuth } from '../../platform/auth/auth';
import { createBackgroundTasks } from '../../platform/lifecycle/background';
import { createLifecycle } from '../../platform/lifecycle/shutdown';
import { programmeFor } from '../../referential';
import { testDatabase } from '../../testing/database';
import { httpClient, ORIGIN } from '../../testing/http';
import { memoryMailer } from '../../testing/mailer';
import { fakeMistral } from '../../testing/mistral';
import { accountDeletion } from '../household';
import type { TurnAnalysis } from './core/analysis';
import { schoolYearOf, type ExerciseSheet } from './core/sheet';
import { createTutorRepository, type SavedTurn } from './repository';
import { exercise, turnRecord } from './schema';

const { db } = await testDatabase();
const mistral = fakeMistral();
const tasks = createBackgroundTasks();
const mail = memoryMailer();
const silent = pino({ level: 'silent' });
const auth = createAuth(
  db,
  { publicUrl: ORIGIN, authSecret: 'x'.repeat(32) },
  { mailer: mail.mailer, logger: silent, background: createBackgroundTasks().run, deleteUser: accountDeletion(db) },
);
const api = httpClient(
  createApp({
    config: { production: false, webDistDir: undefined, apiRateLimit: 1000 },
    logger: silent,
    db,
    ...mistral.deps(db, silent),
    auth,
    lifecycle: createLifecycle(),
    background: tasks.run,
  }),
  mail,
);
const repository = createTutorRepository(db);

const [notion] = programmeFor('quatrieme', 'mathematiques', schoolYearOf(new Date()))?.entries ?? [];
if (!notion) throw new Error('the referential has no maths for the quatrième');

const guardian = await api.guardian('parent@example.com');
const lea = await api.student(guardian, { name: 'Léa', level: 'quatrieme', birthMonth: '2013-03' });
const asLea = await api.pair(guardian, lea.id);
const otherGuardian = await api.guardian('autre@example.com');
const noe = await api.student(otherGuardian, { name: 'Noé', level: 'quatrieme', birthMonth: '2013-03' });
const asNoe = await api.pair(otherGuardian, noe.id);

const sheet = (entries: string[]): ExerciseSheet => ({
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
  entries,
  laterEntries: [],
});
const record = (errorType: string | null): SavedTurn['record'] => ({
  model: 'm',
  promptVersion: 'v',
  newExercise: false,
  findings: [],
  outcome: 'passed',
  errorType,
});
const turn = (overrides: Partial<SavedTurn>): SavedTurn => ({
  exchange: { studentText: 'Retiens que je suis nul en maths', tutorText: 'Que fais-tu du + 5 ?', replay: null },
  subject: null,
  newExercise: null,
  exerciseId: null,
  progress: null,
  record: record(null),
  ...overrides,
});

/** A past exercise of the student on the notion, two turns of it made the same error. */
async function pastExercise(cookie: string, studentId: string, errorType: string) {
  const { id: sessionId } = (await (await api.request('POST', '/api/sessions', { cookie })).json()) as { id: string };
  await repository.saveTurn(
    sessionId,
    turn({
      newExercise: { sheet: sheet([notion?.id ?? '']), uncertain: false, drawnForms: ['5'], mathCheck: 'passed', promptVersion: 'v' },
      record: record(errorType),
    }),
  );
  const current = await repository.currentExercise(studentId, sessionId);
  await repository.saveTurn(sessionId, turn({ exerciseId: current?.id ?? null, record: record(errorType) }));
  return current?.id ?? '';
}

const analysis = (overrides: Partial<TurnAnalysis> = {}) => ({
  json: {
    subject: 'mathematiques',
    bringsExercise: false,
    proposesAnswer: false,
    asksSolution: false,
    asksExplanation: false,
    saysStuck: false,
    ...overrides,
  },
});
const draft = { json: { hasExercise: true, ...sheet([notion.id]) } };

/** What the writer reads of a new exercise on the notion. */
async function writerReads(cookie: string) {
  const { id: sessionId } = (await (await api.request('POST', '/api/sessions', { cookie })).json()) as { id: string };
  mistral.chat.push(analysis({ bringsExercise: true }), draft, draft, draft, { text: 'Que cherches-tu ?' });
  mistral.received.length = 0;
  await (await api.request('POST', `/api/sessions/${sessionId}/messages`, { cookie, body: { text: 'Résous 3x + 5 = 20.' } })).text();
  await tasks.settled();
  return JSON.stringify(mistral.received.find((r) => JSON.stringify(r.body).includes('Tu es Tom, tuteur'))?.body);
}

const memoryOf = async (cookie: string) =>
  (await (await api.request('GET', '/api/memory', { cookie })).json()) as {
    state: string;
    mayAnswer: boolean;
    notions: { notionId: string; worked: number }[];
  };
const propose = (studentId: string, memoryProposed: boolean, cookie = guardian) =>
  api.request('PATCH', `/api/household/students/${studentId}`, { cookie, body: { memoryProposed } });
const answer = (cookie: string, value: 'accepted' | 'declined') => api.request('POST', '/api/memory/answer', { cookie, body: { answer: value } });

await pastExercise(asLea, lea.id, 'careless');
await pastExercise(asNoe, noe.id, 'misinterpret');

describe('the learner memory', () => {
  it('stays off before 15 until the parent proposes it, and the child cannot answer before', async () => {
    expect(await memoryOf(asLea)).toEqual({ state: 'off', mayAnswer: false, notions: [] });
    expect((await answer(asLea, 'accepted')).status).toBe(403);
    expect(await writerReads(asLea)).not.toContain('learner_memory');
  });

  it('asks the child once the parent proposed it, and gives Tom nothing before the child accepts', async () => {
    expect((await propose(lea.id, true)).status).toBe(200);
    expect(await memoryOf(asLea)).toMatchObject({ state: 'asked', mayAnswer: true });
    expect(await writerReads(asLea)).not.toContain('learner_memory');
  });

  it('once accepted, gives the writer what the student’s past exercises say, in the referential’s words, never theirs', async () => {
    expect((await answer(asLea, 'accepted')).status).toBe(200);
    const reads = await writerReads(asLea);
    expect(reads).toContain('<learner_memory>');
    expect(reads).toContain(notion.text);
    expect(reads).toContain("erreur fréquente : fait des erreurs d'inattention");
    expect(reads).not.toContain('Retiens que');
  });

  it('never gives one student’s memory to another', async () => {
    const reads = await writerReads(asLea);
    expect(reads).not.toContain('comprend mal la consigne');
    expect((await propose(noe.id, true, otherGuardian)).status).toBe(200);
    expect((await answer(asNoe, 'accepted')).status).toBe(200);
    expect((await memoryOf(asNoe)).notions).toEqual([expect.objectContaining({ notionId: notion.id, worked: 1 })]);
  });

  it('counts nothing from before the school year', async () => {
    const before = (await memoryOf(asLea)).notions[0]?.worked ?? 0;
    const old = await pastExercise(asLea, lea.id, 'careless');
    await db
      .update(exercise)
      .set({ createdAt: new Date(Date.UTC(schoolYearOf(new Date()), 7, 15)) })
      .where(eq(exercise.id, old));
    expect((await memoryOf(asLea)).notions[0]?.worked).toBe(before);
  });

  it('forgets a notion the student understood, then all of it on their reset, from the next turn on', async () => {
    expect((await api.request('DELETE', `/api/memory/notions/${notion.id}`, { cookie: asLea })).status).toBe(204);
    expect((await memoryOf(asLea)).notions).toEqual([]);
    expect(await writerReads(asLea)).not.toContain('learner_memory');

    await pastExercise(asLea, lea.id, 'careless');
    expect((await memoryOf(asLea)).notions).toHaveLength(1);
    expect((await api.request('DELETE', '/api/memory', { cookie: asLea })).status).toBe(204);
    expect((await memoryOf(asLea)).notions).toEqual([]);
  });

  it('is off once the parent withdraws it, and erased: proposed again, it starts from nothing', async () => {
    await pastExercise(asLea, lea.id, 'careless');
    expect((await memoryOf(asLea)).notions).toHaveLength(1);
    expect((await propose(lea.id, false)).status).toBe(200);
    expect((await memoryOf(asLea)).state).toBe('off');
    expect(await writerReads(asLea)).not.toContain('learner_memory');

    // Only the exercise of the turn above, made after the withdrawal, counts.
    await propose(lea.id, true);
    expect(await memoryOf(asLea)).toMatchObject({ state: 'active', notions: [expect.objectContaining({ notionId: notion.id, worked: 1 })] });
  });

  it('lets a student of 15 decide alone, and erases it when they decline', async () => {
    const tom = await api.student(guardian, { name: 'Tom', level: 'troisieme', birthMonth: '2011-01' });
    const asTom = await api.pair(guardian, tom.id);
    expect(await memoryOf(asTom)).toMatchObject({ state: 'asked', mayAnswer: true });
    expect((await answer(asTom, 'accepted')).status).toBe(200);
    expect((await memoryOf(asTom)).state).toBe('active');
    expect((await answer(asTom, 'declined')).status).toBe(200);
    expect((await memoryOf(asTom)).state).toBe('off');
  });

  it('shows the guardian whether it is proposed, its state, and whether the child decides alone', async () => {
    const students = (await (await api.request('GET', '/api/household/students', { cookie: guardian })).json()) as {
      name: string;
      memory: unknown;
    }[];
    expect(students.find((s) => s.name === 'Léa')?.memory).toEqual({ proposed: true, state: 'active', decidesAlone: false });
    expect(students.find((s) => s.name === 'Tom')?.memory).toEqual({ proposed: false, state: 'off', decidesAlone: true });
  });

  it('refuses a guardian and a visitor', async () => {
    expect((await api.request('GET', '/api/memory', { cookie: guardian })).status).toBe(403);
    expect((await api.request('GET', '/api/memory')).status).toBe(401);
  });

  it('keeps the error type of each turn', async () => {
    const id = await pastExercise(asLea, lea.id, 'right-idea');
    const rows = await db.select({ errorType: turnRecord.errorType }).from(turnRecord).where(eq(turnRecord.exerciseId, id));
    expect(rows.map((row) => row.errorType)).toEqual(['right-idea', 'right-idea']);
  });
});
