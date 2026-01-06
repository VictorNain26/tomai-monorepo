/**
 * useChat - Optimized Chat Hook (Gemini 2.5 Flash)
 *
 * Architecture propre:
 * - sessionId géré internement (fetch/create automatique)
 * - Retourne currentSessionId pour que le parent mette à jour l'URL
 * - Pas de callbacks = pas de boucles infinies
 * - SSE streaming avec @google/genai
 */

import { useCallback, useRef, useEffect, useState } from 'react';
import { useChat as useTanStackChat, stream, type UIMessage } from '@tanstack/ai-react';
import type { StreamChunk, ModelMessage } from '@tanstack/ai';
import { useUser } from '@/lib/auth';
import { useQueryClient } from '@tanstack/react-query';
import { invalidationHelpers } from '@/lib/query-factories';
import { getBackendURL } from '@/utils/urls';
import { logger } from '@/lib/logger';
import type { IChatFileAttachment } from '@/types';

// ============================================================================
// Types
// ============================================================================

interface UseChatOptions {
  /** SessionId from URL (can be null for new sessions) */
  initialSessionId: string | null;
  subject: string;
}

interface UseChatReturn {
  messages: UIMessage[];
  sessionFiles: IChatFileAttachment[];
  /** Current session ID (may differ from initialSessionId after creation) */
  currentSessionId: string | null;
  isLoading: boolean;
  error: string | null;
  sendMessage: (content: string, attachments?: IChatFileAttachment[]) => Promise<void>;
  stop: () => void;
}

/** TanStack AI Protocol - Custom data sent with each request */
interface ChatRequestData {
  subject: string;
  sessionId?: string;
  schoolLevel?: string;
  firstName?: string;
  fileIds?: string[];
}

// ============================================================================
// SSE Parser
// ============================================================================

async function* parseServerSentEvents(response: Response): AsyncIterable<StreamChunk> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

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
            if (data === '[DONE]') continue;
            if (!data) continue;

            try {
              yield JSON.parse(data) as StreamChunk;
            } catch {
              // Ignore malformed JSON
            }
          }
        }
      }
    }

    if (buffer.trim()) {
      for (const line of buffer.split('\n')) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data && data !== '[DONE]') {
            try {
              yield JSON.parse(data) as StreamChunk;
            } catch {
              // Ignore
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
// useChat Hook
// ============================================================================

export function useChat({ initialSessionId, subject }: UseChatOptions): UseChatReturn {
  const user = useUser();
  const queryClient = useQueryClient();

  // State for current session (can change after creation)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(initialSessionId);
  const [sessionFiles, setSessionFiles] = useState<IChatFileAttachment[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  // Refs for stream adapter closure (not reactive)
  const fileIdsRef = useRef<string[]>([]);
  const sessionIdRef = useRef<string | null>(initialSessionId);

  // Sync ref when state changes
  useEffect(() => {
    sessionIdRef.current = currentSessionId;
  }, [currentSessionId]);

  // Sync state when prop changes (navigation)
  useEffect(() => {
    if (initialSessionId !== currentSessionId) {
      setCurrentSessionId(initialSessionId);
      setHistoryLoaded(false); // Reset pour recharger l'historique
    }
  }, [initialSessionId, currentSessionId]);

  // ============================================================================
  // Stream adapter
  // ============================================================================
  const connection = stream(async function* (
    messages: ModelMessage[],
    _connectionData?: Record<string, unknown>
  ): AsyncIterable<StreamChunk> {
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    const content = lastUserMessage?.content ?? '';

    const data: ChatRequestData = {
      subject: subject.trim(),
    };

    if (sessionIdRef.current) {
      data.sessionId = sessionIdRef.current;
    }

    if (user?.schoolLevel) {
      data.schoolLevel = user.schoolLevel as string;
    }

    if (user?.firstName) {
      data.firstName = user.firstName as string;
    }

    if (fileIdsRef.current.length > 0) {
      data.fileIds = [...fileIdsRef.current];
      fileIdsRef.current = [];
    }

    logger.info('Chat request', { contentLength: content.length, data });

    const response = await fetch(`${getBackendURL()}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, data }),
      credentials: 'include',
    });

    if (!response.ok) {
      let errorMessage = `HTTP ${response.status}`;
      try {
        const errorBody = (await response.json()) as { message?: string };
        if (errorBody.message) errorMessage = errorBody.message;
      } catch {
        // Use default
      }
      throw new Error(errorMessage);
    }

    for await (const chunk of parseServerSentEvents(response)) {
      // Capture sessionId from 'done' chunk
      if (chunk.type === 'done') {
        const doneChunk = chunk as { type: 'done'; metadata?: { sessionId?: string } };
        if (doneChunk.metadata?.sessionId && doneChunk.metadata.sessionId !== sessionIdRef.current) {
          const newSessionId = doneChunk.metadata.sessionId;
          logger.info('New session from backend', { newSessionId });
          sessionIdRef.current = newSessionId;
          setCurrentSessionId(newSessionId);
        }
      }
      yield chunk;
    }
  });

  // ============================================================================
  // TanStack AI useChat
  // ============================================================================
  const {
    messages,
    sendMessage: tanstackSendMessage,
    isLoading,
    error,
    stop,
    setMessages,
  } = useTanStackChat({
    connection,
    onFinish: () => {
      if (sessionIdRef.current) {
        invalidationHelpers.invalidateAfterActivity(queryClient);
      }
    },
    onError: (err) => {
      logger.error('Chat error', { error: err.message });
    },
  });

  // ============================================================================
  // sendMessage wrapper
  // ============================================================================
  const sendMessage = useCallback(
    async (content: string, attachments?: IChatFileAttachment[]) => {
      if (!user) {
        logger.warn('sendMessage: No user');
        return;
      }

      const hasAttachments = attachments && attachments.length > 0;

      if (!content.trim() && !hasAttachments) {
        logger.warn('sendMessage: No content or files');
        return;
      }

      if (hasAttachments) {
        fileIdsRef.current = attachments.map(a => a.fileId);
        setSessionFiles(prev => {
          const existingIds = new Set(prev.map(f => f.fileId));
          const newFiles = attachments.filter(a => !existingIds.has(a.fileId));
          return [...prev, ...newFiles];
        });
      }

      await tanstackSendMessage(content.trim() || '📎 Document');
    },
    [user, tanstackSendMessage]
  );

  // ============================================================================
  // Session initialization & history loading
  // ============================================================================
  useEffect(() => {
    // Skip if already loaded for this session
    if (historyLoaded) return;

    // If we have a sessionId, load history
    if (currentSessionId) {
      void loadHistory(currentSessionId);
      return;
    }

    // Otherwise, fetch/create session for this subject
    if (subject && user) {
      void fetchOrCreateSession();
    }

    async function fetchOrCreateSession() {
      try {
        const response = await fetch(`${getBackendURL()}/api/chat/session`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ subject }),
        });

        if (!response.ok) return;

        const result = (await response.json()) as { success: boolean; sessionId?: string };
        if (result.success && result.sessionId) {
          setCurrentSessionId(result.sessionId);
          sessionIdRef.current = result.sessionId;
          setHistoryLoaded(true); // New session = no history to load
        }
      } catch (err) {
        logger.error('Failed to fetch session', { error: err, subject });
      }
    }

    async function loadHistory(sid: string) {
      try {
        const response = await fetch(
          `${getBackendURL()}/api/chat/session/${sid}/history`,
          { credentials: 'include' }
        );

        if (!response.ok) {
          setHistoryLoaded(true);
          return;
        }

        const result = (await response.json()) as {
          success: boolean;
          messages?: Array<{
            id: string;
            role: 'user' | 'assistant';
            content: string | { content: string };
            timestamp?: string;
            attachedFile?: {
              fileName?: string;
              fileId?: string;
              mimeType?: string;
            } | null;
          }>;
        };

        if (result.success && result.messages) {
          const uiMessages: UIMessage[] = [];
          const loadedFilesMap = new Map<string, IChatFileAttachment>();

          for (const msg of result.messages) {
            const textContent = typeof msg.content === 'string' ? msg.content : msg.content.content;

            uiMessages.push({
              id: msg.id,
              role: msg.role,
              parts: [{ type: 'text' as const, content: textContent }],
              createdAt: msg.timestamp ? new Date(msg.timestamp) : new Date(),
            });

            if (msg.attachedFile?.fileId && msg.attachedFile.fileName && !loadedFilesMap.has(msg.attachedFile.fileId)) {
              loadedFilesMap.set(msg.attachedFile.fileId, {
                fileId: msg.attachedFile.fileId,
                fileName: msg.attachedFile.fileName,
                mimeType: msg.attachedFile.mimeType ?? 'application/octet-stream',
              });
            }
          }

          setMessages(uiMessages);
          setSessionFiles(Array.from(loadedFilesMap.values()));
          logger.info('History loaded', { sessionId: sid, count: uiMessages.length });
        }

        setHistoryLoaded(true);
      } catch (err) {
        logger.error('Failed to load history', { error: err, sessionId: sid });
        setHistoryLoaded(true);
      }
    }
  }, [currentSessionId, subject, user, historyLoaded, setMessages]);

  return {
    messages,
    sessionFiles,
    currentSessionId,
    isLoading,
    error: error?.message ?? null,
    sendMessage,
    stop,
  };
}
