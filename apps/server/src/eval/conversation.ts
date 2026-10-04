import { DefaultChatTransport, readUIMessageStream } from 'ai';
import { z } from 'zod';
import { app } from '../app.js';
import { createStudentAccount, usersRepository } from '../modules/auth/index.js';
import type { TomChatMessage } from '../modules/tutor/index.js';
import { renderTurns, type Exercise, type Scenario, type StudentTurn } from './index.js';
import { errorMessage } from './output.js';
import { collectStrings, cookieHeader, readTurnParts, type Transcript, type TutorTurn } from './turn-parts.js';

const ORIGIN = 'http://eval.local';
const newSessionBody = z.object({ sessionId: z.string().min(1) });
const USERNAME_PREFIX = 'eval_';

function call(pathAndQuery: string, cookie: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json');
  if (cookie) headers.set('cookie', cookie);
  return Promise.resolve(app.request(`${ORIGIN}${pathAndQuery}`, { ...init, headers }));
}

/** Routes the AI SDK transport to the app in-process instead of the network. */
function inProcessFetch(cookie: string): typeof fetch {
  return Object.assign(
    (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : input);
      return call(`${url.pathname}${url.search}`, cookie, init);
    },
    { preconnect: fetch.preconnect },
  );
}

async function signIn(username: string, password: string): Promise<string> {
  const response = await call('/api/auth/sign-in/username', '', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) throw new Error(`eval sign-in failed: ${String(response.status)} ${await response.text()}`);
  return cookieHeader(response.headers.getSetCookie());
}

async function newSession(cookie: string): Promise<string> {
  const response = await call('/api/chat/session/new', cookie, { method: 'POST' });
  const body = newSessionBody.safeParse(await response.json());
  if (!response.ok || !body.success) throw new Error(`eval session failed: ${String(response.status)}`);
  return body.data.sessionId;
}

async function deckCards(deckId: string, cookie: string): Promise<string> {
  const response = await call(`/api/learning/decks/${deckId}`, cookie);
  if (!response.ok) throw new Error(`deck ${deckId}: HTTP ${String(response.status)}`);
  return collectStrings(await response.json());
}

async function playTurn(
  transport: DefaultChatTransport<TomChatMessage>,
  sessionId: string,
  cookie: string,
  student: StudentTurn,
): Promise<TutorTurn> {
  const started = performance.now();
  let message: TomChatMessage | undefined;
  let error: string | undefined;
  try {
    const stream = await transport.sendMessages({
      trigger: 'submit-message',
      chatId: sessionId,
      messageId: undefined,
      abortSignal: undefined,
      messages: [{ id: crypto.randomUUID(), role: 'user', parts: [{ type: 'text', text: student.text }] }],
      // The channel the client declares for a turn dictated into the microphone.
      ...(student.voice && { body: { inputMode: 'voice' } }),
    });
    for await (const update of readUIMessageStream<TomChatMessage>({ stream, terminateOnError: true })) {
      message = update;
    }
  } catch (caught) {
    error = errorMessage(caught);
  }
  // Read what arrived even when the stream broke: a leak shown before the error still counts.
  const { deckIds, ...parts } = readTurnParts(message?.parts ?? []);
  let cards = '';
  try {
    cards = (await Promise.all(deckIds.map((deckId) => deckCards(deckId, cookie)))).join('\n');
  } catch (caught) {
    error ??= errorMessage(caught);
  }
  return {
    student: student.text,
    ...(student.voice && { voice: true as const }),
    ...parts,
    cards,
    durationMs: Math.round(performance.now() - started),
    ...(error !== undefined && { error }),
  };
}

/**
 * Removes the accounts of the previous run. They are not deleted at the end of their own
 * conversation because the route keeps writing to them in the background (session title,
 * summary) after the stream closes.
 */
export function removeEvalAccounts(): Promise<number> {
  return usersRepository.deleteByUsernamePrefix(USERNAME_PREFIX);
}

/**
 * Plays one scenario on one exercise through the real chat route, as a fresh student in a
 * fresh session, so nothing learned in one conversation reaches the next.
 */
export async function playConversation(scenario: Scenario, exercise: Exercise, repetition: number): Promise<Transcript> {
  const username = `${USERNAME_PREFIX}${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`;
  const password = crypto.randomUUID();
  await createStudentAccount({
    firstName: 'Élève',
    lastName: 'Évaluation',
    username,
    password,
    schoolLevel: exercise.level,
    dateOfBirth: '2013-06-01',
  });
  const cookie = await signIn(username, password);
  const sessionId = await newSession(cookie);
  const transport = new DefaultChatTransport<TomChatMessage>({
    api: `${ORIGIN}/api/chat/stream`,
    fetch: inProcessFetch(cookie),
    prepareSendMessagesRequest: ({ messages, body }) => ({
      body: { ...body, message: messages.at(-1), sessionId, schoolLevel: exercise.level },
    }),
  });
  const turns: TutorTurn[] = [];
  for (const student of renderTurns(scenario, exercise)) {
    const turn = await playTurn(transport, sessionId, cookie, student);
    turns.push(turn);
    if (turn.error) break;
  }
  return { scenarioId: scenario.id, exerciseId: exercise.id, repetition, turns };
}
