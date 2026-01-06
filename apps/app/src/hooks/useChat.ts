/**
 * useChat - Optimized Chat Hook (Gemini 3 Flash)
 *
 * Token-optimized architecture:
 * - Frontend sends ONLY new message content (not history)
 * - Backend manages history from DB (limit: 10, auto-summarization)
 * - Implicit caching via stable prompt prefix
 * - SSE streaming with @google/genai
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
  sessionId: string | null;
  subject: string;
  onSessionCreated?: (sessionId: string) => void;
}

/** TanStack AI Protocol - Custom data sent with each request */
interface ChatRequestData {
  subject: string;
  sessionId?: string;
  schoolLevel?: string;
  firstName?: string;
  /** IDs des fichiers attachés (images, PDFs) - multimodal */
  fileIds?: string[];
}

// ============================================================================
// SSE Parser - Standard Web API pattern for stream() adapter
// ============================================================================

/**
 * Parse Server-Sent Events stream into TanStack AI StreamChunks
 * This is the standard pattern when using stream() adapter with SSE backend
 */
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

    // Process remaining buffer
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

export function useChat({ sessionId, subject, onSessionCreated }: UseChatOptions) {
  const user = useUser();
  const queryClient = useQueryClient();

  // Refs for dynamic data (accessible in stream adapter closure)
  const fileIdsRef = useRef<string[]>([]);
  const sessionIdRef = useRef<string | null>(sessionId);
  const serverSessionIdRef = useRef<string | null>(null); // SessionId from backend 'done' chunk

  // Liste des fichiers de la session (simple liste plate)
  const [sessionFiles, setSessionFiles] = useState<IChatFileAttachment[]>([]);

  // Sync sessionId ref when prop changes
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  // ============================================================================
  // Stream adapter - Token optimized
  // Sends ONLY new message content (backend manages history from DB)
  // ============================================================================
  const connection = stream(async function* (
    messages: ModelMessage[],
    _connectionData?: Record<string, unknown>
  ): AsyncIterable<StreamChunk> {
    // Extract ONLY the last user message (backend has history in DB)
    const lastUserMessage = messages.filter(m => m.role === 'user').pop();
    const content = lastUserMessage?.content ?? '';

    // Build request data
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

    // File attachments (consumed once per message)
    if (fileIdsRef.current.length > 0) {
      data.fileIds = [...fileIdsRef.current];
      fileIdsRef.current = []; // Clear after use
    }

    logger.info('Chat request (optimized)', {
      contentLength: content.length,
      data,
      userId: user?.id ?? 'anonymous',
    });

    // Send optimized format: { content, data } (not full messages array)
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
        // Use default error
      }
      throw new Error(errorMessage);
    }

    // Parse SSE response and intercept sessionId from 'done' chunk
    for await (const chunk of parseServerSentEvents(response)) {
      // Intercept 'done' chunk to capture sessionId before TanStack processes it
      if (chunk.type === 'done') {
        const doneChunk = chunk as { type: 'done'; metadata?: { sessionId?: string } };
        if (doneChunk.metadata?.sessionId) {
          serverSessionIdRef.current = doneChunk.metadata.sessionId;
          logger.info('Captured sessionId from done chunk', {
            sessionId: doneChunk.metadata.sessionId,
          });
        }
      }
      yield chunk;
    }
  });

  // ============================================================================
  // TanStack AI useChat hook
  // ============================================================================
  const {
    messages,
    sendMessage: tanstackSendMessage,
    isLoading,
    error,
    stop,
    setMessages,
    clear,
  } = useTanStackChat({
    connection,
    onFinish: (message) => {
      logger.info('TanStack AI message complete', {
        messageId: message.id,
        role: message.role,
      });

      // Use sessionId captured from 'done' chunk by stream adapter
      const newSessionId = serverSessionIdRef.current;

      if (newSessionId && newSessionId !== sessionIdRef.current) {
        logger.info('New session created by backend', {
          oldSessionId: sessionIdRef.current,
          newSessionId,
        });
        sessionIdRef.current = newSessionId;
        serverSessionIdRef.current = null; // Reset after use
        onSessionCreated?.(newSessionId);
      }

      // Invalidate TanStack Query cache for dashboard updates
      if (sessionIdRef.current) {
        invalidationHelpers.invalidateAfterActivity(queryClient);
      }
    },
    onError: (err) => {
      logger.error('TanStack AI error', { error: err.message });
    },
  });

  // ============================================================================
  // sendMessage wrapper for fileIds + attachments
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

      // Store fileIds for stream adapter to consume
      if (hasAttachments) {
        fileIdsRef.current = attachments.map(a => a.fileId);
        // Ajouter fichiers (éviter doublons si historique rechargé)
        setSessionFiles(prev => {
          const existingIds = new Set(prev.map(f => f.fileId));
          const newFiles = attachments.filter(a => !existingIds.has(a.fileId));
          return [...prev, ...newFiles];
        });
      }

      await tanstackSendMessage(content.trim() || '🎤 Enregistrement audio');
    },
    [user, tanstackSendMessage]
  );

  // ============================================================================
  // Load session and conversation history
  // ============================================================================
  useEffect(() => {
    // Si on a déjà un sessionId, charger l'historique directement
    if (sessionId) {
      void loadHistory(sessionId);
      return;
    }

    // Sinon, récupérer/créer la session pour cette matière
    if (subject) {
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
          sessionIdRef.current = result.sessionId;
          onSessionCreated?.(result.sessionId);
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

        if (!response.ok) return;

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

            // Dédupliquer par fileId
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
          logger.info('History loaded', { sessionId: sid, count: uiMessages.length, files: loadedFilesMap.size });
        }
      } catch (err) {
        logger.error('Failed to load history', { error: err, sessionId: sid });
      }
    }
  }, [sessionId, subject, onSessionCreated, setMessages]);

  // ============================================================================
  // Clear messages and files
  // ============================================================================
  const clearAll = useCallback(() => {
    clear();
    setSessionFiles([]);
  }, [clear]);

  // ============================================================================
  // Return hook API
  // ============================================================================
  return {
    messages,
    sessionFiles,
    isLoading,
    error: error?.message ?? null,
    sendMessage,
    stop,
    clear: clearAll,
  };
}
