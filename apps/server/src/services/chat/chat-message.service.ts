import { studySessionsRepository, messagesRepository } from '../../db/repositories';
import type { Message as DbMessage, AIModel } from '../../db/schema';
import { safeUUID } from '../../utils/uuid';
import { logger } from '../../lib/observability';
import type { MessageDetails } from './chat-types';

export class ChatMessageService {
  async getSessionHistory(sessionId: string, options?: { limit?: number; afterMessageId?: string }): Promise<DbMessage[]> {
    try {
      const validSessionId = safeUUID(sessionId);
      if (!validSessionId) {
        logger.warn('Invalid session UUID for history request', {
          operation: 'history:validation:uuid',
          sessionId,
          severity: 'low' as const
        });
        return [];
      }

      let sessionMessages = await messagesRepository.findBySessionId(validSessionId);

      if (options?.afterMessageId) {
        const cutoffIndex = sessionMessages.findIndex(m => m.id === options.afterMessageId);
        if (cutoffIndex !== -1) {
          sessionMessages = sessionMessages.slice(cutoffIndex + 1);
        }
      }

      if (options?.limit && sessionMessages.length > options.limit) {
        const messagesWithFiles = sessionMessages.filter(msg => msg.attachedFile !== null);
        const messagesWithoutFiles = sessionMessages.filter(msg => msg.attachedFile === null);

        const recentMessages = messagesWithoutFiles.slice(-options.limit);

        const combinedMessages = [...messagesWithFiles, ...recentMessages];

        const sortedMessages = combinedMessages.sort((a, b) =>
          a.createdAt.getTime() - b.createdAt.getTime()
        );

        logger.info('Session history retrieved with optimization', {
          operation: 'history:optimized',
          totalMessages: sessionMessages.length,
          messagesWithFiles: messagesWithFiles.length,
          recentMessages: recentMessages.length,
          finalCount: sortedMessages.length,
          sessionId: validSessionId
        });

        return sortedMessages;
      }

      return sessionMessages;
    } catch (_error) {
      logger.error('Error getting session history', { operation: 'chat:history:get', _error: _error instanceof Error ? _error.message : String(_error), sessionId, severity: 'medium' as const });
      throw new Error('Failed to get session history');
    }
  }

  async saveMessage(
    sessionId: string,
    role: 'user' | 'assistant',
    content: string,
    metadata: {
      frustrationLevel?: number | null;
      questionLevel?: number | null;
      tokensUsed?: number | null;
      responseTimeMs?: number | null;
      aiModel?: string | null;
      attachedFile?: {
        fileName: string;
        fileId?: string;
        geminiFileId?: string;
        mimeType?: string;
        fileSizeBytes?: number;
      };
      // Full list of files when the message has >1 attachment. The primary
      // (first) file stays in attachedFile for backward compatibility with
      // existing readers; the rest is persisted here in the JSONB metadata.
      attachedFiles?: Array<{
        fileName: string;
        fileId?: string;
        geminiFileId?: string;
        mimeType?: string;
        fileSizeBytes?: number;
      }>;
      /**
       * Pre-generation intent classification for this assistant turn. Not
       * rendered to the client — retained for evals, cohort analysis, and
       * offline quality reviews.
       */
      classifiedIntent?: {
        intent: string;
        confidence: 'low' | 'medium' | 'high';
        error?: string;
      };
    },
    options: { verifySessionExists?: boolean } = {}
  ): Promise<{ messageId: string; realSessionId: string }> {
    try {
      const validSessionId = safeUUID(sessionId);

      if (!validSessionId) {
        logger.error('Invalid session ID', {
          _error: 'Invalid session ID provided',
          operation: 'saveMessage',
          originalSessionId: sessionId,
          severity: 'high' as const
        });
        throw new Error('Invalid session ID provided');
      }

      // Session verification is optional: orchestration layer already resolves + owner-checks
      // the session right before calling saveMessage, so re-selecting here is wasted I/O.
      // Callers without prior verification should pass { verifySessionExists: true }.
      const shouldVerify = options.verifySessionExists ?? true;
      if (shouldVerify) {
        const session = await studySessionsRepository.findById(validSessionId);
        if (!session) {
          logger.error('Session not found', {
            _error: `Session ${validSessionId} not found`,
            operation: 'saveMessage',
            sessionId: validSessionId,
            severity: 'high' as const
          });
          throw new Error(`Session ${validSessionId} not found. Create session explicitly first.`);
        }
      }

      const messageMetadata: Record<string, unknown> = {};
      if (metadata.attachedFiles && metadata.attachedFiles.length > 1) {
        messageMetadata.attachedFiles = metadata.attachedFiles;
      }
      if (metadata.classifiedIntent) {
        messageMetadata.classifiedIntent = metadata.classifiedIntent;
      }

      const message = await messagesRepository.create({
        sessionId: validSessionId,
        role,
        content,
        frustrationLevel: metadata.frustrationLevel ?? null,
        questionLevel: metadata.questionLevel ?? null,
        aiModel: this.mapAIModelName(metadata.aiModel),
        tokensUsed: metadata.tokensUsed ?? null,
        responseTimeMs: metadata.responseTimeMs ?? null,
        attachedFile: metadata.attachedFile ?? null,
        messageMetadata,
        createdAt: new Date()
      });

      return { messageId: message.id, realSessionId: validSessionId };
    } catch (_error) {
      logger.error('Error saving message', { operation: 'chat:message:save', _error: _error instanceof Error ? _error.message : String(_error), sessionId, role, severity: 'high' as const });
      throw new Error('Failed to save message');
    }
  }

  async getMessageById(messageId: string, userId: string): Promise<MessageDetails | null> {
    try {
      const validMessageId = safeUUID(messageId);
      if (!validMessageId) {
        logger.warn('Invalid message UUID provided', {
          operation: 'message:validation:uuid',
          messageId,
          severity: 'low' as const
        });
        return null;
      }

      const message = await messagesRepository.findById(validMessageId);
      if (!message) {
        return null;
      }

      const session = await studySessionsRepository.findById(message.sessionId);
      if (!session || session.userId !== userId) {
        logger.warn('Unauthorized access attempt to message', {
          operation: 'message:access:unauthorized',
          messageId: validMessageId,
          userId,
          severity: 'medium' as const
        });
        return null;
      }

      return {
        id: message.id,
        sessionId: message.sessionId,
        role: message.role as 'user' | 'assistant',
        content: message.content,
        frustrationLevel: message.frustrationLevel,
        questionLevel: message.questionLevel,
        aiModel: message.aiModel,
        isFallback: false,
        timestamp: message.createdAt,
        tokensUsed: message.tokensUsed,
        costEstimate: null,
        attachedFile: message.attachedFile &&
          typeof message.attachedFile === 'object' &&
          'fileName' in message.attachedFile &&
          message.attachedFile.fileName
            ? message.attachedFile as { fileName: string; fileId?: string; geminiFileId?: string; mimeType?: string; fileSizeBytes?: number; }
            : null
      };
    } catch (_error) {
      logger.error('Error getting message by ID', { operation: 'chat:message:get', _error: _error instanceof Error ? _error.message : String(_error), messageId, userId, severity: 'medium' as const });
      throw new Error('Failed to get message');
    }
  }

  private mapAIModelName(modelName?: string | null): AIModel | null {
    return modelName ?? null;
  }
}
