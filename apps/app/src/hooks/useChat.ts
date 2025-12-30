/**
 * useChat - TanStack AI Protocol 2025
 *
 * 100% TanStack AI implementation:
 * - stream() adapter for dynamic payload (fileIds per message)
 * - TanStack AI Protocol format: { messages, data }
 * - SSE streaming with standard parser
 * - Auth via Better Auth cookies
 */

import { useCallback, useRef, useEffect } from 'react';
import { useChat as useTanStackChat, stream, type UIMessage } from '@tanstack/ai-react';
import type { StreamChunk, ModelMessage } from '@tanstack/ai';
import { useUser } from '@/lib/auth';
import { useQueryClient } from '@tanstack/react-query';
import { invalidationHelpers } from '@/lib/query-factories';
import { getBackendURL } from '@/utils/urls';
import { logger } from '@/lib/logger';

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
  fileId?: string;
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

  // Sync sessionId ref when prop changes
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  // ============================================================================
  // TanStack AI stream() adapter
  // Sends TanStack AI Protocol format: { messages, data }
  // ============================================================================
  const connection = stream(async function* (
    messages: ModelMessage[],
    _connectionData?: Record<string, unknown>
  ): AsyncIterable<StreamChunk> {
    // Build TanStack AI Protocol request data
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

    // File attachment (consumed once per message)
    const firstFileId = fileIdsRef.current[0];
    if (firstFileId) {
      data.fileId = firstFileId;
      fileIdsRef.current = []; // Clear after use
    }

    logger.info('TanStack AI Protocol request', {
      messagesCount: messages.length,
      data,
      userId: user?.id ?? 'anonymous',
    });

    // Send TanStack AI Protocol format: { messages, data }
    const response = await fetch(`${getBackendURL()}/api/chat/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, data }),
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
  // sendMessage wrapper for fileIds
  // ============================================================================
  const sendMessage = useCallback(
    async (content: string, fileIds?: string[]) => {
      if (!user) {
        logger.warn('sendMessage: No user');
        return;
      }

      if (!content.trim() && (!fileIds || fileIds.length === 0)) {
        logger.warn('sendMessage: No content or files');
        return;
      }

      // Store fileIds for stream adapter to consume
      if (fileIds && fileIds.length > 0) {
        fileIdsRef.current = fileIds;
      }

      await tanstackSendMessage(content.trim() || '🎤 Enregistrement audio');
    },
    [user, tanstackSendMessage]
  );

  // ============================================================================
  // Load conversation history when sessionId changes
  // ============================================================================
  useEffect(() => {
    if (!sessionId) {
      clear();
      return;
    }

    const loadHistory = async () => {
      try {
        const response = await fetch(
          `${getBackendURL()}/api/chat/session/${sessionId}/history`,
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
          }>;
        };

        if (result.success && result.messages) {
          const uiMessages: UIMessage[] = result.messages.map((msg) => ({
            id: msg.id,
            role: msg.role,
            parts: [
              {
                type: 'text' as const,
                content:
                  typeof msg.content === 'string' ? msg.content : msg.content.content,
              },
            ],
            createdAt: msg.timestamp ? new Date(msg.timestamp) : new Date(),
          }));

          setMessages(uiMessages);
          logger.info('History loaded', { sessionId, count: uiMessages.length });
        }
      } catch (err) {
        logger.error('Failed to load history', { error: err, sessionId });
      }
    };

    void loadHistory();
  }, [sessionId, setMessages, clear]);

  // ============================================================================
  // Return hook API
  // ============================================================================
  return {
    messages,
    isLoading,
    error: error?.message ?? null,
    sendMessage,
    stop,
    clearError: useCallback(() => {}, []),
  };
}
