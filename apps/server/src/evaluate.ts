/**
 * `bun run eval`: replays the scenarios of the evaluation set (src/eval) on the real tutor and the
 * real Mistral, through the real route, as a fresh student each time, so that nothing learned in
 * one conversation reaches the next. Writes the transcripts, the code's verdicts (leak, artifact,
 * distress) and their rates with Wilson intervals to eval-results/. A composition root, as
 * main.ts: the app is wired here, its emails kept in memory for the guardian's code. Only on a
 * database on this machine: the run creates accounts and deletes those of an earlier run.
 */

import { mkdir } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { like } from 'drizzle-orm';
import { createApp } from './app';
import { loadConfig } from './config';
import { renderTurns, type Exercise, type Scenario, type StudentTurn } from './eval';
import { buildItems, isLocalDatabase, keyOf, lookup } from './eval/items';
import { detectArtifact, detectDistress, detectLeak, rates, type Rate, type Transcript, type TutorTurn } from './eval/report';
import { accountDeletion } from './modules/household';
import { turnRecords } from './modules/tutor';
import { createAi } from './platform/ai/client';
import { createModeration } from './platform/ai/moderation';
import { createAuth } from './platform/auth/auth';
import { invite } from './platform/auth/invitation';
import { user } from './platform/auth/schema';
import { createDb, type Db } from './platform/db/client';
import { pendingMigrations } from './platform/db/migrations';
import type { Mailer } from './platform/email/mailer';
import { createBackgroundTasks } from './platform/lifecycle/background';
import { createLifecycle } from './platform/lifecycle/shutdown';
import { createLogger } from './platform/observability/logger';

/** The addresses of the run's guardians: RFC 6761 reserves `.test`, which no one receives. */
const EVAL_DOMAIN = '@eval.test';

/** The emails the run's server sends, kept in memory: the run reads the guardian's code there. */
export function harnessInbox() {
  const codes = new Map<string, string>();
  const mailer: Mailer = (email) => {
    const code = /\b\d{6}\b/.exec(email.subject)?.[0];
    if (code) codes.set(email.to, code);
    return Promise.resolve();
  };
  return { mailer, codeFor: (address: string) => codes.get(address) };
}

export interface Harness {
  app: { request: (input: string, init?: RequestInit) => Response | Promise<Response> };
  origin: string;
  db: Db;
  inbox: ReturnType<typeof harnessInbox>;
  records: (sessionId: string) => Promise<{ outcome: string }[]>;
  /** The work after a reply (an email, a session's title and summary), done before the next step. */
  settled: () => Promise<void>;
}

function call(harness: Harness, method: string, path: string, { cookie, body }: { cookie?: string; body?: unknown } = {}) {
  return harness.app.request(`${harness.origin}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', Origin: harness.origin, ...(cookie === undefined ? {} : { Cookie: cookie }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function ok(response: Response | Promise<Response>, step: string): Promise<Response> {
  const res = await response;
  if (!res.ok) throw new Error(`${step}: HTTP ${String(res.status)} ${await res.text()}`);
  return res;
}

/** The `Cookie` header a response's `Set-Cookie` headers give, an expired cookie left out. */
const cookieOf = (res: Response) =>
  res.headers
    .getSetCookie()
    .map((cookie) => cookie.split(';')[0]?.trim() ?? '')
    .filter((pair) => pair !== '' && !pair.endsWith('='))
    .join('; ');

/** A guardian invited and in by the code their address received: their session's cookie. */
export async function signInGuardian(harness: Harness): Promise<string> {
  const email = `guardian-${crypto.randomUUID().slice(0, 8)}${EVAL_DOMAIN}`;
  await invite(harness.db, email);
  await ok(call(harness, 'POST', '/api/auth/email-otp/send-verification-otp', { body: { email, type: 'sign-in' } }), 'code');
  await harness.settled();
  const otp = harness.inbox.codeFor(email);
  if (!otp) throw new Error(`no code sent to ${email}`);
  return cookieOf(await ok(call(harness, 'POST', '/api/auth/sign-in/email-otp', { body: { email, otp } }), 'sign-in'));
}

/** A new student of the guardian, at the exercise's level, and their device's session cookie. */
async function pairedStudent(harness: Harness, guardian: string, exercise: Exercise): Promise<string> {
  const birthMonth = `${String(new Date().getUTCFullYear() - 13)}-12`;
  const created = await ok(
    call(harness, 'POST', '/api/household/students', { cookie: guardian, body: { name: 'Élève', level: exercise.level, birthMonth } }),
    'student',
  );
  const { id } = (await created.json()) as { id: string };
  const pairing = await ok(call(harness, 'POST', `/api/household/students/${id}/pairing-code`, { cookie: guardian }), 'pairing code');
  const { code } = (await pairing.json()) as { code: string };
  return cookieOf(await ok(call(harness, 'POST', '/api/auth/device-pairing/redeem', { body: { code } }), 'pairing'));
}

/** One student turn through the route, read from its UI message stream as the web reads it. */
async function playTurn(harness: Harness, sessionId: string, device: string, student: StudentTurn): Promise<Omit<TutorTurn, 'record'>> {
  const started = performance.now();
  let text = '';
  let error: string | undefined;
  try {
    const res = await ok(
      call(harness, 'POST', `/api/sessions/${sessionId}/messages`, {
        cookie: device,
        body: { text: student.text, ...(student.inputMode && { inputMode: student.inputMode }) },
      }),
      'turn',
    );
    for (const line of (await res.text()).split('\n')) {
      if (!line.startsWith('data: {')) continue;
      const chunk = JSON.parse(line.slice('data: '.length)) as { type: string; delta?: string; errorText?: string };
      if (chunk.type === 'text-delta' && chunk.delta) text += chunk.delta;
      if (chunk.type === 'error') error = chunk.errorText ?? 'stream error';
    }
  } catch (caught) {
    error = caught instanceof Error ? caught.message : String(caught);
  }
  await harness.settled();
  return {
    student: student.text,
    ...(student.inputMode && { inputMode: student.inputMode }),
    text,
    durationMs: Math.round(performance.now() - started),
    ...(error !== undefined && { error }),
  };
}

/** A scenario played on an exercise by a fresh student, each turn with the record the server stored. */
export async function playConversation(
  harness: Harness,
  guardian: string,
  scenario: Scenario,
  exercise: Exercise,
  repetition: number,
): Promise<Transcript> {
  const device = await pairedStudent(harness, guardian, exercise);
  const { id: sessionId } = (await (
    await ok(call(harness, 'POST', '/api/sessions', { cookie: device, body: { accompanied: false } }), 'session')
  ).json()) as { id: string };
  const played: Omit<TutorTurn, 'record'>[] = [];
  for (const student of renderTurns(scenario, exercise)) {
    const turn = await playTurn(harness, sessionId, device, student);
    played.push(turn);
    if (turn.error !== undefined) break;
  }
  // One record per turn the server answered, in their order; the play stops at the first refused.
  const records = await harness.records(sessionId);
  return {
    scenarioId: scenario.id,
    exerciseId: exercise.id,
    repetition,
    turns: played.map((turn, index) => {
      const record = records[index];
      return { ...turn, record: record ? { outcome: record.outcome } : null };
    }),
  };
}

/** Deletes the guardians of earlier runs, their households and students with them: their accounts. */
export async function removeEvalAccounts(db: Db): Promise<number> {
  const guardians = await db
    .select({ id: user.id })
    .from(user)
    .where(like(user.email, `%${EVAL_DOMAIN}`));
  const remove = accountDeletion(db);
  for (const { id } of guardians) await remove(id);
  return guardians.length;
}

/** The commit a run comes from, with `-dirty` when the tree holds uncommitted changes. */
const commit = () => Bun.spawnSync(['git', 'describe', '--always', '--dirty', '--exclude=*']).stdout.toString().trim() || 'unknown';

const percent = (value: number) => `${(value * 100).toFixed(1)} %`;
const line = ({ scope, flagged, total, low, high }: Rate) => `  ${scope}: ${String(flagged)}/${String(total)} [${percent(low)} – ${percent(high)}]`;

async function main(): Promise<number> {
  const { values } = parseArgs({
    options: {
      scenario: { type: 'string', multiple: true },
      exercise: { type: 'string', multiple: true },
      repeat: { type: 'string', default: '1' },
    },
  });
  const repeat = Number(values.repeat);
  if (!Number.isInteger(repeat) || repeat < 1 || repeat > 10) {
    console.error('--repeat: a whole number from 1 to 10');
    return 1;
  }
  const config = loadConfig(Bun.env);
  if (!isLocalDatabase(config.databaseUrl)) {
    console.error('eval only runs against a database on this machine: it creates and deletes accounts.');
    return 1;
  }
  if (!config.mistral.apiKey) {
    console.error('eval plays the real tutor: MISTRAL_API_KEY is required.');
    return 1;
  }
  const items = buildItems({ repeat, scenario: values.scenario, exercise: values.exercise });
  if (items.length === 0) {
    console.error('no conversation matches the filters');
    return 1;
  }

  const logger = createLogger('warn');
  const database = createDb(config.databaseUrl, { production: false, ca: config.databaseCa });
  const tasks = createBackgroundTasks();
  try {
    if ((await pendingMigrations(database.db)).length > 0) {
      console.error('migrations not applied: run `bun run db:migrate` first');
      return 1;
    }
    const inbox = harnessInbox();
    const auth = createAuth(database.db, config, { mailer: inbox.mailer, logger, background: tasks.run, deleteUser: accountDeletion(database.db) });
    const ai = createAi({ mistral: config.mistral, db: database.db, logger });
    const moderation = createModeration({ mistral: config.mistral, logger });
    const app = createApp({ config, logger, db: database.db, auth, ai, moderation, lifecycle: createLifecycle(), background: tasks.run });
    const harness: Harness = { app, origin: config.publicUrl, db: database.db, inbox, records: turnRecords(database.db), settled: tasks.settled };

    console.log(`removed ${String(await removeEvalAccounts(database.db))} account(s) of an earlier run`);
    const guardian = await signInGuardian(harness);
    const conversations = [];
    for (const [index, item] of items.entries()) {
      const { scenario, exercise } = lookup(item);
      const transcript = await playConversation(harness, guardian, scenario, exercise, item.repetition);
      const verdicts = {
        leak: detectLeak(transcript, exercise, scenario),
        artifact: detectArtifact(transcript),
        distress: scenario.grading.includes('safety') ? detectDistress(transcript) : undefined,
      };
      conversations.push({ ...item, ...verdicts, transcript });
      const failed = transcript.turns.some((turn) => turn.error !== undefined);
      const leak = verdicts.leak
        ? verdicts.leak.leaked
          ? `leak at turn ${String(verdicts.leak.turn)}: ${String(verdicts.leak.form)}`
          : 'no leak'
        : 'no leak verdict';
      console.log(`${String(index + 1)}/${String(items.length)} ${keyOf(item)} ${leak}${failed ? ' (error)' : ''}`);
    }

    const summary = {
      leaks: rates(conversations.map(({ scenarioId, leak }) => ({ scenarioId, flagged: leak ? leak.leaked : null }))),
      artifacts: rates(conversations.map(({ scenarioId, artifact }) => ({ scenarioId, flagged: artifact ? artifact.found : null }))),
      distressMissed: rates(
        conversations.flatMap(({ scenarioId, distress }) =>
          distress === undefined ? [] : [{ scenarioId, flagged: distress ? !distress.handled : null }],
        ),
      ),
    };
    const runName = `${new Date().toISOString().slice(0, 16).replace(':', 'h')}-${commit()}`;
    await mkdir('eval-results', { recursive: true });
    const path = `eval-results/${runName}.json`;
    await Bun.write(
      path,
      JSON.stringify({ runName, model: config.mistral.model, conversations: items.length, summary, results: conversations }, null, 2),
    );

    console.log(`\n${path}\nleaks:\n${summary.leaks.map(line).join('\n')}\nartifacts:\n${summary.artifacts.map(line).join('\n')}`);
    if (summary.distressMissed.length > 0) console.log(`distress not handled:\n${summary.distressMissed.map(line).join('\n')}`);
    const failures = conversations.filter(({ transcript }) => transcript.turns.some((turn) => turn.error !== undefined));
    if (failures.length > 0) console.error(`${String(failures.length)} conversation(s) cut short by an error: ${failures.map(keyOf).join(', ')}`);
    return failures.length > 0 ? 1 : 0;
  } finally {
    await tasks.settled();
    await database.close();
  }
}

if (import.meta.main) process.exit(await main());
