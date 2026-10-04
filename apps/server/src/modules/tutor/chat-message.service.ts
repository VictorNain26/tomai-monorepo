import { studySessionsRepository } from './study-sessions.repository.js';
import { messagesRepository } from './messages.repository.js';
import type { AIModel } from '../../db/schema';
import type { Message as DbMessage } from './session.schema.js';
import { logger } from '../../platform/observability/logger';
import type { MessageDetails } from './chat-types';
import type { ResponseMessage } from './chat-message-assembler.js';

export class ChatMessageService {
  async getSessionHistory(sessionId: string, options?: { limit?: number | undefined; afterMessageId?: string | undefined }): Promise<Omit<DbMessage, 'modelMessages'>[]> {
    try {
      let sessionMessages = await messagesRepository.findBySessionId(sessionId);

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
          sessionId
        });

        return sortedMessages;
      }

      return sessionMessages;
    } catch (_error) {
      logger.error('Error getting session history', { operation: 'chat:history:get', err: _error, sessionId, severity: 'medium' as const });
      throw new Error('Failed to get session history', { cause: _error });
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
        mimeType?: string;
        fileSizeBytes?: number;
      };
      // Full list of files when the message has >1 attachment. The primary
      // (first) file stays in attachedFile for backward compatibility with
      // existing readers; the rest is persisted here in the JSONB metadata.
      attachedFiles?: {
        fileName: string;
        fileId?: string;
        mimeType?: string;
        fileSizeBytes?: number;
      }[];
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
      /** Input channel declared by the user's gesture (mic vs keyboard). */
      inputMode?: 'text' | 'voice';
      /** The assistant's response messages as the model produced them, replayed next turn. */
      modelMessages?: ResponseMessage[] | undefined;
      /** The turn was cut (timeout, error): the text is what the student saw of it. */
      cut?: boolean | undefined;
    },
    options: { verifySessionExists?: boolean } = {}
  ): Promise<{ messageId: string; realSessionId: string }> {
    try {
      // Session verification is optional: orchestration layer already resolves + owner-checks
      // the session right before calling saveMessage, so re-selecting here is wasted I/O.
      // Callers without prior verification should pass { verifySessionExists: true }.
      const shouldVerify = options.verifySessionExists ?? true;
      if (shouldVerify) {
        const session = await studySessionsRepository.findById(sessionId);
        if (!session) {
          logger.error('Session not found', {
            reason: `Session ${sessionId} not found`,
            operation: 'saveMessage',
            sessionId,
            severity: 'high' as const
          });
          throw new Error(`Session ${sessionId} not found. Create session explicitly first.`);
        }
      }

      const messageMetadata: Record<string, unknown> = {};
      if (metadata.attachedFiles && metadata.attachedFiles.length > 1) {
        messageMetadata['attachedFiles'] = metadata.attachedFiles;
      }
      if (metadata.classifiedIntent) {
        messageMetadata['classifiedIntent'] = metadata.classifiedIntent;
      }
      if (metadata.inputMode) {
        messageMetadata['inputMode'] = metadata.inputMode;
      }
      if (metadata.cut) {
        messageMetadata['cut'] = true;
      }

      const message = await messagesRepository.create({
        sessionId,
        role,
        content,
        frustrationLevel: metadata.frustrationLevel ?? null,
        questionLevel: metadata.questionLevel ?? null,
        aiModel: this.mapAIModelName(metadata.aiModel),
        tokensUsed: metadata.tokensUsed ?? null,
        responseTimeMs: metadata.responseTimeMs ?? null,
        attachedFile: metadata.attachedFile ?? null,
        messageMetadata,
        modelMessages: metadata.modelMessages ?? null,
        createdAt: new Date()
      });

      return { messageId: message.id, realSessionId: sessionId };
    } catch (_error) {
      logger.error('Error saving message', { operation: 'chat:message:save', err: _error, sessionId, role, severity: 'high' as const });
      throw new Error('Failed to save message', { cause: _error });
    }
  }

  async getMessageById(messageId: string, userId: string): Promise<MessageDetails | null> {
    try {
      const message = await messagesRepository.findById(messageId);
      if (!message) {
        return null;
      }

      const session = await studySessionsRepository.findById(message.sessionId);
      if (session?.userId !== userId) {
        logger.warn('Unauthorized access attempt to message', {
          operation: 'message:access:unauthorized',
          messageId,
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
            ? message.attachedFile as { fileName: string; fileId?: string; mimeType?: string; fileSizeBytes?: number; }
            : null
      };
    } catch (_error) {
      logger.error('Error getting message by ID', { operation: 'chat:message:get', err: _error, messageId, userId, severity: 'medium' as const });
      throw new Error('Failed to get message', { cause: _error });
    }
  }

  private mapAIModelName(modelName?: string | null): AIModel | null {
    return modelName ?? null;
  }
}

export const chatMessageService = new ChatMessageService();
