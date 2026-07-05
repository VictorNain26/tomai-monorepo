/**
 * useChat Hook - React Native
 *
 * Thin wrapper around `@ai-sdk/react`'s `useChat`: TanStack Query history
 * seeds the initial messages, `sendMessage` attaches the request context
 * (session, school level, Pronote snapshot...), and the server is
 * authoritative on history — only the last `UIMessage` is ever sent
 * (`prepareSendMessagesRequest`).
 *
 * The public surface (`ChatMessage[]` with flat `content`/`attachedFile`) is
 * preserved for the screen and `useOfflineCache` (SQLite), both untouched by
 * this migration — the AI SDK `TomChatMessage[]` (`.parts`) lives entirely
 * inside this hook.
 *
 * `attachedFile` bookkeeping is derived from query/cache data plus a small
 * "sent this session" state map (populated synchronously in the `sendMessage`
 * handler, never in an effect body) — this avoids reading refs during render
 * (`react-hooks/refs`) and avoids syncing external data via `setState` inside
 * an effect (`react-hooks/set-state-in-effect`).
 *
 * @see ./chat/ui-message.ts
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useChat as useAiChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { fetch as expoFetch } from 'expo/fetch';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getBaseUrl } from '@repo/api';
import type { TomChatMessage, TomDataParts } from '@repo/api';
import { useUser, authClient } from '@/lib/auth';
import { usePronoteStore } from '@/stores/pronote-store';

import type {
  ChatMessage,
  ChatFileAttachment,
  AttachedFileInfo,
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
import { toTomChatMessage, extractText, buildPronoteChatContext, parseTransportErrorMessage } from './chat/ui-message';
import { useOfflineCache } from './useOfflineCache';
import { useNetworkStatus } from './useNetworkStatus';

// Re-export types for consumers
export type { ChatMessage, ChatFileAttachment } from './chat/types';

/** Request body context sent alongside the last message (server rebuilds history). */
function buildContextBody(
  currentSessionId: string | null,
  schoolLevel: string | undefined,
  firstName: string,
  fileIds: string[],
) {
  const pronoteState = usePronoteStore.getState();
  const hasData =
    pronoteState.homework.length > 0 ||
    pronoteState.grades.length > 0 ||
    pronoteState.timetable.length > 0;
  const pronoteContext = hasData ? buildPronoteChatContext(pronoteState) : undefined;

  return {
    sessionId: currentSessionId ?? undefined,
    schoolLevel,
    firstName,
    fileIds,
    pronoteContext,
  };
}

function generateMessageId(): string {
  return `user-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function useChat({
  initialSessionId,
}: UseChatOptions = {}): UseChatReturn {
  const queryClient = useQueryClient();
  const user = useUser();
  const { isOnline } = useNetworkStatus();
  const { cacheMessages, getCachedMessages } = useOfflineCache();

  const [pendingAttachments, setPendingAttachments] = useState<ChatFileAttachment[]>([]);
  const [createdDecks, setCreatedDecks] = useState<CreatedDeck[]>([]);
  const [localError, setLocalError] = useState<string | null>(null);

  // Attachments/timestamps for messages sent or cache-loaded this session —
  // only ever written from event handlers or promise callbacks, never from a
  // bare effect body (see file header).
  const [sentAttachedFiles, setSentAttachedFiles] = useState<Record<string, AttachedFileInfo>>({});
  const [cachedMessagesById, setCachedMessagesById] = useState<Record<string, ChatMessage>>({});

  const pendingAttachmentsRef = useRef<ChatFileAttachment[]>([]);
  const lastFileIdsRef = useRef<string[]>([]);
  const syncedSessionIdRef = useRef<string | null>(null);
  const sessionIdRef = useRef<string | null>(initialSessionId ?? null);

  useEffect(() => {
    pendingAttachmentsRef.current = pendingAttachments;
  }, [pendingAttachments]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport<TomChatMessage>({
        api: `${getBaseUrl()}/api/chat/stream`,
        // React Native has no browser cookie jar — the session cookie must be
        // injected manually (same mechanism as the Eden Treaty client, see
        // `src/lib/api.ts`).
        credentials: 'omit',
        headers: (): Record<string, string> => {
          const cookie = authClient.getCookie();
          return cookie ? { Cookie: cookie } : {};
        },
        fetch: expoFetch as unknown as typeof globalThis.fetch,
        prepareSendMessagesRequest: ({ messages, body }) => ({
          body: { message: messages.at(-1), ...body },
        }),
      }),
    [],
  );

  const aiChat = useAiChat<TomChatMessage>({
    transport,
    onData: (dataPart) => {
      if (dataPart.type === 'data-deck-created') {
        const deck = dataPart.data as TomDataParts['deck-created'];
        setCreatedDecks((prev) => [...prev, deck]);
        queryClient.invalidateQueries({ queryKey: ['learning', 'decks'] });
      }
    },
    onFinish: () => {
      queryClient.invalidateQueries({
        queryKey: chatQueryKeys.history(sessionIdRef.current ?? ''),
      });
    },
    onError: (err) => {
      setLocalError(parseTransportErrorMessage(err));
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
    if (syncedSessionIdRef.current === currentSessionId) return;
    if (historyQuery.data) return; // Server data available, no need for cache

    getCachedMessages(currentSessionId).then((cached) => {
      if (cached && cached.length > 0 && aiChat.messages.length === 0) {
        aiChat.setMessages(cached.map(toTomChatMessage));
        setCachedMessagesById(Object.fromEntries(cached.map((m) => [m.id, m])));
      }
    });
  }, [currentSessionId, historyQuery.data, getCachedMessages, aiChat]);

  // Sync server history into the AI SDK chat state once per session.
  useEffect(() => {
    if (!historyQuery.data || !currentSessionId) return;
    if (syncedSessionIdRef.current === currentSessionId) return;
    syncedSessionIdRef.current = currentSessionId;

    if (historyQuery.data.messages.length > 0) {
      aiChat.setMessages(historyQuery.data.messages.map(toTomChatMessage));
    }
    cacheMessages(currentSessionId, historyQuery.data.messages);
  }, [historyQuery.data, currentSessionId, cacheMessages, aiChat]);

  const orphanError = historyQuery.data?.hasOrphanMessage
    ? 'La réponse précédente a été interrompue. Appuie sur Réessayer.'
    : null;

  // History (server-authoritative) takes precedence over the offline cache,
  // which in turn takes precedence over nothing — merged with a `useMemo` so
  // this never needs a ref/effect round-trip.
  const attachedFileByMessageId = useMemo(() => {
    const map: Record<string, AttachedFileInfo> = {};
    for (const m of Object.values(cachedMessagesById)) {
      if (m.attachedFile) map[m.id] = m.attachedFile;
    }
    for (const m of historyQuery.data?.messages ?? []) {
      if (m.attachedFile) map[m.id] = m.attachedFile;
    }
    return { ...map, ...sentAttachedFiles };
  }, [cachedMessagesById, historyQuery.data, sentAttachedFiles]);

  const timestampByMessageId = useMemo(() => {
    const map: Record<string, string> = {};
    for (const [id, m] of Object.entries(cachedMessagesById)) map[id] = m.timestamp;
    for (const m of historyQuery.data?.messages ?? []) map[m.id] = m.timestamp;
    return map;
  }, [cachedMessagesById, historyQuery.data]);

  const sendMessage = useCallback(
    (content: string) => {
      const trimmed = content.trim();
      const attachments = pendingAttachmentsRef.current;
      if (!trimmed && attachments.length === 0) return;
      if (!user) return;

      if (!authClient.getCookie()) {
        setLocalError('Session expirée — reconnecte-toi.');
        return;
      }

      const fileIds = attachments.map((a) => a.fileId);
      lastFileIdsRef.current = fileIds;

      const messageId = generateMessageId();
      if (attachments[0]) {
        const [first] = attachments;
        setSentAttachedFiles((prev) => ({
          ...prev,
          [messageId]: {
            fileName: first.fileName,
            fileId: first.fileId,
            mimeType: first.mimeType,
            preview: first.preview,
          },
        }));
      }

      setLocalError(null);
      setCreatedDecks([]);
      if (attachments.length > 0) {
        setPendingAttachments([]);
      }

      void aiChat.sendMessage(
        {
          id: messageId,
          role: 'user',
          parts: [{ type: 'text', text: trimmed || 'Document' }],
        },
        {
          body: buildContextBody(
            sessionIdRef.current,
            user.schoolLevel,
            user.name?.split(' ')[0] ?? 'Eleve',
            fileIds,
          ),
        },
      );
    },
    [user, aiChat],
  );

  const retry = useCallback(() => {
    if (!user) return;
    setLocalError(null);
    void aiChat.regenerate({
      body: buildContextBody(
        sessionIdRef.current,
        user.schoolLevel,
        user.name?.split(' ')[0] ?? 'Eleve',
        lastFileIdsRef.current,
      ),
    });
  }, [user, aiChat]);

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

  const resetSession = useCallback(async (): Promise<string | null> => {
    if (!sessionIdRef.current) return null;

    try {
      const data = await resetChatSession(sessionIdRef.current);
      queryClient.removeQueries({ queryKey: chatQueryKeys.history(sessionIdRef.current) });
      sessionIdRef.current = data.sessionId;
      syncedSessionIdRef.current = null;
      lastFileIdsRef.current = [];
      setSentAttachedFiles({});
      setCachedMessagesById({});
      aiChat.setMessages([]);
      aiChat.clearError();
      setLocalError(null);

      queryClient.setQueryData(chatQueryKeys.session(), data.sessionId);

      return data.sessionId;
    } catch {
      setLocalError('Impossible de réinitialiser la conversation');
      return null;
    }
  }, [queryClient, aiChat]);

  // Derive the flat `ChatMessage[]` surface from the AI SDK's `TomChatMessage[]`.
  const messages = useMemo<ChatMessage[]>(
    () =>
      aiChat.messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: extractText(m.parts),
          timestamp: timestampByMessageId[m.id] ?? new Date().toISOString(),
          attachedFile: attachedFileByMessageId[m.id] ?? null,
        })),
    [aiChat.messages, timestampByMessageId, attachedFileByMessageId],
  );

  const isStreaming = aiChat.status === 'streaming';
  const isLoading = aiChat.status === 'submitted' || isStreaming || sessionQuery.isLoading;
  const transportError = aiChat.error ? parseTransportErrorMessage(aiChat.error) : null;

  return {
    messages,
    pendingAttachments,
    createdDecks,
    currentSessionId,
    isLoading,
    isStreaming,
    isOnline,
    streamStatus: null,
    error:
      localError ??
      transportError ??
      orphanError ??
      historyQuery.error?.message ??
      sessionQuery.error?.message ??
      null,
    sendMessage,
    retry,
    addAttachment,
    removeAttachment,
    clearPendingAttachments,
    clearCreatedDecks,
    resetSession,
    stop: aiChat.stop,
  };
}
