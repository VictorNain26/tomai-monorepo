/**
 * Chat UI Message helpers
 *
 * Conversions between the flat `ChatMessage` shape (server history / SQLite
 * cache — unaffected by the AI SDK migration, see `useOfflineCache.ts`) and
 * the AI SDK `TomChatMessage` (`UIMessage`) shape consumed by `useChat` from
 * `@ai-sdk/react`. Also holds the Pronote context builder shared with the
 * request body sent to `/api/chat/stream`.
 */

import { isTextUIPart, isToolUIPart, getToolName } from 'ai';
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

/** Same French labels the legacy SSE route used (`mistral-helpers.ts`'s `getToolStatusLabel`). */
export function getToolStatusLabel(name: string): string {
  switch (name) {
    case 'search_educational_content':
      return 'Recherche dans les programmes...';
    case 'generate_flashcards':
      return 'Création de flashcards...';
    case 'get_student_profile':
      return 'Analyse du profil...';
    case 'update_student_profile':
      return 'Mémorisation...';
    case 'get_app_help':
      return 'Consultation du guide...';
    default:
      return 'Traitement en cours...';
  }
}

const TOOL_STATES_WITHOUT_OUTPUT = new Set(['input-streaming', 'input-available']);

/**
 * Derive the "Recherche dans les programmes..."-style status from the
 * in-flight assistant message's tool parts — the last tool part still
 * awaiting output, mapped to its French label. `null` when no tool call is
 * active (the screen falls back to the generic "Tom réfléchit").
 */
export function deriveStreamStatus(message: TomChatMessage | undefined): string | null {
  if (!message || message.role !== 'assistant') return null;

  const activeToolPart = [...message.parts]
    .reverse()
    .find((part) => isToolUIPart(part) && TOOL_STATES_WITHOUT_OUTPUT.has(part.state));

  if (!activeToolPart || !isToolUIPart(activeToolPart)) return null;
  return getToolStatusLabel(getToolName(activeToolPart));
}
