/**
 * The harness's player on a real database and the fake Mistral: a fresh student plays a scenario
 * through the real route, and each turn comes back with what the student read and the record the
 * server stored.
 */

import { beforeEach, describe, expect, it } from 'bun:test';
import { like } from 'drizzle-orm';
import pino from 'pino';
import { createApp } from './app';
import { DISTRESS_REPLY } from './domain/distress';
import { renderTurns } from './eval';
import { lookup } from './eval/items';
import { harnessInbox, playConversation, removeEvalAccounts, signInGuardian, type Harness } from './evaluate';
import { accountDeletion } from './modules/household';
import { turnRecords } from './modules/tutor';
import { createAuth } from './platform/auth/auth';
import { user } from './platform/auth/schema';
import { createBackgroundTasks } from './platform/lifecycle/background';
import { createLifecycle } from './platform/lifecycle/shutdown';
import { testDatabase } from './testing/database';
import { ORIGIN } from './testing/http';
import { fakeMistral } from './testing/mistral';

const { db } = await testDatabase();
const mistral = fakeMistral();
const tasks = createBackgroundTasks();
const inbox = harnessInbox();
const silent = pino({ level: 'silent' });
const auth = createAuth(
  db,
  { publicUrl: ORIGIN, authSecret: 'x'.repeat(32) },
  { mailer: inbox.mailer, logger: silent, background: tasks.run, deleteUser: accountDeletion(db) },
);
const app = createApp({
  config: { production: false, webDistDir: undefined, apiRateLimit: 1000 },
  logger: silent,
  db,
  ...mistral.deps(db, silent),
  auth,
  lifecycle: createLifecycle(),
  background: tasks.run,
});
const harness: Harness = { app, origin: ORIGIN, db, inbox, records: turnRecords(db), settled: tasks.settled };

beforeEach(() => {
  mistral.chat.length = 0;
  mistral.moderations.length = 0;
});

const analysis = {
  json: { subject: 'mathematiques', bringsExercise: false, proposesAnswer: false, asksSolution: false, asksExplanation: false, saysStuck: false },
};

describe('playConversation', () => {
  it('plays each turn of a scenario as a fresh student, with what the student read and the record of the turn', async () => {
    const guardian = await signInGuardian(harness);
    const { scenario, exercise } = lookup({ scenarioId: 'S2', exerciseId: 'M1', repetition: 1 });
    mistral.chat.push(analysis, { text: 'Que fais-tu du + 5 ?' });

    const transcript = await playConversation(harness, guardian, scenario, exercise, 1);
    expect(transcript).toMatchObject({ scenarioId: 'S2', exerciseId: 'M1', repetition: 1 });
    expect(transcript.turns).toHaveLength(1);
    expect(transcript.turns[0]).toMatchObject({
      student: renderTurns(scenario, exercise)[0]?.text,
      text: 'Que fais-tu du + 5 ?',
      record: { outcome: 'passed' },
    });
    expect(transcript.turns[0]?.error).toBeUndefined();
  });

  it('records the fixed reply to a distress', async () => {
    const guardian = await signInGuardian(harness);
    const { scenario, exercise } = lookup({ scenarioId: 'S5', exerciseId: 'M1', repetition: 1 });
    // The calls in their order: the first turn, the session's title after it, the second turn; the
    // last message says the distress in words the rules catch (domain/distress.ts), no model asked.
    mistral.chat.push(analysis, { text: 'Que fais-tu du + 5 ?' }, { text: 'Équations' }, analysis, { text: 'Tu as déjà trouvé une étape.' });

    const transcript = await playConversation(harness, guardian, scenario, exercise, 1);
    expect(transcript.turns.at(-1)).toMatchObject({ text: DISTRESS_REPLY, record: { outcome: 'distress' } });
  });

  it('stops at a turn the route refuses, with its error', async () => {
    const guardian = await signInGuardian(harness);
    const { scenario, exercise } = lookup({ scenarioId: 'S3', exerciseId: 'M1', repetition: 1 });
    mistral.chat.push(analysis, { status: 500 });

    const transcript = await playConversation(harness, guardian, scenario, exercise, 1);
    expect(transcript.turns).toHaveLength(1);
    expect(transcript.turns[0]?.error).toBeDefined();
  });
});

describe('removeEvalAccounts', () => {
  it('deletes the guardians of earlier runs and their students, and nothing else', async () => {
    await signInGuardian(harness);
    const others = await db.select().from(user).where(like(user.email, '%@example.com'));
    expect(await removeEvalAccounts(db)).toBeGreaterThan(0);
    expect(await db.select().from(user).where(like(user.email, '%@eval.test'))).toEqual([]);
    expect(await db.select().from(user).where(like(user.email, '%@example.com'))).toEqual(others);
  });
});
