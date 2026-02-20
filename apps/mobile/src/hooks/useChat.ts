/**
 * useChat Hook - React Native
 *
 * SSE streaming hook with error-first design.
 * No silent fallbacks: every failure is surfaced to the user.
 *
 * Performance: streaming updates are batched via requestAnimationFrame
 * to avoid per-token re-renders (500 → ~30-40 per response).
 *
 * Resilience: retry mechanism preserves last request on failure.
 * Attachments/text are only cleared after server confirms receipt.
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
  const [pendingAttachments, setPendingAttachments] = useState<ChatFileAttachment[]>([]);
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

  // Debounce: accumulate stream content, flush via rAF
  const streamContentRef = useRef('');
  const streamAssistantIdRef = useRef<string | null>(null);
  const rafIdRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);

  // Retry: store last request for replay on failure
  const lastRequestRef = useRef<{ content: string; attachments: ChatFileAttachment[] } | null>(null);

  // Attachment clearing: defer until server confirms receipt
  const pendingClearRef = useRef<ChatFileAttachment[] | null>(null);

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

  const currentSessionId = initialSessionId ?? sessionQuery.data ?? null;
  useEffect(() => {
    if (currentSessionId) sessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  // History query
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      eventSourceRef.current?.close();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
    };
  }, []);

  /** Flush accumulated stream content to state (called via rAF) */
  const flushStreamContent = useCallback(() => {
    rafIdRef.current = null;
    const content = streamContentRef.current;
    const assistantId = streamAssistantIdRef.current;
    if (!assistantId) return;

    setMessages((prev) =>
      prev.map((m) => (m.id === assistantId ? { ...m, content } : m))
    );
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
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }

      // Flush any pending content before showing error
      if (streamContentRef.current && streamAssistantIdRef.current === assistantId) {
        flushStreamContent();
      }

      setIsLoading(false);
      setIsStreaming(false);
      setError(errorMessage);

      // Remove empty assistant placeholder (keeps partial content)
      setMessages((prev) =>
        prev.filter((m) => !(m.id === assistantId && m.content.length === 0))
      );

      // Restore attachments if server never confirmed
      if (pendingClearRef.current) {
        setPendingAttachments(pendingClearRef.current);
        pendingAttachmentsRef.current = pendingClearRef.current;
        pendingClearRef.current = null;
      }
    },
    [flushStreamContent]
  );

  /** Reset the inactivity timeout */
  const resetInactivityTimeout = useCallback(
    (assistantId: string) => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        abortStream(assistantId, 'Le serveur ne répond plus. Réessaie.');
      }, STREAM_INACTIVITY_TIMEOUT_MS);
    },
    [abortStream]
  );

  /** Core send logic (used by sendMessage and retry) */
  const executeSend = useCallback(
    async (content: string, attachments: ChatFileAttachment[], addUserMessage: boolean) => {
      if (!user) return;

      // Store for retry
      lastRequestRef.current = { content, attachments };

      // Defer attachment clearing until server confirms
      if (attachments.length > 0) {
        pendingClearRef.current = attachments;
        setPendingAttachments([]);
        pendingAttachmentsRef.current = [];
      }

      // Add user message optimistically (skip on retry — already in list)
      if (addUserMessage) {
        const userMessage: ChatMessage = {
          id: generateMessageId('user'),
          role: 'user',
          content: content || 'Document',
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, userMessage]);
      }

      // Prepare assistant placeholder
      const assistantId = generateMessageId('assistant');
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Reset debounce state
      streamContentRef.current = '';
      streamAssistantIdRef.current = assistantId;

      setIsLoading(true);
      setIsStreaming(true);
      setError(null);

      eventSourceRef.current?.close();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      const currentStreamId = ++streamIdRef.current;

      try {
        const baseUrl = getBaseUrl();
        const cookie = authClient.getCookie();

        if (!cookie) {
          abortStream(assistantId, 'Session expirée — reconnecte-toi.');
          return;
        }

        const es = new EventSource(`${baseUrl}/api/chat/stream`, {
          headers: {
            'Content-Type': 'application/json',
            Cookie: cookie,
          },
          method: 'POST',
          body: JSON.stringify({
            content: content || 'Document',
            data: {
              sessionId: sessionIdRef.current,
              schoolLevel: (user as IAppUser).schoolLevel,
              firstName: (user as IAppUser).name?.split(' ')[0] ?? 'Eleve',
              fileIds: attachments.map((a) => a.fileId),
            },
          }),
          pollingInterval: 0,
        });

        eventSourceRef.current = es;
        resetInactivityTimeout(assistantId);

        es.addEventListener('message', (event) => {
          if (!event.data) return;
          if (streamIdRef.current !== currentStreamId) return;

          resetInactivityTimeout(assistantId);

          if (event.data === '[DONE]') {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
            timeoutRef.current = null;

            // Final flush
            if (rafIdRef.current) {
              cancelAnimationFrame(rafIdRef.current);
              rafIdRef.current = null;
            }
            flushStreamContent();

            es.close();
            setIsLoading(false);
            setIsStreaming(false);
            eventSourceRef.current = null;

            // Server confirmed — clear attachments permanently
            pendingClearRef.current = null;
            return;
          }

          let chunk: StreamChunk;
          try {
            chunk = JSON.parse(event.data) as StreamChunk;
          } catch {
            console.error('[SSE] Malformed JSON:', event.data);
            return;
          }

          if (chunk.type === 'content' && chunk.content) {
            // Debounce: accumulate in ref, schedule rAF flush
            streamContentRef.current = chunk.content;
            if (!rafIdRef.current) {
              rafIdRef.current = requestAnimationFrame(flushStreamContent);
            }

            // First content = server confirmed receipt → clear attachments
            if (pendingClearRef.current) {
              pendingClearRef.current = null;
            }
          } else if (chunk.type === 'status') {
            // Heartbeat during tool calls — timeout already reset above
          } else if (chunk.type === 'done') {
            if (chunk.metadata?.sessionId && chunk.metadata.sessionId !== sessionIdRef.current) {
              sessionIdRef.current = chunk.metadata.sessionId;
              queryClient.setQueryData(chatQueryKeys.session(), chunk.metadata.sessionId);
            }
          } else if (chunk.type === 'error') {
            setError(chunk.error?.message ?? 'Erreur de streaming');
          }
        });

        es.addEventListener('error', () => {
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
        const message = err instanceof Error ? err.message : 'Erreur de connexion';
        abortStream(assistantId, message);
      }
    },
    [user, queryClient, abortStream, resetInactivityTimeout, flushStreamContent]
  );

  // Public sendMessage
  const sendMessage = useCallback(
    async (content: string) => {
      const trimmed = content.trim();
      if (!trimmed && pendingAttachmentsRef.current.length === 0) return;
      await executeSend(trimmed, [...pendingAttachmentsRef.current], true);
    },
    [executeSend]
  );

  // Retry last failed message
  const retry = useCallback(async () => {
    const last = lastRequestRef.current;
    if (!last) return;

    // Remove the failed assistant message (last in list)
    setMessages((prev) => {
      const lastMsg = prev[prev.length - 1];
      if (lastMsg?.role === 'assistant') return prev.slice(0, -1);
      return prev;
    });

    setError(null);
    // Re-send without adding user message (already visible)
    await executeSend(last.content, last.attachments, false);
  }, [executeSend]);

  // Stop streaming
  const stop = useCallback(() => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    // Flush any pending content
    flushStreamContent();
    setIsStreaming(false);
    setIsLoading(false);
  }, [flushStreamContent]);

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
      lastRequestRef.current = null;
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
    retry,
    addAttachment,
    removeAttachment,
    clearPendingAttachments,
    resetSession,
    stop,
  };
}
