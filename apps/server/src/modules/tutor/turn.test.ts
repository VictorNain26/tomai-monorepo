/**
 * A turn of the tutor end to end, through the HTTP API on a real database, against the fake
 * Mistral: what the student reads, what is stored, and what is refused.
 */

import { describe, expect, it } from 'bun:test';
import { eq, sql } from 'drizzle-orm';
import pino from 'pino';
import { createApp } from '../../app';
import { DISTRESS_REPLY } from '../../domain/distress';
import { DAILY_BUDGET_MICRO_EUR, quotaDayStart } from '../../domain/quota';
import { aiCost } from '../../platform/ai/schema';
import { createAuth } from '../../platform/auth/auth';
import { createBackgroundTasks } from '../../platform/lifecycle/background';
import { createLifecycle } from '../../platform/lifecycle/shutdown';
import { testDatabase } from '../../testing/database';
import { httpClient, ORIGIN } from '../../testing/http';
import { memoryMailer } from '../../testing/mailer';
import { fakeMistral } from '../../testing/mistral';
import { accountDeletion } from '../household';
import type { TurnAnalysis } from './core/analysis';
import { FALLBACK_REPLY } from './core/output-check';
import { TURN_PROMPT_VERSION } from './core/version';
import { distressEvent, exercise, studySession, turnRecord } from './schema';

const { db } = await testDatabase();
const mistral = fakeMistral();
const mail = memoryMailer();
const silent = pino({ level: 'silent' });
const auth = createAuth(
  db,
  { publicUrl: ORIGIN, authSecret: 'x'.repeat(32) },
  { mailer: mail.mailer, logger: silent, background: createBackgroundTasks().run, deleteUser: accountDeletion(db) },
);
const api = httpClient(
  createApp({
    config: { production: false, webDistDir: undefined },
    logger: silent,
    db,
    ...mistral.deps(db, silent),
    auth,
    lifecycle: createLifecycle(),
  }),
  mail,
);

const guardian = await api.guardian('parent@example.com');
const student = await api.student(guardian, { name: 'Léa', level: 'quatrieme' });
const asStudent = await api.pair(guardian, student.id);
const otherGuardian = await api.guardian('autre@example.com');
const asOther = await api.pair(otherGuardian, (await api.student(otherGuardian)).id);

const newSession = async () => ((await (await api.request('POST', '/api/sessions', { cookie: asStudent })).json()) as { id: string }).id;

/** The turn's reply as the student reads it, from the UI message stream; or its error. */
async function say(sessionId: string, text: string, cookie = asStudent) {
  const res = await api.request('POST', `/api/sessions/${sessionId}/messages`, { cookie, body: { text } });
  const body = await res.text();
  const chunks = body
    .split('\n')
    .filter((line) => line.startsWith('data: {'))
    .map((line) => JSON.parse(line.slice(6)) as { type: string; delta?: string; errorText?: string });
  return {
    status: res.status,
    reply: chunks.flatMap((chunk) => (chunk.type === 'text-delta' && chunk.delta ? [chunk.delta] : [])).join(''),
    error: chunks.find((chunk) => chunk.type === 'error')?.errorText,
    body,
  };
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
const draft = {
  json: {
    hasExercise: true,
    statement: 'Résous 3x + 5 = 20.',
    kind: 'short',
    answer: 'x = 5',
    answerForms: ['5', 'x = 5'],
    mathEquation: '3*x + 5 = 20',
    mathAnswer: 'x = 5',
    steps: ['Retrancher 5 : 3x = 15', 'Diviser par 3 : x = 5'],
    commonErrors: [],
    rule: null,
    facts: [],
    expectedElements: [],
    entries: [],
    laterEntries: [],
  },
};
const records = (sessionId: string) => db.select().from(turnRecord).where(eq(turnRecord.sessionId, sessionId)).orderBy(turnRecord.createdAt);
const messagesOf = async (sessionId: string) =>
  ((await (await api.request('GET', `/api/sessions/${sessionId}/messages`, { cookie: asStudent })).json()) as { role: string; text: string }[]).map(
    ({ role, text }) => ({ role, text }),
  );

describe('a turn', () => {
  it('answers the student, stores both messages, the record of the turn without their words, and the subject named', async () => {
    const sessionId = await newSession();
    mistral.chat.push(analysis(), { text: 'Bonjour Léa, que veux-tu travailler ?' });
    const turn = await say(sessionId, 'Bonjour, je fais des maths');
    expect(turn).toMatchObject({ status: 200, reply: 'Bonjour Léa, que veux-tu travailler ?' });

    expect(await messagesOf(sessionId)).toEqual([
      { role: 'student', text: 'Bonjour, je fais des maths' },
      { role: 'tutor', text: 'Bonjour Léa, que veux-tu travailler ?' },
    ]);
    const [record] = await records(sessionId);
    expect(record).toMatchObject({
      outcome: 'passed',
      newExercise: false,
      findings: [],
      model: 'mistral-small-2603',
      analysis: { subject: 'mathematiques' },
    });
    expect(JSON.stringify(record)).not.toContain('maths');
    const [session] = await db
      .select({ subject: studySession.subject, turnStartedAt: studySession.turnStartedAt })
      .from(studySession)
      .where(eq(studySession.id, sessionId));
    expect(session).toEqual({ subject: 'mathematiques', turnStartedAt: null });
    const billed = await db.select({ operation: aiCost.operation }).from(aiCost).where(eq(aiCost.studentId, student.id));
    expect(billed.map((row) => row.operation)).toEqual(expect.arrayContaining(['turn-analysis', 'chat']));
  });

  it('gives the writer the name fenced, never in the system prompt', async () => {
    const sessionId = await newSession();
    mistral.chat.push(analysis(), { text: 'Que cherches-tu ?' });
    mistral.received.length = 0;
    await say(sessionId, 'Bonjour');
    const writer = mistral.received.filter((r) => r.path === '/v1/chat/completions').at(-1)?.body;
    const messages = (writer?.['messages'] ?? []) as { role: string; content: unknown }[];
    expect(JSON.stringify(messages.find((m) => m.role === 'system'))).not.toContain('Léa');
    expect(JSON.stringify(messages.find((m) => m.role === 'user'))).toContain("<student>\\nL'élève s'appelle Léa.\\n</student>");
  });

  it('prepares the sheet of a new exercise, holds back a reply that gives its answer, then follows the proposal', async () => {
    const sessionId = await newSession();
    mistral.chat.push(analysis({ bringsExercise: true }), draft, draft, draft, { text: 'Donc x = 5.' }, { text: 'Que fais-tu du + 5 ?' });
    expect((await say(sessionId, 'Résous 3x + 5 = 20.')).reply).toBe('Que fais-tu du + 5 ?');
    const [first] = await records(sessionId);
    expect(first).toMatchObject({ newExercise: true, hintLevel: 0, findings: ['answer'], outcome: 'regenerated' });

    mistral.chat.push(
      analysis({ proposesAnswer: true }),
      {
        json: { verdict: 'incorrect', firstWrongStep: 'Il divise 20 par 3', errorType: 'careless', proposalMath: 'x = 20/3' },
      },
      { text: 'Regarde ce que tu fais du + 5 avant de diviser.' },
    );
    expect((await say(sessionId, "J'ai trouvé x = 20/3")).reply).toBe('Regarde ce que tu fais du + 5 avant de diviser.');
    const [row] = await db.select().from(exercise).where(eq(exercise.sessionId, sessionId));
    expect(row).toMatchObject({ hintLevel: 1, hints: [{ level: 0 }, { level: 1, text: 'Regarde ce que tu fais du + 5 avant de diviser.' }] });
    expect((await records(sessionId)).at(-1)).toMatchObject({ verdict: 'incorrect', decidedBy: 'mathjs', hintLevel: 1, outcome: 'passed' });
  });

  it('answers a distress with the fixed reply, records it once, closes the session, and asks no model afterwards', async () => {
    const sessionId = await newSession();
    mistral.chat.push(analysis());
    mistral.moderations.push({ flagged: ['selfharm'], scores: { selfharm: 0.95 } });
    expect((await say(sessionId, "j'en peux plus")).reply).toBe(DISTRESS_REPLY);
    expect(await db.select({ detectedBy: distressEvent.detectedBy }).from(distressEvent).where(eq(distressEvent.sessionId, sessionId))).toEqual([
      { detectedBy: 'moderation' },
    ]);
    expect((await records(sessionId)).at(-1)).toMatchObject({ outcome: 'distress', inputFlagged: ['selfharm'] });

    mistral.received.length = 0;
    expect((await say(sessionId, 'Bon, on reprend les maths ?')).reply).toBe(DISTRESS_REPLY);
    expect(mistral.received).toEqual([]);
    expect((await records(sessionId)).at(-1)).toMatchObject({ outcome: 'closed' });
    expect(await db.select().from(distressEvent).where(eq(distressEvent.sessionId, sessionId))).toHaveLength(1);
  });

  it('answers a distress without waiting for the analysis', async () => {
    const sessionId = await newSession();
    mistral.chat.push('hang');
    mistral.moderations.push({ flagged: ['selfharm'] });
    const start = Date.now();
    expect((await say(sessionId, "j'en peux plus")).reply).toBe(DISTRESS_REPLY);
    expect(Date.now() - start).toBeLessThan(1_000);
  });

  it('reads the session closed by the statement that locks the turn', async () => {
    const sessionId = await newSession();
    await db
      .update(studySession)
      .set({ closedAt: sql`now()` })
      .where(eq(studySession.id, sessionId));
    mistral.received.length = 0;
    expect((await say(sessionId, 'Bonjour')).reply).toBe(DISTRESS_REPLY);
    expect(mistral.received).toEqual([]);
  });

  it('sees a distress the rules catch when moderation cannot answer', async () => {
    const sessionId = await newSession();
    mistral.chat.push(analysis());
    mistral.moderations.push({ status: 400 });
    expect((await say(sessionId, 'je veux mourir')).reply).toBe(DISTRESS_REPLY);
    expect(await db.select({ detectedBy: distressEvent.detectedBy }).from(distressEvent).where(eq(distressEvent.sessionId, sessionId))).toEqual([
      { detectedBy: 'rules' },
    ]);
  });

  it('refuses a second turn while one runs, and takes over one left by a crash', async () => {
    const sessionId = await newSession();
    await db
      .update(studySession)
      .set({ turnStartedAt: sql`now()` })
      .where(eq(studySession.id, sessionId));
    expect((await say(sessionId, 'Bonjour')).status).toBe(409);
    await db
      .update(studySession)
      .set({ turnStartedAt: sql`now() - interval '4 minutes'` })
      .where(eq(studySession.id, sessionId));
    mistral.chat.push(analysis(), { text: 'Bonjour !' });
    expect((await say(sessionId, 'Bonjour')).reply).toBe('Bonjour !');
  });

  it('tells the student it could not answer when Mistral fails, never why, and frees the session', async () => {
    const sessionId = await newSession();
    mistral.chat.push(analysis(), { status: 400 });
    const failed = await say(sessionId, 'Bonjour');
    expect(failed).toMatchObject({ status: 200, reply: '', error: "Tom n'a pas pu répondre. Réessaie dans un instant." });
    expect(failed.body).not.toContain('fake Mistral');
    mistral.chat.push(analysis(), { text: 'Me revoilà.' });
    expect((await say(sessionId, 'Bonjour ?')).reply).toBe('Me revoilà.');
  });

  it('gives the fixed reply when even the regeneration gives the answer away, the exercise left where it was', async () => {
    const sessionId = await newSession();
    mistral.chat.push(analysis({ bringsExercise: true }), draft, draft, draft, { text: 'Que fais-tu du + 5 ?' });
    await say(sessionId, 'Résous 3x + 5 = 20.');
    mistral.chat.push(
      analysis({ proposesAnswer: true }),
      { json: { verdict: 'incorrect', firstWrongStep: null, errorType: 'careless', proposalMath: 'x = 4' } },
      { text: 'x = 5' },
      { text: 'Bon, x = 5.' },
    );
    expect((await say(sessionId, 'x = 4 ?')).reply).toBe(FALLBACK_REPLY);
    const [row] = await db.select().from(exercise).where(eq(exercise.sessionId, sessionId));
    expect(row).toMatchObject({ hintLevel: 0, hints: [{ level: 0, text: 'Que fais-tu du + 5 ?' }] });
    expect((await records(sessionId)).at(-1)).toMatchObject({ outcome: 'fallback', hintLevel: 1 });
  });

  it('keeps no exercise of a turn Mistral failed, nor any of its messages', async () => {
    const sessionId = await newSession();
    mistral.chat.push(analysis({ bringsExercise: true }), draft, draft, draft, { status: 400 });
    expect((await say(sessionId, 'Résous 3x + 5 = 20.')).error).toBe("Tom n'a pas pu répondre. Réessaie dans un instant.");
    expect(await db.select().from(exercise).where(eq(exercise.sessionId, sessionId))).toEqual([]);
    expect(await messagesOf(sessionId)).toEqual([]);
  });

  it('records the version of every template the writer may receive', async () => {
    const sessionId = await newSession();
    mistral.chat.push(analysis(), { text: 'Bonjour !' });
    await say(sessionId, 'Bonjour');
    expect((await records(sessionId)).at(-1)?.promptVersion).toBe(TURN_PROMPT_VERSION);
    expect(TURN_PROMPT_VERSION).toMatch(/^[0-9a-f]{12}$/);
  });
});

describe('refusals, before any model', () => {
  it('refuses an anonymous visitor, a guardian, another student, and a message empty or too long', async () => {
    const sessionId = await newSession();
    mistral.received.length = 0;
    expect((await api.request('POST', `/api/sessions/${sessionId}/messages`, { body: { text: 'x' } })).status).toBe(401);
    expect((await say(sessionId, 'x', guardian)).status).toBe(403);
    expect((await say(sessionId, 'x', asOther)).status).toBe(404);
    expect((await say(sessionId, '  \u0000 ')).status).toBe(400);
    expect((await say(sessionId, 'a'.repeat(4001))).status).toBe(400);
    expect(mistral.received).toEqual([]);
  });
});

const spender = await api.student(guardian, { name: 'Noé', level: 'sixieme' });
const asSpender = await api.pair(guardian, spender.id);

describe('the daily quota', () => {
  const sessionOf = async () => ((await (await api.request('POST', '/api/sessions', { cookie: asSpender })).json()) as { id: string }).id;
  const spend = (costMicroEur: number, createdAt: Date) =>
    db.insert(aiCost).values({
      studentId: spender.id,
      model: 'mistral-small-2603',
      operation: 'chat',
      inputTokens: 0,
      cachedInputTokens: 0,
      outputTokens: 0,
      costMicroEur,
      createdAt,
    });
  const today = quotaDayStart(new Date());

  it('lets the turns of the day run under the budget, and does not count what was spent before 4 a.m.', async () => {
    await spend(DAILY_BUDGET_MICRO_EUR, new Date(today.getTime() - 60_000));
    await spend(DAILY_BUDGET_MICRO_EUR - 1, today);
    mistral.chat.push(analysis(), { text: 'Bonjour Noé !' });
    expect((await say(await sessionOf(), 'Bonjour', asSpender)).reply).toBe('Bonjour Noé !');
  });

  it('refuses a turn once the budget is spent, before any model writes, and frees the session', async () => {
    const sessionId = await sessionOf();
    mistral.received.length = 0;
    const res = await api.request('POST', `/api/sessions/${sessionId}/messages`, { cookie: asSpender, body: { text: 'Encore une question' } });
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ code: 'QUOTA_EXCEEDED', detail: 'Le quota du jour revient à 4 h.' });
    expect(mistral.received.filter((r) => r.path === '/v1/chat/completions')).toEqual([]);
    const [session] = await db.select({ turnStartedAt: studySession.turnStartedAt }).from(studySession).where(eq(studySession.id, sessionId));
    expect(session?.turnStartedAt).toBeNull();
  });

  it('still answers a distress past the budget with the fixed reply, and records it', async () => {
    const sessionId = await sessionOf();
    mistral.received.length = 0;
    expect((await say(sessionId, 'je veux mourir', asSpender)).reply).toBe(DISTRESS_REPLY);
    expect(mistral.received.filter((r) => r.path === '/v1/chat/completions')).toEqual([]);
    expect(await db.select({ detectedBy: distressEvent.detectedBy }).from(distressEvent).where(eq(distressEvent.sessionId, sessionId))).toEqual([
      { detectedBy: 'rules' },
    ]);
    // The session closed, its fixed reply needs no budget.
    expect((await say(sessionId, 'Bonjour', asSpender)).reply).toBe(DISTRESS_REPLY);
  });
});
