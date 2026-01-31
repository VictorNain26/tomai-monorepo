/**
 * Chat API Functions
 *
 * API functions for chat session management.
 */

import { apiClient } from '@repo/api';
import type { ChatMessage } from './types';

/** Query keys for TanStack Query */
export const chatQueryKeys = {
  session: (subject: string) => ['chat', 'session', subject] as const,
  history: (sessionId: string) => ['chat', 'history', sessionId] as const,
};

/** Fetch or create a chat session */
export async function fetchOrCreateSession(subject: string): Promise<string> {
  const data = await apiClient.post<{ sessionId: string }>('/api/chat/session', { subject });
  return data.sessionId;
}

/** Fetch chat history for a session */
export async function fetchHistory(
  sessionId: string
): Promise<{ messages: ChatMessage[] }> {
  try {
    return await apiClient.get<{ messages: ChatMessage[] }>(`/api/chat/session/${sessionId}/history`);
  } catch {
    return { messages: [] };
  }
}

/** Reset a chat session */
export async function resetChatSession(
  sessionId: string
): Promise<{ sessionId: string }> {
  return apiClient.post<{ sessionId: string }>(
    `/api/chat/session/${sessionId}/reset`
  );
}
