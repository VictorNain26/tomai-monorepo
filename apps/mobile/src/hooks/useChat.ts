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
import { useOfflineCache } from './useOfflineCache';
import { useNetworkStatus } from './useNetworkStatus';

// Re-export types for consumers
export type { ChatMessage, ChatFileAttachment, AttachedFileInfo, CreatedDeck } from './chat/types';

/** Generate a unique message ID (Hermes-safe, no crypto global) */
function generateMessageId(role: 'user' | 'assistant'): string {
  const hex = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, '0');
  return `${role}-${Date.now()}-${hex()}${hex()}-${hex()}`;
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
  const [streamStatus, setStreamStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Refs for stable values
  const sessionIdRef = useRef<string | null>(initialSessionId ?? null);
  const pendingAttachmentsRef = useRef<ChatFileAttachment[]>([]);

  // Track which session has been synced (state for render-time conditional, not ref)
  const [syncedSessionId, setSyncedSessionId] = useState<string | null>(null);

  // Retry: store last request for replay on failure
  const lastRequestRef = useRef<{ content: string; attachments: ChatFileAttachment[] } | null>(null);

  // Attachment clearing: defer until server confirms receipt
  const pendingClearRef = useRef<ChatFileAttachment[] | null>(null);

  // Offline support
  const { isOnline } = useNetworkStatus();
  const { cacheMessages, getCachedMessages } = useOfflineCache();

  // Keep ref in sync with state for use in callbacks
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
    setStreamStatus,
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
      queryClient.invalidateQueries({ queryKey: ['learning', 'decks'] });
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

  // Load cached messages while waiting for server (offline-first)
  useEffect(() => {
    if (!currentSessionId) return;
    if (syncedSessionId === currentSessionId) return;
    if (historyQuery.data) return; // Server data available, no need for cache

    getCachedMessages(currentSessionId).then(cached => {
      if (cached && cached.length > 0) {
        setMessages(prev => prev.length === 0 ? cached : prev);
      }
    });
  }, [currentSessionId, syncedSessionId, historyQuery.data, getCachedMessages]);

  // React 19 "storing information from previous renders" pattern:
  // Sync server history into local state during render (not in useEffect).
  // This avoids the set-state-in-effect anti-pattern while ensuring
  // messages are available on the first render after data arrives.
  if (
    historyQuery.data &&
    syncedSessionId !== currentSessionId &&
    currentSessionId
  ) {
    setSyncedSessionId(currentSessionId);
    if (historyQuery.data.messages.length > 0) {
      setMessages(historyQuery.data.messages);
      if (historyQuery.data.hasOrphanMessage) {
        setError('La réponse précédente a été interrompue. Appuie sur Réessayer.');
      }
    }
  }

  // Side effects after history sync (SQLite caching, retry ref update)
  useEffect(() => {
    if (!syncedSessionId || !historyQuery.data) return;

    cacheMessages(syncedSessionId, historyQuery.data.messages);

    if (historyQuery.data.hasOrphanMessage) {
      const lastMsg = historyQuery.data.messages.at(-1);
      if (lastMsg) {
        lastRequestRef.current = { content: lastMsg.content, attachments: [] };
      }
    }
  }, [syncedSessionId, historyQuery.data, cacheMessages]);

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

  // Stop streaming (stopStream is already stable via useCallback in useStreamManager)
  const stop = stopStream;

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
      setSyncedSessionId(null);
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
    isOnline,
    streamStatus,
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
