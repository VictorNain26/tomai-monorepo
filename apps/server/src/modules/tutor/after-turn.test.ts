/**
 * What runs after a turn's reply, end to end: the session's title and summary, the session kept
 * locked while they run.
 */

import { describe, expect, it } from 'bun:test';
import { eq } from 'drizzle-orm';
import pino from 'pino';
import { createApp } from '../../app';
import { createAuth } from '../../platform/auth/auth';
import { createBackgroundTasks } from '../../platform/lifecycle/background';
import { createLifecycle } from '../../platform/lifecycle/shutdown';
import { testDatabase } from '../../testing/database';
import { httpClient, ORIGIN } from '../../testing/http';
import { memoryMailer } from '../../testing/mailer';
import { fakeMistral } from '../../testing/mistral';
import { accountDeletion } from '../household';
import type { TurnAnalysis } from './core/analysis';
import { message, studySession } from './schema';

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
    config: { production: false, webDistDir: undefined, apiRateLimit: 100 },
    logger: silent,
    db,
    ...mistral.deps(db, silent),
    auth,
    lifecycle: createLifecycle(),
    background: tasks.run,
  }),
  mail,
  db,
);

const guardian = await api.guardian('parent@example.com');
const student = await api.student(guardian, { name: 'Léa', level: 'quatrieme' });
const asStudent = await api.pair(guardian, student.id);

const newSession = async () => ((await (await api.request('POST', '/api/sessions', { cookie: asStudent })).json()) as { id: string }).id;

/** The turn's reply as the student reads it, from the UI message stream; or its error. */
async function say(sessionId: string, text: string, cookie = asStudent) {
  const res = await api.request('POST', `/api/sessions/${sessionId}/messages`, { cookie, body: { text } });
  const body = await res.text();
  // The title and the summary run after the reply: done before the test queues the next replies.
  await tasks.settled();
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
describe('after the reply', () => {
  const sessionRow = async (sessionId: string) =>
    (
      await db
        .select({ title: studySession.title, summary: studySession.summary, summaryUntil: studySession.summaryUntil })
        .from(studySession)
        .where(eq(studySession.id, sessionId))
    )[0];
  const chatCalls = () => mistral.received.filter((r) => r.path === '/v1/chat/completions').length;

  it('titles a session after its first turn, and never again', async () => {
    const sessionId = await newSession();
    mistral.chat.push(analysis(), { text: 'Que cherches-tu ?' }, { text: 'Équations du premier degré' });
    await say(sessionId, 'Résous 3x + 5 = 20.');
    expect((await sessionRow(sessionId))?.title).toBe('Équations du premier degré');

    mistral.received.length = 0;
    mistral.chat.push(analysis(), { text: 'Et ensuite ?' });
    await say(sessionId, 'Je retranche 5.');
    expect(chatCalls()).toBe(2);
  });

  it('asks no title again of a later turn when the first one was held back', async () => {
    const sessionId = await newSession();
    mistral.chat.push(analysis(), { text: 'Que cherches-tu ?' }, { text: 'Équations du premier degré' });
    // The student's message, the reply, then the title, which moderation holds back.
    mistral.moderations.push({}, {}, { flagged: ['violence_and_threats'] });
    await say(sessionId, 'Résous 3x + 5 = 20.');
    expect((await sessionRow(sessionId))?.title).toBeNull();
    mistral.received.length = 0;
    mistral.chat.push(analysis(), { text: 'Et ensuite ?' });
    await say(sessionId, 'Je retranche 5.');
    expect(chatCalls()).toBe(2);
  });

  it('frees the session once the reply is stored: the student answers while the title is written', async () => {
    const sessionId = await newSession();
    const before = chatCalls();
    mistral.chat.push(analysis(), { text: 'Que cherches-tu ?' }, 'hang', analysis(), { text: 'Me voilà.' });
    const first = await api.request('POST', `/api/sessions/${sessionId}/messages`, { cookie: asStudent, body: { text: 'Bonjour' } });
    await first.text();
    // The title's call has reached Mistral, where it hangs: the next turn's calls take the next replies.
    for (let tries = 0; chatCalls() < before + 3 && tries < 500; tries++) await Bun.sleep(10);
    const next = await api.request('POST', `/api/sessions/${sessionId}/messages`, { cookie: asStudent, body: { text: 'Encore' } });
    expect(next.status).toBe(200);
    expect(await next.text()).toContain('Me voilà.');
    await tasks.settled();
  });

  it('loses no message when a summary fails: the window reads all that follow the last one', async () => {
    const sessionId = await newSession();
    await db.update(studySession).set({ title: 'Une séance' }).where(eq(studySession.id, sessionId));
    await db.insert(message).values(
      Array.from({ length: 24 }, (_, i) => ({
        sessionId,
        role: i % 2 === 0 ? ('student' as const) : ('tutor' as const),
        text: `ancien ${String(i + 1)}`,
      })),
    );
    mistral.chat.push(analysis(), { text: 'Réponse' }, { status: 400 });
    await say(sessionId, 'nouveau');
    expect((await sessionRow(sessionId))?.summary).toBeNull();
    mistral.received.length = 0;
    mistral.chat.push(analysis(), { text: 'Réponse' }, { status: 400 });
    await say(sessionId, 'encore');
    const writer = JSON.stringify(mistral.received.find((r) => JSON.stringify(r.body).includes('Tu es Tom, tuteur'))?.body);
    expect(writer).toContain('ancien 1\\n');
  });

  it('summarizes the older messages once twenty wait, the last ten kept as they are, and the next turn reads the summary', async () => {
    const sessionId = await newSession();
    await db.update(studySession).set({ title: 'Une séance' }).where(eq(studySession.id, sessionId));
    await db.insert(message).values(
      Array.from({ length: 20 }, (_, i) => ({
        sessionId,
        role: i % 2 === 0 ? ('student' as const) : ('tutor' as const),
        text: `message ${String(i + 1)}`,
      })),
    );
    mistral.chat.push(analysis(), { text: 'Réponse 21' }, { text: 'Le résumé de la séance' });
    await say(sessionId, 'message 21');
    const positions = await db
      .select({ position: message.position, text: message.text })
      .from(message)
      .where(eq(message.sessionId, sessionId))
      .orderBy(message.position);
    expect(await sessionRow(sessionId)).toMatchObject({ summary: 'Le résumé de la séance', summaryUntil: positions[11]?.position });

    mistral.received.length = 0;
    mistral.chat.push(analysis(), { text: 'Réponse 23' });
    await say(sessionId, 'message 23');
    const writer = JSON.stringify(mistral.received.find((r) => JSON.stringify(r.body).includes('Tu es Tom, tuteur'))?.body);
    expect(writer).toContain('<conversation_summary>\\nLe résumé de la séance\\n</conversation_summary>');
    expect(writer).not.toContain('message 12"');
    expect(writer).toContain('message 13');
  });
});
