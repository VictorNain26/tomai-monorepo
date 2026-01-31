/**
 * useChat Hook - React Native
 *
 * Port du hook web adapté à React Native.
 * Gère les sessions, le streaming SSE, et les attachments.
 *
 * Best Practice 2026: Uses react-native-sse for native EventSource support.
 * @see https://github.com/binaryminds/react-native-sse
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getBaseUrl } from '@repo/api';
import { useUser, type IAppUser } from '@/lib/auth';
import EventSource from 'react-native-sse';

import type {
  ChatMessage,
  ChatFileAttachment,
  StreamChunk,
  UseChatOptions,
  UseChatReturn,
} from './chat/types';
import {
  chatQueryKeys,
  fetchOrCreateSession,
  fetchHistory,
  resetChatSession,
} from './chat/api';

// Re-export types for consumers
export type { ChatMessage, ChatFileAttachment, AttachedFileInfo } from './chat/types';

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
  const eventSourceRef = useRef<EventSource | null>(null);
  const historySyncedRef = useRef<string | null>(null);

  // Keep refs in sync
  useEffect(() => {
    pendingAttachmentsRef.current = pendingAttachments;
  }, [pendingAttachments]);

  // Session query (lazy creation)
  const sessionQuery = useQuery({
    queryKey: chatQueryKeys.session(subject),
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
    queryKey: chatQueryKeys.history(currentSessionId ?? ''),
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

  // Cleanup EventSource on unmount
  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
    };
  }, []);

  // Send message using react-native-sse
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

      // Close previous EventSource if any
      eventSourceRef.current?.close();

      try {
        const baseUrl = getBaseUrl();

        // Use react-native-sse for native EventSource support
        const es = new EventSource(`${baseUrl}/api/chat/stream`, {
          headers: {
            'Content-Type': 'application/json',
          },
          method: 'POST',
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
          // Disable auto-reconnect for one-shot streaming
          pollingInterval: 0,
        });

        eventSourceRef.current = es;

        es.addEventListener('message', (event) => {
          if (!event.data) return;

          if (event.data === '[DONE]') {
            es.close();
            setIsLoading(false);
            setIsStreaming(false);
            eventSourceRef.current = null;
            return;
          }

          try {
            const chunk = JSON.parse(event.data) as StreamChunk;

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
                  chatQueryKeys.session(subject),
                  chunk.metadata.sessionId
                );
              }
            } else if (chunk.type === 'error') {
              setError(chunk.error?.message ?? 'Erreur de streaming');
            }
          } catch {
            // Ignore malformed JSON
          }
        });

        es.addEventListener('error', (event) => {
          console.error('[SSE] Error:', event);
          es.close();
          eventSourceRef.current = null;
          setIsLoading(false);
          setIsStreaming(false);

          // Remove empty assistant message on error
          setMessages((prev) =>
            prev.filter(
              (m) => !(m.id === assistantId && m.content.length === 0)
            )
          );

          setError('Erreur de connexion au serveur');
        });

        es.addEventListener('close', () => {
          setIsLoading(false);
          setIsStreaming(false);
          eventSourceRef.current = null;
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Erreur de connexion';
        setError(message);

        // Remove empty assistant message on error
        setMessages((prev) =>
          prev.filter(
            (m) => !(m.id === assistantId && m.content.length === 0)
          )
        );

        setIsLoading(false);
        setIsStreaming(false);
      }
    },
    [user, subject, queryClient]
  );

  // Stop streaming
  const stop = useCallback(() => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    setIsStreaming(false);
    setIsLoading(false);
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
      const data = await resetChatSession(sessionIdRef.current);

      // Update state
      sessionIdRef.current = data.sessionId;
      historySyncedRef.current = null;
      setMessages([]);
      setError(null);

      // Update query cache
      queryClient.setQueryData(chatQueryKeys.session(subject), data.sessionId);
      queryClient.removeQueries({
        queryKey: chatQueryKeys.history(sessionIdRef.current ?? ''),
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
