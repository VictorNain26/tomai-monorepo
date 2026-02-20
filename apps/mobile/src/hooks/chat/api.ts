/**
 * Chat API Functions
 *
 * API functions for chat session management.
 */

import { apiClient } from '@repo/api';
import type { ChatMessage } from './types';

/** Query keys for TanStack Query */
export const chatQueryKeys = {
  session: () => ['chat', 'session'] as const,
  history: (sessionId: string) => ['chat', 'history', sessionId] as const,
};

/** Fetch or create a chat session (multi-subject, no subject needed) */
export async function fetchOrCreateSession(): Promise<string> {
  const data = await apiClient.post<{ sessionId: string }>('/api/chat/session', {});
  return data.sessionId;
}

/** Fetch chat history for a session */
export async function fetchHistory(
  sessionId: string
): Promise<{ messages: ChatMessage[] }> {
  return apiClient.get<{ messages: ChatMessage[] }>(`/api/chat/session/${sessionId}/history`);
}

/** Reset a chat session */
export async function resetChatSession(
  sessionId: string
): Promise<{ sessionId: string }> {
  return apiClient.post<{ sessionId: string }>(
    `/api/chat/session/${sessionId}/reset`
  );
}

/** Delete a chat session (permanent) */
export async function deleteChatSession(
  sessionId: string
): Promise<void> {
  await apiClient.delete(`/api/chat/session/${sessionId}`);
}
