import { DefaultChatTransport } from 'ai';
import type { TomChatMessage } from '../modules/tutor/index.js';
import type { Exercise, StudentTurn } from './index.js';

/** The client's chat transport, sending what `POST /api/chat/stream` reads, through `fetchImpl`. */
export function chatTransport(api: string, fetchImpl: typeof fetch, sessionId: string, schoolLevel: Exercise['level']) {
  return new DefaultChatTransport<TomChatMessage>({
    api,
    fetch: fetchImpl,
    prepareSendMessagesRequest: ({ messages, body }) => ({
      body: { ...body, message: messages.at(-1), sessionId, schoolLevel },
    }),
  });
}

/** One student turn as the client sends it: a spoken one declares the voice channel. */
export function sendTurn(transport: DefaultChatTransport<TomChatMessage>, sessionId: string, student: StudentTurn) {
  return transport.sendMessages({
    trigger: 'submit-message',
    chatId: sessionId,
    messageId: undefined,
    abortSignal: undefined,
    messages: [{ id: crypto.randomUUID(), role: 'user', parts: [{ type: 'text', text: student.text }] }],
    ...(student.inputMode && { body: { inputMode: student.inputMode } }),
  });
}
