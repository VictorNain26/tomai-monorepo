import { eq } from 'drizzle-orm';
import { usersRepository, studySessionsRepository, messagesRepository, filesRepository, type CreateStudySessionInput } from '../../db/repositories';
import { db } from '../../db/connection';
import { messages } from '../../db/schema';
import type { SchoolLevel } from '../../db/schema';
import { safeUUID } from '../../utils/uuid';
import { logger } from '../../lib/observability';
import { deleteFile as deleteScalewayFile } from '../storage/scaleway-storage.service.js';
import type { SessionDetails, UserSession } from './chat-types';

export class ChatSessionService {
  async getOrCreateActiveSession(userId: string): Promise<string> {
    try {
      const existingSession = await studySessionsRepository.findActiveByUser(userId);

      if (existingSession) {
        logger.info('Resuming existing active session', {
          sessionId: existingSession.id,
          userId,
          operation: 'getOrCreateActiveSession:resume'
        });
        return existingSession.id;
      }

      return await this.createSession(userId, 'général');
    } catch (error) {
      logger.error('Failed to get or create active session', {
        _error: error instanceof Error ? error.message : String(error),
        userId,
        operation: 'getOrCreateActiveSession',
        severity: 'high' as const
      });
      throw error;
    }
  }

  async createSession(userId: string, subject: string, topic?: string): Promise<string> {
    try {
      const input: CreateStudySessionInput = {
        userId,
        subject,
        ...(topic && { topic })
      };

      const session = await studySessionsRepository.create(input);

      logger.info('Session created successfully', {
        sessionId: session.id,
        userId,
        subject,
        operation: 'createSession'
      });

      return session.id;

    } catch (_error) {
      const error = _error instanceof Error ? _error : new Error(String(_error));

      const pgError = _error as {
        code?: string;
        detail?: string;
        hint?: string;
        constraint?: string;
        table?: string;
        column?: string;
      };

      logger.error('Failed to create session', {
        operation: 'createSession',
        _error: error,
        userId,
        subject,
        topic,
        pgCode: pgError.code,
        pgDetail: pgError.detail,
        pgHint: pgError.hint,
        pgConstraint: pgError.constraint,
        pgTable: pgError.table,
        pgColumn: pgError.column,
        severity: 'high' as const
      });

      throw error;
    }
  }

  async updateSessionWithFiles(sessionId: string, fileData: {
    fileName: string;
    analysis: string;
    extractedText?: string;
    fileType: string;
    size: number;
    uploadedAt: string;
  }): Promise<void> {
    try {
      const validSessionId = safeUUID(sessionId);
      if (!validSessionId) {
        throw new Error(`Invalid session UUID: "${sessionId}"`);
      }

      const currentSession = await studySessionsRepository.findById(validSessionId);
      if (!currentSession) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      const currentMetadata = (currentSession.sessionMetadata as Record<string, unknown>) ?? {};

      if (!Array.isArray(currentMetadata.attachedFiles)) {
        currentMetadata.attachedFiles = [];
      }

      (currentMetadata.attachedFiles as Array<unknown>).push({
        fileName: fileData.fileName,
        analysis: fileData.analysis,
        extractedText: fileData.extractedText,
        fileType: fileData.fileType,
        size: fileData.size,
        uploadedAt: fileData.uploadedAt,
        analyzedAt: new Date().toISOString()
      });

      await studySessionsRepository.update(validSessionId, {
        sessionMetadata: currentMetadata
      });

      logger.info('Session updated with file analysis', {
        sessionId: validSessionId,
        fileName: fileData.fileName,
        operation: 'updateSessionWithFiles'
      });
    } catch (_error) {
      logger.error('Failed to update session with files', {
        _error: _error instanceof Error ? _error.message : String(_error),
        sessionId,
        fileName: fileData.fileName,
        operation: 'updateSessionWithFiles',
        severity: 'medium' as const
      });
      throw _error;
    }
  }

  async getSessionFiles(sessionId: string): Promise<Array<{
    fileName: string;
    analysis: string;
    extractedText?: string;
    fileType: string;
    analyzedAt: string;
  }>> {
    try {
      const validSessionId = safeUUID(sessionId);
      if (!validSessionId) {
        return [];
      }

      const session = await studySessionsRepository.findById(validSessionId);
      if (!session?.sessionMetadata) {
        return [];
      }

      const metadata = session.sessionMetadata as Record<string, unknown>;
      return Array.isArray(metadata.attachedFiles) ? metadata.attachedFiles : [];
    } catch (_error) {
      logger.error('Failed to get session files', {
        _error: _error instanceof Error ? _error.message : String(_error),
        sessionId,
        operation: 'getSessionFiles',
        severity: 'medium' as const
      });
      return [];
    }
  }

  async getSession(sessionId: string): Promise<SessionDetails | null> {
    try {
      const validSessionId = safeUUID(sessionId);
      if (!validSessionId) {
        logger.warn('Invalid session UUID provided', {
          operation: 'session:validation:uuid',
          sessionId,
          severity: 'low' as const
        });
        return null;
      }

      const session = await studySessionsRepository.findById(validSessionId);
      if (!session) {
        return null;
      }

      return {
        id: session.id,
        userId: session.userId,
        subject: session.subject,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        durationMinutes: session.durationMinutes,
        frustrationAvg: session.frustrationAvg ? parseFloat(session.frustrationAvg) : null,
        questionLevelsAvg: session.questionLevelsAvg ? parseFloat(session.questionLevelsAvg) : null,
        conceptsCovered: Array.isArray(session.conceptsCovered) ? session.conceptsCovered.join(', ') : session.conceptsCovered
      };
    } catch (_error) {
      logger.error('Error getting session', { operation: 'chat:session:get', _error: _error instanceof Error ? _error.message : String(_error), sessionId, severity: 'medium' as const });
      throw new Error('Failed to get session');
    }
  }

  async getSessionWithSummary(sessionId: string): Promise<{
    conversationSummary: string | null;
    summaryUpToMessageId: string | null;
  } | null> {
    try {
      const validSessionId = safeUUID(sessionId);
      if (!validSessionId) return null;

      const session = await studySessionsRepository.findById(validSessionId);
      if (!session) return null;

      return {
        conversationSummary: session.conversationSummary ?? null,
        summaryUpToMessageId: session.summaryUpToMessageId ?? null,
      };
    } catch (_error) {
      logger.error('Error getting session summary', {
        operation: 'chat:session:summary',
        _error: _error instanceof Error ? _error.message : String(_error),
        sessionId,
        severity: 'medium' as const
      });
      return null;
    }
  }

  async getUserSessions(userId: string, limit?: number): Promise<UserSession[]> {
    try {
      const sessions = await studySessionsRepository.findByUserIdWithStats(userId);

      const limitedSessions = limit ? sessions.slice(0, limit) : sessions;

      const result = limitedSessions.map(session => ({
        id: session.id,
        subject: session.subject,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        messagesCount: session.messageCount,
        lastActivity: session.endedAt ?? session.startedAt,
        frustrationAvg: parseFloat(session.frustrationAvg ?? '0')
      }));

      logger.info('User sessions retrieved', {
        userId,
        sessionCount: result.length,
        limit: limit ?? 'all',
        operation: 'getUserSessions'
      });
      return result;

    } catch (_error) {
      logger.error('Error getting user sessions', { operation: 'chat:sessions:list', _error: _error instanceof Error ? _error.message : String(_error), userId, severity: 'medium' as const });
      throw new Error('Failed to get user sessions');
    }
  }

  async deleteSession(sessionId: string, userId?: string): Promise<void> {
    try {
      const validSessionId = safeUUID(sessionId);
      if (!validSessionId) {
        throw new Error(`Invalid session UUID: "${sessionId}"`);
      }

      if (userId) {
        const session = await studySessionsRepository.findById(validSessionId);
        if (!session || session.userId !== userId) {
          throw new Error('Session not found or access denied');
        }
      }

      const sessionMessages = await messagesRepository.findBySessionId(validSessionId);

      const fileIds: string[] = [];
      for (const msg of sessionMessages) {
        if (msg.attachedFile && typeof msg.attachedFile === 'object' && 'fileId' in msg.attachedFile) {
          const fileId = (msg.attachedFile as { fileId?: string }).fileId;
          if (fileId) {
            fileIds.push(fileId);
          }
        }
      }

      if (fileIds.length > 0) {
        logger.info('Deleting files associated with session', {
          operation: 'chat:session:delete:files',
          sessionId: validSessionId,
          fileCount: fileIds.length,
        });

        for (const fileId of fileIds) {
          const file = await filesRepository.findById(fileId);
          if (file) {
            await deleteScalewayFile(file.storageKey);
            await filesRepository.hardDelete(fileId);
          }
        }
      }

      await db.delete(messages).where(eq(messages.sessionId, validSessionId));
      await studySessionsRepository.deleteById(validSessionId);

      logger.info('Session deleted successfully', {
        operation: 'chat:session:delete',
        sessionId: validSessionId,
        filesDeleted: fileIds.length,
      });
    } catch (_error) {
      logger.error('Error deleting session', { operation: 'chat:session:delete', _error: _error instanceof Error ? _error.message : String(_error), sessionId, severity: 'medium' as const });
      throw new Error('Failed to delete session');
    }
  }

  async resetSession(sessionId: string, userId: string): Promise<string> {
    try {
      const validSessionId = safeUUID(sessionId);
      if (!validSessionId) {
        throw new Error(`Invalid session UUID: "${sessionId}"`);
      }

      const session = await studySessionsRepository.findById(validSessionId);
      if (!session || session.userId !== userId) {
        throw new Error('Session not found or access denied');
      }

      await studySessionsRepository.update(validSessionId, {
        status: 'completed',
        endedAt: new Date(),
      });

      const newSessionId = await this.createSession(userId, session.subject);

      logger.info('Session reset: archived old, created new', {
        operation: 'chat:session:reset',
        oldSessionId: validSessionId,
        newSessionId,
        subject: session.subject,
      });

      return newSessionId;
    } catch (_error) {
      logger.error('Error resetting session', {
        operation: 'chat:session:reset',
        _error: _error instanceof Error ? _error.message : String(_error),
        sessionId,
        severity: 'medium' as const
      });
      throw new Error('Failed to reset session');
    }
  }

  async getUserById(userId: string): Promise<{ id: string; schoolLevel: SchoolLevel; firstName?: string } | null> {
    try {
      const user = await usersRepository.findById(userId);
      if (!user) {
        return null;
      }

      if (!user.schoolLevel) {
        throw new Error(`Utilisateur ${userId} n'a pas de niveau scolaire défini - inscription incomplète`);
      }

      return {
        id: user.id,
        schoolLevel: user.schoolLevel as SchoolLevel,
        ...(user.firstName && { firstName: user.firstName })
      };
    } catch (_error) {
      logger.error('Error getting user by ID', { operation: 'chat:user:get', _error: _error instanceof Error ? _error.message : String(_error), userId, severity: 'medium' as const });
      throw new Error('Failed to get user');
    }
  }
}
