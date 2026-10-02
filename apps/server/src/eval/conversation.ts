import { DefaultChatTransport, isDataUIPart, isTextUIPart, isToolUIPart, readUIMessageStream } from 'ai';
import { app } from '../app.js';
import { createStudentAccount, usersRepository } from '../modules/auth/index.js';
import type { TomChatMessage } from '../modules/tutor/index.js';
import { renderTurns, type Exercise, type Scenario } from './index.js';

const ORIGIN = 'http://eval.local';
const USERNAME_PREFIX = 'eval_';

export interface TutorTurn {
  student: string;
  text: string;
  tools: string[];
  /** Tool outputs and data parts, serialised: what the client receives besides the text. */
  toolOutputs: string;
  /** Content of the flashcards created during the turn, as the revision screen shows it. */
  cards: string;
  durationMs: number;
  error?: string;
}

export interface Transcript {
  scenarioId: string;
  exerciseId: string;
  repetition: number;
  turns: TutorTurn[];
}

function call(path: string, cookie: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json');
  if (cookie) headers.set('cookie', cookie);
  return Promise.resolve(app.request(`${ORIGIN}${path}`, { ...init, headers }));
}

/** Routes the AI SDK transport to the app in-process instead of the network. */
function inProcessFetch(cookie: string): typeof fetch {
  return Object.assign(
    (input: string | URL | Request, init?: RequestInit) => call(new URL(input instanceof Request ? input.url : input).pathname, cookie, init),
    { preconnect: fetch.preconnect },
  );
}

async function signIn(username: string, password: string): Promise<string> {
  const response = await call('/api/auth/sign-in/username', '', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
  if (!response.ok) throw new Error(`eval sign-in failed: ${String(response.status)} ${await response.text()}`);
  return response.headers.getSetCookie().map((cookie) => cookie.split(';')[0]).join('; ');
}

async function newSession(cookie: string): Promise<string> {
  const response = await call('/api/chat/session/new', cookie, { method: 'POST' });
  const body = (await response.json()) as { sessionId?: string };
  if (!response.ok || !body.sessionId) throw new Error(`eval session failed: ${String(response.status)}`);
  return body.sessionId;
}

async function deckCards(deckId: string, cookie: string): Promise<string> {
  const response = await call(`/api/learning/decks/${deckId}`, cookie);
  return response.ok ? JSON.stringify(await response.json()) : `deck ${deckId}: HTTP ${String(response.status)}`;
}

async function playTurn(
  transport: DefaultChatTransport<TomChatMessage>,
  sessionId: string,
  cookie: string,
  student: string,
): Promise<TutorTurn> {
  const started = performance.now();
  const turn: TutorTurn = { student, text: '', tools: [], toolOutputs: '', cards: '', durationMs: 0 };
  try {
    const stream = await transport.sendMessages({
      trigger: 'submit-message',
      chatId: sessionId,
      messageId: undefined,
      abortSignal: undefined,
      messages: [{ id: crypto.randomUUID(), role: 'user', parts: [{ type: 'text', text: student }] }],
    });
    let message: TomChatMessage | undefined;
    for await (const update of readUIMessageStream<TomChatMessage>({ stream, terminateOnError: true })) {
      message = update;
    }
    const parts = message?.parts ?? [];
    turn.text = parts.filter(isTextUIPart).map((part) => part.text).join('');
    const toolParts = parts.filter(isToolUIPart);
    turn.tools = toolParts.map((part) => part.type.replace(/^tool-/, ''));
    const dataParts = parts.filter(isDataUIPart);
    turn.toolOutputs = [...toolParts.map((part) => JSON.stringify(part.output)), ...dataParts.map((part) => JSON.stringify(part.data))].join('\n');
    const decks = dataParts.map((part) => part.data.deckId);
    turn.cards = (await Promise.all(decks.map((deckId) => deckCards(deckId, cookie)))).join('\n');
  } catch (error) {
    turn.error = error instanceof Error ? error.message : String(error);
  }
  turn.durationMs = Math.round(performance.now() - started);
  return turn;
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
    prepareSendMessagesRequest: ({ messages }) => ({
      body: { message: messages.at(-1), sessionId, schoolLevel: exercise.level },
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
