/**
 * useChat Hook - React Native
 *
 * Port du hook web adapté à React Native.
 * Gère les sessions, le streaming SSE, et les attachments.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getBaseUrl, apiClient } from '@repo/api';
import { useUser, type IAppUser } from '@/lib/auth';

// ============================================================================
// TYPES (aligned with backend apps/server/src/routes/api.routes.ts)
// ============================================================================

/** Backend chat history message (GET /api/chat/session/:id/history) */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string; // ISO string from backend
  aiModel?: string | null;
  attachedFile?: AttachedFileInfo | null;
}

/** Backend attachedFile structure (from messages table JSONB) */
export interface AttachedFileInfo {
  fileName: string;
  fileId?: string;
  geminiFileId?: string;
  mimeType?: string;
  fileSizeBytes?: number;
}

/** File attachment for pending uploads (client-side) */
export interface ChatFileAttachment {
  fileId: string;
  fileName: string;
  mimeType: string;
  preview?: string;
}

/** Backend SSE stream chunk (from gemini-chat.service.ts GeminiStreamChunk) */
interface StreamChunk {
  type: 'content' | 'done' | 'error';
  id: string;
  model?: string;
  timestamp?: number;
  delta?: string;
  content?: string;
  role?: 'assistant';
  finishReason?: 'stop' | 'length' | 'error';
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  metadata?: {
    sessionId?: string;
    usedRAG?: boolean;
  };
  error?: {
    message: string;
    code?: string;
  };
}

interface UseChatOptions {
  initialSessionId?: string | null;
  subject: string;
}

interface UseChatReturn {
  messages: ChatMessage[];
  pendingAttachments: ChatFileAttachment[];
  currentSessionId: string | null;
  isLoading: boolean;
  isStreaming: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  addAttachment: (attachment: ChatFileAttachment) => void;
  removeAttachment: (fileId: string) => void;
  clearPendingAttachments: () => void;
  resetSession: () => Promise<string | null>;
  stop: () => void;
}

// ============================================================================
// QUERY KEYS
// ============================================================================

const queryKeys = {
  session: (subject: string) => ['chat', 'session', subject] as const,
  history: (sessionId: string) => ['chat', 'history', sessionId] as const,
};

// ============================================================================
// API FUNCTIONS
// ============================================================================

async function fetchOrCreateSession(subject: string): Promise<string> {
  const data = await apiClient.post<{ sessionId: string }>('/api/chat/session', { subject });
  return data.sessionId;
}

async function fetchHistory(
  sessionId: string
): Promise<{ messages: ChatMessage[] }> {
  try {
    return await apiClient.get<{ messages: ChatMessage[] }>(`/api/chat/session/${sessionId}/history`);
  } catch {
    return { messages: [] };
  }
}

// ============================================================================
// SSE STREAMING PARSER
// ============================================================================

async function* parseSSE(response: Response): AsyncIterable<StreamChunk> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split('\n\n');
      buffer = events.pop() ?? '';

      for (const event of events) {
        for (const line of event.split('\n')) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]' || !data) continue;
            try {
              yield JSON.parse(data) as StreamChunk;
            } catch {
              // Ignore malformed JSON
            }
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

// ============================================================================
// HOOK
// ============================================================================

export function useChat({
  initialSessionId,
  subject,
}: UseChatOptions): UseChatReturn {
  const queryClient = useQueryClient();
  const user = useUser();

  // State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pendingAttachments, setPendingAttachments] = useState<
    ChatFileAttachment[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs for stable values
  const sessionIdRef = useRef<string | null>(initialSessionId ?? null);
  const pendingAttachmentsRef = useRef<ChatFileAttachment[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const historySyncedRef = useRef<string | null>(null);

  // Keep refs in sync
  useEffect(() => {
    pendingAttachmentsRef.current = pendingAttachments;
  }, [pendingAttachments]);

  // Session query (lazy creation)
  const sessionQuery = useQuery({
    queryKey: queryKeys.session(subject),
    queryFn: () => fetchOrCreateSession(subject),
    enabled: !initialSessionId && !!subject && !!user,
    staleTime: Infinity,
  });

  // Update sessionIdRef when session is created
  const currentSessionId = initialSessionId ?? sessionQuery.data ?? null;
  useEffect(() => {
    if (currentSessionId) {
      sessionIdRef.current = currentSessionId;
    }
  }, [currentSessionId]);

  // History query
  const historyQuery = useQuery({
    queryKey: queryKeys.history(currentSessionId ?? ''),
    queryFn: () => fetchHistory(currentSessionId ?? ''),
    enabled: !!currentSessionId,
    staleTime: Infinity,
  });

  // Sync history once
  useEffect(() => {
    if (!historyQuery.data) return;
    if (historySyncedRef.current === currentSessionId) return;
    if (historyQuery.data.messages.length === 0) return;

    historySyncedRef.current = currentSessionId;
    setMessages(historyQuery.data.messages);
  }, [historyQuery.data, currentSessionId]);

  // Send message
  const sendMessage = useCallback(
    async (content: string) => {
      if (!user || !subject) return;

      const trimmedContent = content.trim();
      if (!trimmedContent && pendingAttachmentsRef.current.length === 0) return;

      // Capture attachments
      const attachmentsToSend = [...pendingAttachmentsRef.current];
      setPendingAttachments([]);
      pendingAttachmentsRef.current = [];

      // Add user message optimistically
      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: trimmedContent || '📎 Document',
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMessage]);

      // Prepare assistant message placeholder
      const assistantId = `assistant-${Date.now()}`;
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      setIsLoading(true);
      setIsStreaming(true);
      setError(null);

      // Create abort controller
      abortControllerRef.current = new AbortController();

      try {
        const baseUrl = getBaseUrl();

        // SSE streaming requires direct fetch (apiClient doesn't support streaming)
        const response = await fetch(`${baseUrl}/api/chat/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: abortControllerRef.current.signal as RequestInit['signal'],
          body: JSON.stringify({
            content: trimmedContent || '📎 Document',
            data: {
              subject: subject.trim(),
              sessionId: sessionIdRef.current,
              schoolLevel: (user as IAppUser).schoolLevel,
              firstName: (user as IAppUser).name?.split(' ')[0] ?? 'Élève',
              fileIds: attachmentsToSend.map((a) => a.fileId),
            },
          }),
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        // Stream response
        for await (const chunk of parseSSE(response)) {
          if (chunk.type === 'content' && chunk.content) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: chunk.content! } : m
              )
            );
          } else if (chunk.type === 'done') {
            // Update session ID if new session was created
            if (
              chunk.metadata?.sessionId &&
              chunk.metadata.sessionId !== sessionIdRef.current
            ) {
              sessionIdRef.current = chunk.metadata.sessionId;
              queryClient.setQueryData(
                queryKeys.session(subject),
                chunk.metadata.sessionId
              );
            }
          } else if (chunk.type === 'error') {
            setError(chunk.error?.message ?? 'Erreur de streaming');
          }
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') {
          // User cancelled
          return;
        }
        const message =
          err instanceof Error ? err.message : 'Erreur de connexion';
        setError(message);

        // Remove empty assistant message on error
        setMessages((prev) =>
          prev.filter(
            (m) => !(m.id === assistantId && m.content.length === 0)
          )
        );
      } finally {
        setIsLoading(false);
        setIsStreaming(false);
        abortControllerRef.current = null;
      }
    },
    [user, subject, queryClient]
  );

  // Stop streaming
  const stop = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  // Attachment management
  const addAttachment = useCallback((attachment: ChatFileAttachment) => {
    setPendingAttachments((prev) => [...prev, attachment]);
  }, []);

  const removeAttachment = useCallback((fileId: string) => {
    setPendingAttachments((prev) => prev.filter((a) => a.fileId !== fileId));
  }, []);

  const clearPendingAttachments = useCallback(() => {
    setPendingAttachments([]);
  }, []);

  // Reset session
  const resetSession = useCallback(async (): Promise<string | null> => {
    if (!sessionIdRef.current) return null;

    try {
      const data = await apiClient.post<{ sessionId: string }>(
        `/api/chat/session/${sessionIdRef.current}/reset`
      );

      // Update state
      sessionIdRef.current = data.sessionId;
      historySyncedRef.current = null;
      setMessages([]);
      setError(null);

      // Update query cache
      queryClient.setQueryData(queryKeys.session(subject), data.sessionId);
      queryClient.removeQueries({
        queryKey: queryKeys.history(sessionIdRef.current ?? ''),
      });

      return data.sessionId;
    } catch {
      setError('Impossible de réinitialiser la conversation');
      return null;
    }
  }, [subject, queryClient]);

  return {
    messages,
    pendingAttachments,
    currentSessionId,
    isLoading: isLoading || sessionQuery.isLoading,
    isStreaming,
    error: error ?? (sessionQuery.error?.message || null),
    sendMessage,
    addAttachment,
    removeAttachment,
    clearPendingAttachments,
    resetSession,
    stop,
  };
}
