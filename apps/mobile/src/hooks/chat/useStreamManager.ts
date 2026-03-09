/**
 * useStreamManager - SSE streaming logic for chat
 *
 * Extracted from useChat to keep files under 400 lines.
 * Handles EventSource lifecycle, rAF debouncing, timeouts, and abort.
 *
 * @see https://github.com/binaryminds/react-native-sse
 */

import { useCallback, useRef } from 'react';
import { getBaseUrl } from '@repo/api';
import { authClient, type IAppUser } from '@/lib/auth';
import EventSource from 'react-native-sse';

import type {
  ChatMessage,
  ChatFileAttachment,
  CreatedDeck,
  StreamChunk,
} from './types';

/** Inactivity timeout: if no SSE event received for 90s, abort.
 * Tool calls (RAG + Pronote + flashcards) can chain and take 20s+ each,
 * plus server retries on failure. 45s was too aggressive. */
const STREAM_INACTIVITY_TIMEOUT_MS = 90_000;

export interface StreamCallbacks {
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setCreatedDecks: React.Dispatch<React.SetStateAction<CreatedDeck[]>>;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setIsStreaming: React.Dispatch<React.SetStateAction<boolean>>;
  setError: React.Dispatch<React.SetStateAction<string | null>>;
  setStreamStatus: React.Dispatch<React.SetStateAction<string | null>>;
  setPendingAttachments: React.Dispatch<React.SetStateAction<ChatFileAttachment[]>>;
  pendingAttachmentsRef: React.MutableRefObject<ChatFileAttachment[]>;
  pendingClearRef: React.MutableRefObject<ChatFileAttachment[] | null>;
  sessionIdRef: React.MutableRefObject<string | null>;
  onStreamDone: (sessionId: string | null) => void;
  onDeckCreated: () => void;
  onSessionChanged: (sessionId: string) => void;
}

export function useStreamManager(callbacks: StreamCallbacks) {
  const eventSourceRef = useRef<EventSource | null>(null);
  const streamIdRef = useRef(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce: accumulate stream content, flush via rAF
  const streamContentRef = useRef('');
  const streamAssistantIdRef = useRef<string | null>(null);
  const rafIdRef = useRef<ReturnType<typeof requestAnimationFrame> | null>(null);

  const {
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
    onStreamDone,
    onDeckCreated,
    onSessionChanged,
  } = callbacks;

  /** Flush accumulated stream content to state (called via rAF) */
  const flushStreamContent = useCallback(() => {
    rafIdRef.current = null;
    const content = streamContentRef.current;
    const assistantId = streamAssistantIdRef.current;
    if (!assistantId) return;

    setMessages((prev) =>
      prev.map((m) => (m.id === assistantId ? { ...m, content } : m))
    );
  }, [setMessages]);

  /** Abort streaming with error message and clean up */
  const abortStream = useCallback(
    (assistantId: string, errorMessage: string) => {
      if (eventSourceRef.current) {
        eventSourceRef.current.removeAllEventListeners();
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
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
      setStreamStatus(null);
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
    [flushStreamContent, setIsLoading, setIsStreaming, setStreamStatus, setError, setMessages, setPendingAttachments, pendingAttachmentsRef, pendingClearRef]
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

  /** Start an SSE stream for the given message */
  const startStream = useCallback(
    (assistantId: string, content: string, attachments: ChatFileAttachment[], user: IAppUser) => {
      // Reset debounce state
      streamContentRef.current = '';
      streamAssistantIdRef.current = assistantId;
      setCreatedDecks([]);

      setIsLoading(true);
      setIsStreaming(true);
      setError(null);

      // Clean up previous EventSource
      if (eventSourceRef.current) {
        eventSourceRef.current.removeAllEventListeners();
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
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
              schoolLevel: user.schoolLevel,
              firstName: user.name?.split(' ')[0] ?? 'Eleve',
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
            setStreamStatus(null);
            eventSourceRef.current = null;

            // Server confirmed — clear attachments permanently
            pendingClearRef.current = null;

            onStreamDone(sessionIdRef.current);
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
            streamContentRef.current = chunk.content;
            setStreamStatus(null);
            if (!rafIdRef.current) {
              rafIdRef.current = requestAnimationFrame(flushStreamContent);
            }

            if (pendingClearRef.current) {
              pendingClearRef.current = null;
            }
          } else if (chunk.type === 'status') {
            setStreamStatus(chunk.status ?? null);
          } else if (chunk.type === 'deck_created' && chunk.deck) {
            setCreatedDecks(prev => [...prev, chunk.deck!]);
            onDeckCreated();
          } else if (chunk.type === 'done') {
            if (chunk.metadata?.sessionId && chunk.metadata.sessionId !== sessionIdRef.current) {
              sessionIdRef.current = chunk.metadata.sessionId;
              onSessionChanged(chunk.metadata.sessionId);
            }
          } else if (chunk.type === 'error') {
            abortStream(assistantId, chunk.error?.message ?? 'Erreur de streaming');
          }
        });

        es.addEventListener('error', () => {
          if (streamIdRef.current !== currentStreamId) return;
          abortStream(assistantId, 'Erreur de connexion au serveur');
        });

        es.addEventListener('close', () => {
          if (streamIdRef.current !== currentStreamId) return;
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
    [
      abortStream, resetInactivityTimeout, flushStreamContent,
      setCreatedDecks, setIsLoading, setIsStreaming, setError, setStreamStatus,
      sessionIdRef, pendingClearRef, onStreamDone, onDeckCreated, onSessionChanged,
    ]
  );

  /** Stop streaming gracefully */
  const stopStream = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.removeAllEventListeners();
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    flushStreamContent();
    setIsStreaming(false);
    setIsLoading(false);
  }, [flushStreamContent, setIsStreaming, setIsLoading]);

  /** Cleanup (call in useEffect cleanup) */
  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.removeAllEventListeners();
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
  }, []);

  return { startStream, stopStream, cleanup };
}
