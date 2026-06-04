/**
 * Chat API Functions
 *
 * API functions for chat session management.
 * Uses Eden Treaty for type-safe e2e API calls.
 */

import { getTreaty, unwrap, type ResponseData } from '@repo/api';
import type { ChatMessage, Conversation } from './types';

// ============================================================================
// TYPES — derived from the server contract (single source of truth)
// ============================================================================

type ChatApi = ReturnType<typeof getTreaty>['api']['chat'];
type SessionById = ReturnType<ChatApi['session']>;

/** Raw message shape from server (role includes 'system', attachedFile is {}). */
type ServerMessage = ResponseData<SessionById['history']['get']>['messages'][number];

/** Query keys for TanStack Query */
export const chatQueryKeys = {
  session: () => ['chat', 'session'] as const,
  history: (sessionId: string) => ['chat', 'history', sessionId] as const,
  conversations: () => ['chat', 'conversations'] as const,
};

/** Map a raw server message to the client ChatMessage shape. */
function toClientMessage(m: ServerMessage): ChatMessage | null {
  // Filter system messages — they are not rendered in chat UI
  if (m.role === 'system') return null;
  return {
    id: m.id,
    role: m.role,
    content: m.content,
    timestamp: m.timestamp,
    aiModel: m.aiModel,
    // attachedFile arrives as {} when empty; treat as null unless it has fileName
    attachedFile:
      m.attachedFile && typeof m.attachedFile === 'object' && 'fileName' in m.attachedFile
        ? (m.attachedFile as ChatMessage['attachedFile'])
        : null,
  };
}

/** Fetch or create a chat session (multi-subject, no subject needed) */
export async function fetchOrCreateSession(): Promise<string> {
  const { sessionId } = unwrap(await getTreaty().api.chat.session.post());
  return sessionId;
}

/** Fetch chat history for a session */
export async function fetchHistory(
  sessionId: string
): Promise<{ messages: ChatMessage[]; hasOrphanMessage: boolean }> {
  const { messages, hasOrphanMessage } = unwrap(
    await getTreaty().api.chat.session({ id: sessionId }).history.get()
  );
  const clientMessages = messages.flatMap((m) => {
    const mapped = toClientMessage(m);
    return mapped ? [mapped] : [];
  });
  return { messages: clientMessages, hasOrphanMessage };
}

/** Reset a chat session */
export async function resetChatSession(
  sessionId: string
): Promise<{ sessionId: string }> {
  const { sessionId: newSessionId } = unwrap(
    await getTreaty().api.chat.session({ id: sessionId }).reset.post()
  );
  return { sessionId: newSessionId };
}

/** Delete a chat session (permanent) */
export async function deleteChatSession(
  sessionId: string
): Promise<void> {
  unwrap(await getTreaty().api.chat.session({ id: sessionId }).delete());
}

/** Always create a new conversation session */
export async function createNewSession(): Promise<string> {
  const { sessionId } = unwrap(await getTreaty().api.chat.session.new.post());
  return sessionId;
}

/** Fetch conversations list */
export async function fetchConversations(): Promise<Conversation[]> {
  const { conversations } = unwrap(
    await getTreaty().api.chat.conversations.get()
  );
  return conversations;
}
