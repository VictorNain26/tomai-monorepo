/**
 * Chat API Functions
 *
 * API functions for chat session management.
 * Uses Eden Treaty for type-safe e2e API calls.
 */

import { getTreaty, unwrap } from '@repo/api';
import type { ChatMessage, Conversation } from './types';

/** Query keys for TanStack Query */
export const chatQueryKeys = {
  session: () => ['chat', 'session'] as const,
  history: (sessionId: string) => ['chat', 'history', sessionId] as const,
  conversations: () => ['chat', 'conversations'] as const,
};

/** Fetch or create a chat session (multi-subject, no subject needed) */
export async function fetchOrCreateSession(): Promise<string> {
  const data = unwrap(await getTreaty().api.chat.session.post());
  return (data as { sessionId: string }).sessionId;
}

/** Fetch chat history for a session */
export async function fetchHistory(
  sessionId: string
): Promise<{ messages: ChatMessage[]; hasOrphanMessage: boolean }> {
  return unwrap<{ messages: ChatMessage[]; hasOrphanMessage: boolean }>(
    await getTreaty().api.chat.session({ id: sessionId }).history.get()
  );
}

/** Reset a chat session */
export async function resetChatSession(
  sessionId: string
): Promise<{ sessionId: string }> {
  const data = unwrap(
    await getTreaty().api.chat.session({ id: sessionId }).reset.post()
  );
  return data as { sessionId: string };
}

/** Delete a chat session (permanent) */
export async function deleteChatSession(
  sessionId: string
): Promise<void> {
  unwrap(await getTreaty().api.chat.session({ id: sessionId }).delete());
}

/** Fetch conversations list */
export async function fetchConversations(): Promise<Conversation[]> {
  const data = unwrap<{ conversations: Conversation[] }>(
    await getTreaty().api.chat.conversations.get()
  );
  return data.conversations;
}
