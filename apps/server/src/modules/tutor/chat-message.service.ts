import { studySessionsRepository } from './study-sessions.repository.js';
import { messagesRepository } from './messages.repository.js';
import type { AIModel } from '../../db/schema';
import type { Message as DbMessage } from './session.schema.js';
import { logger } from '../../platform/observability/logger';
import type { MessageDetails } from './chat-types';
import type { ResponseMessage } from './chat-message-assembler.js';
import type { TurnAnalysis } from './turn-analysis.service.js';
import type { Diagnosis } from './exercise-diagnosis.service.js';
import type { Finding } from './output-check.js';
import type { DistressSource } from './distress.js';

export interface OutputCheckRecord {
  findings: Finding['kind'][];
  outcome: 'regenerated' | 'fallback';
}

export class ChatMessageService {
  async getSessionHistory(sessionId: string, options?: { limit?: number | undefined; afterMessageId?: string | undefined }): Promise<Omit<DbMessage, 'modelMessages'>[]> {
    try {
      // After the summary's last message, as the summary reads them: the rest of the session stays in the database.
      const sessionMessages = await messagesRepository.findAfter(sessionId, options?.afterMessageId ?? null);

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
       * The turn's analysis, read before the answer. Never rendered to the client: kept for
       * evals and offline reviews.
       */
      turnAnalysis?: TurnAnalysis;
      /** The diagnosis and the level of this turn's help, under a contract; kept for evals. */
      exerciseTurn?: { diagnosis: Diagnosis | null; hintLevel: number } | undefined;
      /** What the check before the student held back, and what replaced it; kept for evals. */
      outputCheck?: OutputCheckRecord | undefined;
      /** The categories input moderation flagged on the student's message; null when it could not answer. */
      inputModeration?: string[] | null | undefined;
      /** The turn answered with the fixed distress reply, and who saw the distress. */
      distress?: DistressSource | 'closed' | undefined;
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
      if (metadata.turnAnalysis) {
        messageMetadata['turnAnalysis'] = metadata.turnAnalysis;
      }
      if (metadata.exerciseTurn) {
        messageMetadata['exerciseTurn'] = metadata.exerciseTurn;
      }
      if (metadata.outputCheck) {
        messageMetadata['outputCheck'] = metadata.outputCheck;
      }
      if (metadata.inputModeration !== undefined) {
        messageMetadata['inputModeration'] = metadata.inputModeration;
      }
      if (metadata.distress) {
        messageMetadata['distress'] = metadata.distress;
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
        aiModel: this.mapAIModelName(metadata.aiModel),
        tokensUsed: metadata.tokensUsed ?? null,
        responseTimeMs: metadata.responseTimeMs ?? null,
        attachedFile: metadata.attachedFile ?? null,
        messageMetadata,
        modelMessages: metadata.modelMessages ?? null,
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
        aiModel: message.aiModel,
        timestamp: message.createdAt,
        tokensUsed: message.tokensUsed,
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
