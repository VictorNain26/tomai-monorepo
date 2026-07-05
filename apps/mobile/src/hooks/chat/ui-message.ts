/**
 * Chat UI Message helpers
 *
 * Conversions between the flat `ChatMessage` shape (server history / SQLite
 * cache — unaffected by the AI SDK migration, see `useOfflineCache.ts`) and
 * the AI SDK `TomChatMessage` (`UIMessage`) shape consumed by `useChat` from
 * `@ai-sdk/react`. Also holds the Pronote context builder shared with the
 * request body sent to `/api/chat/stream`.
 */

import { isTextUIPart } from 'ai';
import type { TomChatMessage } from '@repo/api';
import type {
  PronoteHomework,
  PronoteGrade,
  PronoteTimetableEntry,
  PronoteChatContext,
} from '@/services/pronote/pronote-types';
import type { ChatMessage } from './types';

/** Concatenate every `text` part of a UIMessage, in order. */
export function extractText(parts: TomChatMessage['parts']): string {
  return parts
    .filter(isTextUIPart)
    .map(part => part.text)
    .join('');
}

/** Seed `useChat({ messages })` from server/cache history (text-only — no tool/data parts in history). */
export function toTomChatMessage(message: ChatMessage): TomChatMessage {
  return {
    id: message.id,
    role: message.role,
    parts: [{ type: 'text', text: message.content }],
  };
}

/** Build chat context from Pronote store state (snapshot read). */
export function buildPronoteChatContext(state: {
  homework: PronoteHomework[];
  grades: PronoteGrade[];
  timetable: PronoteTimetableEntry[];
}): PronoteChatContext | undefined {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(now);
  todayEnd.setHours(23, 59, 59, 999);

  const todayTimetable = state.timetable.filter((e) => {
    const start = new Date(e.startDate);
    return start >= todayStart && start <= todayEnd;
  });

  const recentGrades = [...state.grades]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10);

  const ctx: PronoteChatContext = {
    homework: state.homework.length > 0 ? state.homework : undefined,
    recentGrades: recentGrades.length > 0 ? recentGrades : undefined,
    todayTimetable: todayTimetable.length > 0 ? todayTimetable : undefined,
  };

  if (!ctx.homework && !ctx.recentGrades && !ctx.todayTimetable) return undefined;
  return ctx;
}

/**
 * Parse the error thrown by `DefaultChatTransport` on a non-2xx response.
 * Pre-stream guards (429 `QUOTA_EXCEEDED`, 409 `CONCURRENT_STREAM`, ...) reply
 * with the `{ error: { code, message } }` JSON envelope (see
 * `apps/server/src/lib/errors.ts`); the transport surfaces the raw response
 * text as `Error.message`. Falls back to the raw message for network errors
 * (no JSON body).
 */
export function parseTransportErrorMessage(error: Error): string {
  try {
    const parsed = JSON.parse(error.message) as { error?: { message?: string } };
    if (parsed.error?.message) return parsed.error.message;
  } catch {
    // Not JSON (network failure, timeout...) — fall through to raw message.
  }
  return error.message || 'Erreur de connexion au serveur';
}
