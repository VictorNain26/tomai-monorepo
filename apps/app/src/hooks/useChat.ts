/**
 * useChat - Hook de chat avec streaming SSE
 *
 * Architecture propre:
 * - sessionId vient de l'URL (props)
 * - onSessionCreated callback quand backend crée une session
 * - Pas de state interne pour sessionId
 * - Hook pur de logique métier
 */

import { logger } from '@/lib/logger.js';
import { useState, useCallback, useEffect } from 'react';
import { useUser } from '@/lib/auth';
import { apiClient } from '@/lib/api-client';
import { useQueryClient } from '@tanstack/react-query';
import { invalidationHelpers } from '@/lib/query-factories';
import type { IMessage } from '@/types';

// User type with chat-specific fields
interface UserWithChatData {
  id: string;
  schoolLevel?: string;
  firstName?: string;
  dateOfBirth?: string;
}

// REMOVED: Legacy single-file interface (migration to multi-files support)

// API Response for history
interface ChatHistoryResponse {
  success: boolean;
  messages?: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string | {
      content: string;
      provider?: string;
      tokensUsed?: number;
    };
    timestamp?: string;
  }>;
}

/**
 * Hook options - sessionId est la source de vérité (vient de l'URL)
 */
interface UseChatOptions {
  sessionId: string | null;
  subject: string;
  onSessionCreated?: (sessionId: string) => void;
}

/**
 * Hook return - Interface simplifiée
 */
interface UseChatReturn {
  messages: IMessage[];
  loading: boolean;
  error: string | null;
  sendMessage: (content: string, fileIds?: string[]) => Promise<void>;
  streamingMessage: IMessage | null;
  clearError: () => void;
}

/**
 * Hook principal de chat
 */
export function useChat({ sessionId, subject, onSessionCreated }: UseChatOptions): UseChatReturn {
  const user = useUser();
  const queryClient = useQueryClient();

  const [messages, setMessages] = useState<IMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamingMessage, setStreamingMessage] = useState<IMessage | null>(null);

  /**
   * Charger l'historique quand sessionId change
   */
  useEffect(() => {
    if (!sessionId) {
      setMessages([]);
      return;
    }

    let cancelled = false;

    const loadHistory = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get(`/api/chat/session/${sessionId}/history`) as ChatHistoryResponse;

        if (cancelled) return;

        if (response.success && response.messages) {
          const formattedMessages: IMessage[] = response.messages.map((msg) => {
            const messageContent = typeof msg.content === 'string'
              ? msg.content
              : typeof msg.content === 'object' && msg.content.content
              ? msg.content.content
              : JSON.stringify(msg.content);

            return {
              id: msg.id,
              role: msg.role,
              content: messageContent,
              timestamp: msg.timestamp ?? new Date().toISOString(),
              status: 'complete' as const,
              sessionId
            };
          });

          setMessages(formattedMessages);
          setError(null);

          logger.info('Historique chargé', {
            sessionId,
            messageCount: formattedMessages.length
          });
        }
      } catch (err) {
        if (cancelled) return;

        logger.error('Erreur chargement historique', {
          error: err,
          sessionId
        });

        setError('Erreur lors du chargement de l\'historique');
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadHistory();

    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  /**
   * Envoyer un message avec streaming SSE
   */
  const sendMessage = useCallback(async (content: string, fileIds?: string[]): Promise<void> => {
    // Validation: user requis + (contenu OU fichiers)
    const hasContent = !!content.trim();
    const hasFiles = !!(fileIds && fileIds.length > 0);

    if (!user || (!hasContent && !hasFiles)) {
      logger.warn('sendMessage: Missing required parameters', {
        hasUser: !!user,
        hasContent,
        hasFiles
      });
      return;
    }

    setLoading(true);
    setError(null);

    // Message utilisateur immédiat (optimistic UI)
    const messageContent = content.trim() || (hasFiles ? '🎤 Enregistrement audio' : '');
    const tempUserMessage: IMessage = {
      id: `temp-user-${Date.now()}`,
      role: 'user',
      content: messageContent,
      timestamp: new Date().toISOString(),
      status: 'complete',
      sessionId: sessionId ?? 'temp'
    };

    setMessages(prev => [...prev, tempUserMessage]);

    try {
      // Construction payload
      const payload: Record<string, unknown> = {
        content: content.trim() || (hasFiles ? '🎤 Enregistrement audio' : ''),
        subject: subject.trim()
      };

      // Session ID optionnel (backend crée si absent)
      if (sessionId) {
        payload['sessionId'] = sessionId;
      }

      // User metadata
      const userSchoolLevel = (user as UserWithChatData)?.schoolLevel;
      if (userSchoolLevel) {
        payload['schoolLevel'] = userSchoolLevel;
      }

      const userFirstName = (user as UserWithChatData)?.firstName;
      if (userFirstName) {
        payload['firstName'] = userFirstName;
      }

      const userDateOfBirth = (user as UserWithChatData)?.dateOfBirth;
      if (userDateOfBirth) {
        payload['dateOfBirth'] = userDateOfBirth;
      }

      // File attachments (multi-files support)
      if (fileIds && fileIds.length > 0) {
        payload['fileIds'] = fileIds;
      }

      logger.info('Streaming SSE démarré', {
        payload,
        userId: user.id
      });

      // 🚀 STREAMING SSE avec Fetch API
      const response = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        credentials: 'include' // Better Auth cookies
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (!response.body) {
        throw new Error('ReadableStream not supported');
      }

      // Lecture du stream SSE
      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      let accumulatedContent = '';
      let receivedSessionId = sessionId;
      let finalProvider = 'gemini';

      // Message streaming initial
      const streamingMsgId = `streaming-${Date.now()}`;
      const initialStreamingMsg: IMessage = {
        id: streamingMsgId,
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        status: 'streaming',
        sessionId: receivedSessionId ?? 'temp'
      };

      setStreamingMessage(initialStreamingMsg);
      setMessages(prev => [...prev, initialStreamingMsg]);

      // Lire les chunks SSE
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === 'chunk') {
                accumulatedContent += data.content;
                finalProvider = data.provider ?? finalProvider;

                // Mise à jour temps réel
                setStreamingMessage(prev => prev ? {
                  ...prev,
                  content: accumulatedContent,
                  metadata: {
                    provider: finalProvider,
                    aiModelDetails: {
                      name: finalProvider,
                      tier: 'standard'
                    }
                  }
                } : null);

                setMessages(prev => prev.map(msg =>
                  msg.id === streamingMsgId
                    ? { ...msg, content: accumulatedContent }
                    : msg
                ));

              } else if (data.type === 'end') {
                accumulatedContent = data.content ?? accumulatedContent;
                receivedSessionId = data.sessionId ?? receivedSessionId;
                finalProvider = data.provider ?? finalProvider;

                logger.info('Streaming complété', {
                  ...(receivedSessionId && { sessionId: receivedSessionId }),
                  contentLength: accumulatedContent.length,
                  provider: finalProvider
                });

              } else if (data.type === 'error') {
                throw new Error(data.error ?? 'Erreur streaming');
              }
            } catch (parseError) {
              logger.error('Erreur parsing SSE', {
                error: parseError,
                line
              });
            }
          }
        }
      }

      // Finaliser le message
      const finalMessage: IMessage = {
        id: streamingMsgId,
        role: 'assistant',
        content: accumulatedContent,
        timestamp: new Date().toISOString(),
        status: 'complete',
        sessionId: receivedSessionId ?? 'temp',
        metadata: {
          provider: finalProvider,
          aiModelDetails: {
            name: finalProvider,
            tier: 'standard'
          }
        }
      };

      setStreamingMessage(null);
      setMessages(prev => prev.map(msg =>
        msg.id === streamingMsgId ? finalMessage : msg
      ));

      // Si nouvelle session créée par le backend, notifier Chat.tsx
      if (receivedSessionId && receivedSessionId !== sessionId) {
        logger.info('Nouvelle session créée par le backend', {
          oldSessionId: sessionId,
          newSessionId: receivedSessionId
        });

        onSessionCreated?.(receivedSessionId);
      }

      // Invalider le cache TanStack Query
      if (receivedSessionId) {
        const realMessages = messages.filter(m =>
          m.status === 'complete' && !m.id.includes('temp')
        );

        invalidationHelpers.optimisticSessionUpdate(queryClient, {
          id: receivedSessionId,
          subject,
          startedAt: new Date().toISOString(),
          messagesCount: realMessages.length + 2
        });

        invalidationHelpers.invalidateAfterActivity(queryClient);

        logger.info('Cache invalidé', {
          sessionId: receivedSessionId,
          messagesCount: realMessages.length + 2
        });
      }

    } catch (err: unknown) {
      // Nettoyer streaming message en cas d'erreur
      setStreamingMessage(null);
      setMessages(prev => prev.filter(msg => msg.status !== 'streaming'));

      let errorMsg = 'Erreur lors du streaming';

      if (err instanceof Error) {
        if (err.name === 'AbortError' || err.message.includes('signal is aborted')) {
          errorMsg = 'Requête annulée - Timeout de connexion';
        } else if (err.message.includes('Failed to fetch')) {
          errorMsg = 'Erreur de connexion au serveur';
        } else if (err.message.includes('404')) {
          errorMsg = 'Endpoint non trouvé';
        } else if (err.message.includes('401') || err.message.includes('Unauthorized')) {
          errorMsg = 'Session expirée - Veuillez vous reconnecter';
        } else if (err.message.includes('503')) {
          errorMsg = 'Service IA temporairement indisponible';
        } else {
          errorMsg = err.message;
        }
      }

      logger.error('Erreur streaming SSE', {
        _error: err,
        errorType: err instanceof Error ? err.name : 'Unknown',
        errorMessage: err instanceof Error ? err.message : String(err),
        subject,
        userId: user?.id,
        operation: 'useChat:sendMessage:streaming'
      });

      setError(errorMsg);
      throw err;

    } finally {
      setLoading(false);
    }
  }, [user, sessionId, subject, onSessionCreated, queryClient, messages]);

  /**
   * Nettoyer l'erreur
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    messages,
    loading,
    error,
    sendMessage,
    streamingMessage,
    clearError
  };
}
