/** The student's sessions with Tom, as `/api/sessions` serves them, and their chat. */

import { queryOptions } from '@tanstack/react-query';
import type { UIMessage } from 'ai';
import type { InferRequestType, InferResponseType } from 'hono/client';
import type { TurnStep } from 'tomai-server/contract';
import { api, isProblem, parseResponse } from './api';

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
export const toUIMessage = ({ id, role, text }: StoredMessage): ChatMessage => ({
  id,
  role: role === 'student' ? 'user' : 'assistant',
  parts: [{ type: 'text', text }],
});

/** The text a message carries, its parts joined. */
export const textOf = (message: UIMessage | undefined) => (message?.parts ?? []).map((part) => (part.type === 'text' ? part.text : '')).join('');

/** A message of the session; the server streams the step of the turn as a transient `data-step` part. */
export type ChatMessage = UIMessage<unknown, { step: TurnStep }>;

const WAITING: Record<TurnStep, string> = {
  reading: 'Tom lit ton message…',
  exercise: 'Tom prépare ton exercice, ça prend quelques secondes…',
  writing: 'Tom écrit sa réponse…',
};

/** Whether a streamed value is a step the web can say: the type holds at compile time only. */
export const isTurnStep = (value: unknown): value is TurnStep => typeof value === 'string' && Object.hasOwn(WAITING, value);

/** What Tom does while the student waits; he reads before the first step has arrived. */
export const waitingText = (step: TurnStep | null): string => WAITING[step ?? 'reading'];

/** A failed turn, in words a student reads; the server's own message never shows. */
export function chatMessage(error: Error): string {
  if (isProblem(error, 'QUOTA_EXCEEDED')) return 'Le temps avec Tom est fini pour aujourd’hui. Reviens demain !';
  if (isProblem(error, 'TURN_IN_PROGRESS')) return 'Tom répond encore à ton message précédent : attends sa réponse.';
  if (isProblem(error, 'RATE_LIMITED')) return 'Trop de messages d’un coup. Attends une minute avant de réécrire.';
  if (isProblem(error, 'INVALID_REQUEST')) return 'Ton message est vide ou trop long.';
  return 'Tom n’a pas pu répondre. Réessaie dans un instant.';
}
