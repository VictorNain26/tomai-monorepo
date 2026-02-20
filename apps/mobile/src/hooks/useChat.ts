/**
 * useChat Hook - React Native
 *
 * SSE streaming hook with error-first design.
 * No silent fallbacks: every failure is surfaced to the user.
 *
 * @see https://github.com/binaryminds/react-native-sse
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getBaseUrl } from '@repo/api';
import { authClient, useUser, type IAppUser } from '@/lib/auth';
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

/** Inactivity timeout: if no SSE event received for 45s, abort */
const STREAM_INACTIVITY_TIMEOUT_MS = 45_000;

/** Generate a unique message ID (no collision risk) */
let messageCounter = 0;
function generateMessageId(role: 'user' | 'assistant'): string {
  return `${role}-${Date.now()}-${++messageCounter}`;
}

export function useChat({
  initialSessionId,
}: UseChatOptions = {}): UseChatReturn {
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
  const streamIdRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep refs in sync
  useEffect(() => {
    pendingAttachmentsRef.current = pendingAttachments;
  }, [pendingAttachments]);

  // Session query (lazy creation)
  const sessionQuery = useQuery({
    queryKey: chatQueryKeys.session(),
    queryFn: () => fetchOrCreateSession(),
    enabled: !initialSessionId && !!user,
    staleTime: Infinity,
  });

  // Update sessionIdRef when session is created
  const currentSessionId = initialSessionId ?? sessionQuery.data ?? null;
  useEffect(() => {
    if (currentSessionId) {
      sessionIdRef.current = currentSessionId;
    }
  }, [currentSessionId]);

  // History query (errors propagated via TanStack Query, not swallowed)
  const historyQuery = useQuery({
    queryKey: chatQueryKeys.history(currentSessionId ?? '__none__'),
    queryFn: () => fetchHistory(currentSessionId!),
    enabled: !!currentSessionId,
    staleTime: Infinity,
  });

  // Sync history once
  useEffect(() => {
    if (!historyQuery.data) return;
    if (historySyncedRef.current === currentSessionId) return;
    if (historyQuery.data.messages.length === 0) return;

    historySyncedRef.current = currentSessionId;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMessages(historyQuery.data.messages);
  }, [historyQuery.data, currentSessionId]);

  // Cleanup EventSource + timeout on unmount
  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  /** Abort streaming with error message and clean up */
  const abortStream = useCallback(
    (assistantId: string, errorMessage: string) => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      setIsLoading(false);
      setIsStreaming(false);
      setError(errorMessage);

      // Remove empty assistant message placeholder
      setMessages((prev) =>
        prev.filter(
          (m) => !(m.id === assistantId && m.content.length === 0)
        )
      );
    },
    []
  );

  /** Reset the inactivity timeout (called on each SSE event) */
  const resetInactivityTimeout = useCallback(
    (assistantId: string) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        abortStream(
          assistantId,
          'Le serveur ne répond plus. Vérifie ta connexion et réessaie.'
        );
      }, STREAM_INACTIVITY_TIMEOUT_MS);
    },
    [abortStream]
  );

  // Send message using react-native-sse
  const sendMessage = useCallback(
    async (content: string) => {
      if (!user) return;

      const trimmedContent = content.trim();
      if (!trimmedContent && pendingAttachmentsRef.current.length === 0) return;

      // Capture attachments
      const attachmentsToSend = [...pendingAttachmentsRef.current];
      setPendingAttachments([]);
      pendingAttachmentsRef.current = [];

      // Add user message optimistically
      const userMessage: ChatMessage = {
        id: generateMessageId('user'),
        role: 'user',
        content: trimmedContent || 'Document',
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, userMessage]);

      // Prepare assistant message placeholder
      const assistantId = generateMessageId('assistant');
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
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      // Track stream ID to detect stale callbacks
      const currentStreamId = ++streamIdRef.current;

      try {
        const baseUrl = getBaseUrl();
        const cookie = authClient.getCookie();

        const es = new EventSource(`${baseUrl}/api/chat/stream`, {
          headers: {
            'Content-Type': 'application/json',
            ...(cookie ? { Cookie: cookie } : {}),
          },
          method: 'POST',
          body: JSON.stringify({
            content: trimmedContent || 'Document',
            data: {
              sessionId: sessionIdRef.current,
              schoolLevel: (user as IAppUser).schoolLevel,
              firstName: (user as IAppUser).name?.split(' ')[0] ?? 'Eleve',
              fileIds: attachmentsToSend.map((a) => a.fileId),
            },
          }),
          pollingInterval: 0,
        });

        eventSourceRef.current = es;

        // Start inactivity timeout
        resetInactivityTimeout(assistantId);

        es.addEventListener('message', (event) => {
          if (!event.data) return;
          if (streamIdRef.current !== currentStreamId) return;

          // Reset timeout on every received event
          resetInactivityTimeout(assistantId);

          if (event.data === '[DONE]') {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
            es.close();
            setIsLoading(false);
            setIsStreaming(false);
            eventSourceRef.current = null;
            return;
          }

          let chunk: StreamChunk;
          try {
            chunk = JSON.parse(event.data) as StreamChunk;
          } catch (parseError) {
            console.error('[SSE] Malformed JSON:', event.data, parseError);
            setError('Erreur de communication avec le serveur');
            return;
          }

          if (chunk.type === 'content' && chunk.content) {
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId ? { ...m, content: chunk.content! } : m
              )
            );
          } else if (chunk.type === 'done') {
            if (
              chunk.metadata?.sessionId &&
              chunk.metadata.sessionId !== sessionIdRef.current
            ) {
              sessionIdRef.current = chunk.metadata.sessionId;
              queryClient.setQueryData(
                chatQueryKeys.session(),
                chunk.metadata.sessionId
              );
            }
          } else if (chunk.type === 'error') {
            setError(chunk.error?.message ?? 'Erreur de streaming');
          }
        });

        es.addEventListener('error', (event) => {
          console.error('[SSE] Error:', event);
          abortStream(assistantId, 'Erreur de connexion au serveur');
        });

        es.addEventListener('close', () => {
          if (timeoutRef.current) clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
          setIsLoading(false);
          setIsStreaming(false);
          eventSourceRef.current = null;
        });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Erreur de connexion';
        abortStream(assistantId, message);
      }
    },
    [user, queryClient, abortStream, resetInactivityTimeout]
  );

  // Stop streaming
  const stop = useCallback(() => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
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

      sessionIdRef.current = data.sessionId;
      historySyncedRef.current = null;
      setMessages([]);
      setError(null);

      queryClient.setQueryData(chatQueryKeys.session(), data.sessionId);
      queryClient.removeQueries({
        queryKey: chatQueryKeys.history(sessionIdRef.current ?? ''),
      });

      return data.sessionId;
    } catch {
      setError('Impossible de reinitialiser la conversation');
      return null;
    }
  }, [queryClient]);

  return {
    messages,
    pendingAttachments,
    currentSessionId,
    isLoading: isLoading || sessionQuery.isLoading,
    isStreaming,
    error: error ?? historyQuery.error?.message ?? sessionQuery.error?.message ?? null,
    sendMessage,
    addAttachment,
    removeAttachment,
    clearPendingAttachments,
    resetSession,
    stop,
  };
}
