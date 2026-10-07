/** The student's sessions with Tom, as `/api/sessions` serves them, and their chat. */

import { queryOptions } from '@tanstack/react-query';
import { APICallError, type UIMessage } from 'ai';
import type { InferRequestType, InferResponseType } from 'hono/client';
import type { ProblemCode } from 'tomai-server/contract';
import { api, parseResponse } from './api';

const sessions = api.sessions;

type StoredMessage = InferResponseType<(typeof sessions)[':id']['messages']['$get'], 200>[number];
export type TurnBody = InferRequestType<(typeof sessions)[':id']['messages']['$post']>['json'];

export const sessionsQuery = queryOptions({
  queryKey: ['sessions'],
  queryFn: () => parseResponse(sessions.$get()),
});

export const messagesQuery = (sessionId: string) =>
  queryOptions({
    queryKey: ['sessions', sessionId, 'messages'],
    queryFn: () => parseResponse(sessions[':id'].messages.$get({ param: { id: sessionId } })),
  });

/** A stored message as useChat shows it. */
export const toUIMessage = ({ id, role, text }: StoredMessage): UIMessage => ({
  id,
  role: role === 'student' ? 'user' : 'assistant',
  parts: [{ type: 'text', text }],
});

/** The text a message carries, its parts joined. */
export const textOf = (message: UIMessage | undefined) => (message?.parts ?? []).map((part) => (part.type === 'text' ? part.text : '')).join('');

/** The code of the problem the server answered a turn with; null for a failure without one. */
export function problemCodeOf(error: Error): string | null {
  if (!APICallError.isInstance(error) || error.responseBody === undefined) return null;
  try {
    const body: unknown = JSON.parse(error.responseBody);
    return typeof body === 'object' && body !== null && 'code' in body && typeof body.code === 'string' ? body.code : null;
  } catch {
    return null;
  }
}

const CHAT_MESSAGES = {
  QUOTA_EXCEEDED: 'Le temps avec Tom est fini pour aujourd’hui. Reviens demain !',
  TURN_IN_PROGRESS: 'Tom répond encore à ton message précédent : attends sa réponse.',
  RATE_LIMITED: 'Trop de messages d’un coup. Attends une minute avant de réécrire.',
} satisfies Partial<Record<ProblemCode, string>>;
const chatMessages: Partial<Record<string, string>> = CHAT_MESSAGES;

/** A failed turn, in words a student reads; the server's own message never shows. */
export function chatMessage(error: Error): string {
  const code = problemCodeOf(error);
  return (code === null ? undefined : chatMessages[code]) ?? 'Tom n’a pas pu répondre. Réessaie dans un instant.';
}
