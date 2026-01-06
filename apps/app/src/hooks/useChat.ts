/**
 * useChat - Hook chat SSE simple
 *
 * Architecture cohérente frontend/backend:
 * - TanStack Query pour session et historique (cache natif)
 * - Fetch + SSE parser pour streaming (format GeminiStreamChunk du backend)
 * - React state pour messages UI
 */

import { useCallback, useRef, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUser } from '@/lib/auth';
import { invalidationHelpers } from '@/lib/query-factories';
import { getBackendURL } from '@/utils/urls';
import { logger } from '@/lib/logger';
import type { IChatFileAttachment } from '@/types';

// ============================================================================
// Types (cohérents avec backend GeminiStreamChunk)
// ============================================================================

/** Message UI simple */
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: Date;
}

/** Chunk SSE du backend */
interface StreamChunk {
  type: 'content' | 'done' | 'error';
  id: string;
  delta?: string;
  content?: string;
  metadata?: { sessionId?: string };
  error?: { message: string };
}

interface UseChatOptions {
  initialSessionId: string | null;
  subject: string;
}

interface UseChatReturn {
  messages: ChatMessage[];
  sessionFiles: IChatFileAttachment[];
  currentSessionId: string | null;
  isLoading: boolean;
  error: string | null;
  sendMessage: (content: string, attachments?: IChatFileAttachment[]) => Promise<void>;
  stop: () => void;
}

// ============================================================================
// API Functions
// ============================================================================

async function fetchOrCreateSession(subject: string): Promise<string | null> {
  const response = await fetch(`${getBackendURL()}/api/chat/session`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subject }),
  });

  if (!response.ok) throw new Error(`Session error: ${response.status}`);

  const result = (await response.json()) as { success: boolean; sessionId?: string };
  return result.sessionId ?? null;
}

interface HistoryMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
  attachedFile?: { fileName?: string; fileId?: string; mimeType?: string } | null;
}

interface HistoryData {
  messages: ChatMessage[];
  files: IChatFileAttachment[];
}

async function fetchHistory(sessionId: string): Promise<HistoryData> {
  const response = await fetch(
    `${getBackendURL()}/api/chat/session/${sessionId}/history`,
    { credentials: 'include' }
  );

  if (!response.ok) return { messages: [], files: [] };

  const result = (await response.json()) as {
    success: boolean;
    messages?: HistoryMessage[];
  };

  if (!result.success || !result.messages) return { messages: [], files: [] };

  const messages: ChatMessage[] = [];
  const filesMap = new Map<string, IChatFileAttachment>();

  for (const msg of result.messages) {
    messages.push({
      id: msg.id,
      role: msg.role,
      content: msg.content,
      createdAt: msg.timestamp ? new Date(msg.timestamp) : new Date(),
    });

    if (msg.attachedFile?.fileId && msg.attachedFile.fileName) {
      filesMap.set(msg.attachedFile.fileId, {
        fileId: msg.attachedFile.fileId,
        fileName: msg.attachedFile.fileName,
        mimeType: msg.attachedFile.mimeType ?? 'application/octet-stream',
      });
    }
  }

  return { messages, files: Array.from(filesMap.values()) };
}

// ============================================================================
// SSE Parser (format backend)
// ============================================================================

async function* parseSSE(response: Response): AsyncIterable<StreamChunk> {
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
            if (data === '[DONE]' || !data) continue;
            try {
              yield JSON.parse(data) as StreamChunk;
            } catch {
              // Ignore malformed JSON
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
// Query Keys
// ============================================================================

const queryKeys = {
  session: (subject: string) => ['chat', 'session', subject] as const,
  history: (sessionId: string) => ['chat', 'history', sessionId] as const,
};

// ============================================================================
// useChat Hook
// ============================================================================

export function useChat({ initialSessionId, subject }: UseChatOptions): UseChatReturn {
  const user = useUser();
  const queryClient = useQueryClient();

  // UI State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localFiles, setLocalFiles] = useState<IChatFileAttachment[]>([]);

  // Refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const sessionIdRef = useRef<string | null>(initialSessionId);
  const historySyncedRef = useRef<string | null>(null);

  // ============================================================================
  // Session Query
  // ============================================================================
  const sessionQuery = useQuery({
    queryKey: queryKeys.session(subject),
    queryFn: () => fetchOrCreateSession(subject),
    enabled: !initialSessionId && !!subject && !!user,
    staleTime: Infinity,
  });

  const currentSessionId = initialSessionId ?? sessionQuery.data ?? null;
  sessionIdRef.current = currentSessionId;

  // ============================================================================
  // History Query
  // ============================================================================
  const historyQuery = useQuery({
    queryKey: queryKeys.history(currentSessionId ?? ''),
    queryFn: () => fetchHistory(currentSessionId ?? ''),
    enabled: !!currentSessionId,
    staleTime: Infinity,
  });

  // Sync history once per session
  useEffect(() => {
    const historyData = historyQuery.data;
    if (!historyData || !currentSessionId) return;
    if (historySyncedRef.current === currentSessionId) return;
    if (historyData.messages.length === 0) return;

    historySyncedRef.current = currentSessionId;
    setMessages(historyData.messages);
    logger.info('History synced', { sessionId: currentSessionId, count: historyData.messages.length });
  }, [historyQuery.data, currentSessionId]);

  // ============================================================================
  // Send Message
  // ============================================================================
  const sendMessage = useCallback(
    async (content: string, attachments?: IChatFileAttachment[]) => {
      if (!user) return;
      if (!content.trim() && (!attachments || attachments.length === 0)) return;

      setError(null);
      setIsLoading(true);

      // Add user message immediately
      const userMessage: ChatMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: content.trim() || '📎 Document',
        createdAt: new Date(),
      };
      setMessages(prev => [...prev, userMessage]);

      // Track files
      if (attachments && attachments.length > 0) {
        setLocalFiles(prev => {
          const existingIds = new Set(prev.map(f => f.fileId));
          return [...prev, ...attachments.filter(a => !existingIds.has(a.fileId))];
        });
      }

      // Prepare request
      const fileIds = attachments?.map(a => a.fileId) ?? [];
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        const response = await fetch(`${getBackendURL()}/api/chat/stream`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          signal: abortController.signal,
          body: JSON.stringify({
            content: content.trim() || '📎 Document',
            data: {
              subject: subject.trim(),
              sessionId: sessionIdRef.current,
              schoolLevel: user.schoolLevel,
              firstName: user.firstName,
              fileIds: fileIds.length > 0 ? fileIds : undefined,
            },
          }),
        });

        if (!response.ok) {
          const errorBody = (await response.json().catch(() => ({}))) as { message?: string };
          throw new Error(errorBody.message ?? `HTTP ${response.status}`);
        }

        // Create assistant message placeholder
        const assistantId = `assistant-${Date.now()}`;
        let fullContent = '';

        setMessages(prev => [...prev, {
          id: assistantId,
          role: 'assistant',
          content: '',
          createdAt: new Date(),
        }]);

        // Stream response
        for await (const chunk of parseSSE(response)) {
          if (chunk.type === 'content') {
            fullContent = chunk.content ?? fullContent;
            setMessages(prev =>
              prev.map(m => m.id === assistantId ? { ...m, content: fullContent } : m)
            );
          } else if (chunk.type === 'done') {
            if (chunk.metadata?.sessionId && chunk.metadata.sessionId !== sessionIdRef.current) {
              sessionIdRef.current = chunk.metadata.sessionId;
              queryClient.setQueryData(queryKeys.session(subject), chunk.metadata.sessionId);
            }
          } else if (chunk.type === 'error') {
            throw new Error(chunk.error?.message ?? 'Stream error');
          }
        }

        // Invalidate on finish
        invalidationHelpers.invalidateAfterActivity(queryClient);

      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          const message = err instanceof Error ? err.message : 'Erreur inconnue';
          setError(message);
          logger.error('Chat error', { error: message });
        }
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [user, subject, queryClient]
  );

  // ============================================================================
  // Stop
  // ============================================================================
  const stop = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsLoading(false);
  }, []);

  // Combine files
  const historyFiles = historyQuery.data?.files ?? [];
  const allFiles = [...historyFiles, ...localFiles];
  const uniqueFiles = Array.from(new Map(allFiles.map(f => [f.fileId, f])).values());

  return {
    messages,
    sessionFiles: uniqueFiles,
    currentSessionId,
    isLoading: isLoading || sessionQuery.isLoading || historyQuery.isLoading,
    error: error ?? sessionQuery.error?.message ?? historyQuery.error?.message ?? null,
    sendMessage,
    stop,
  };
}
