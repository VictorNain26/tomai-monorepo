/**
 * useChat Hook - React Native
 *
 * SSE streaming hook with error-first design.
 * No silent fallbacks: every failure is surfaced to the user.
 *
 * Stream logic extracted to useStreamManager for maintainability.
 *
 * @see ./chat/useStreamManager.ts
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUser, type IAppUser } from '@/lib/auth';

import type {
  ChatMessage,
  ChatFileAttachment,
  CreatedDeck,
  UseChatOptions,
  UseChatReturn,
} from './chat/types';
import {
  chatQueryKeys,
  fetchOrCreateSession,
  fetchHistory,
  resetChatSession,
} from './chat/api';
import { useStreamManager } from './chat/useStreamManager';

// Re-export types for consumers
export type { ChatMessage, ChatFileAttachment, AttachedFileInfo, CreatedDeck } from './chat/types';

/** Generate a unique message ID using crypto for collision safety */
function generateMessageId(role: 'user' | 'assistant'): string {
  return `${role}-${Date.now()}-${crypto.randomUUID()}`;
}

export function useChat({
  initialSessionId,
}: UseChatOptions = {}): UseChatReturn {
  const queryClient = useQueryClient();
  const user = useUser();

  // State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pendingAttachments, setPendingAttachments] = useState<ChatFileAttachment[]>([]);
  const [createdDecks, setCreatedDecks] = useState<CreatedDeck[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs for stable values
  const sessionIdRef = useRef<string | null>(initialSessionId ?? null);
  const pendingAttachmentsRef = useRef<ChatFileAttachment[]>([]);
  const historySyncedRef = useRef<string | null>(null);

  // Retry: store last request for replay on failure
  const lastRequestRef = useRef<{ content: string; attachments: ChatFileAttachment[] } | null>(null);

  // Attachment clearing: defer until server confirms receipt
  const pendingClearRef = useRef<ChatFileAttachment[] | null>(null);

  // Keep refs in sync
  useEffect(() => {
    pendingAttachmentsRef.current = pendingAttachments;
  }, [pendingAttachments]);

  // Stream manager (SSE logic extracted)
  const { startStream, stopStream, cleanup } = useStreamManager({
    setMessages,
    setCreatedDecks,
    setIsLoading,
    setIsStreaming,
    setError,
    setPendingAttachments,
    pendingAttachmentsRef,
    pendingClearRef,
    sessionIdRef,
    onStreamDone: (currentSessionId) => {
      queryClient.invalidateQueries({
        queryKey: chatQueryKeys.history(currentSessionId ?? ''),
      });
    },
    onDeckCreated: () => {
      queryClient.invalidateQueries({ queryKey: ['decks'] });
    },
    onSessionChanged: (newSessionId) => {
      queryClient.setQueryData(chatQueryKeys.session(), newSessionId);
    },
  });

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
  });

  // Sync history into local state (one-time per session)
  // Note: setState in effect is intentional — history is fetched once per session
  // and merged into local messages state which is then mutated by streaming.
  useEffect(() => {
    if (!historyQuery.data) return;
    if (historySyncedRef.current === currentSessionId) return;
    if (historyQuery.data.messages.length === 0) return;

    historySyncedRef.current = currentSessionId;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: one-time sync of server history into local streaming state
    setMessages(historyQuery.data.messages);
  }, [historyQuery.data, currentSessionId]);

  // Cleanup on unmount
  useEffect(() => cleanup, [cleanup]);

  /** Core send logic (used by sendMessage and retry) */
  const executeSend = useCallback(
    (content: string, attachments: ChatFileAttachment[], addUserMessage: boolean) => {
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
          attachedFile: attachments.length > 0 ? {
            fileName: attachments[0].fileName,
            fileId: attachments[0].fileId,
            mimeType: attachments[0].mimeType,
            preview: attachments[0].preview,
          } : undefined,
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

      // Start SSE stream
      startStream(assistantId, content, attachments, user as IAppUser);
    },
    [user, startStream]
  );

  // Public sendMessage
  const sendMessage = useCallback(
    (content: string) => {
      const trimmed = content.trim();
      if (!trimmed && pendingAttachmentsRef.current.length === 0) return;
      executeSend(trimmed, [...pendingAttachmentsRef.current], true);
    },
    [executeSend]
  );

  // Retry last failed message
  const retry = useCallback(() => {
    const last = lastRequestRef.current;
    if (!last) return;

    // Remove the failed assistant message (last in list)
    setMessages((prev) => {
      const lastMsg = prev[prev.length - 1];
      if (lastMsg?.role === 'assistant') return prev.slice(0, -1);
      return prev;
    });

    setError(null);
    executeSend(last.content, last.attachments, false);
  }, [executeSend]);

  // Stop streaming
  const stop = useCallback(() => {
    stopStream();
  }, [stopStream]);

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

  const clearCreatedDecks = useCallback(() => {
    setCreatedDecks([]);
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
    createdDecks,
    currentSessionId,
    isLoading: isLoading || sessionQuery.isLoading,
    isStreaming,
    error: error ?? historyQuery.error?.message ?? sessionQuery.error?.message ?? null,
    sendMessage,
    retry,
    addAttachment,
    removeAttachment,
    clearPendingAttachments,
    clearCreatedDecks,
    resetSession,
    stop,
  };
}
