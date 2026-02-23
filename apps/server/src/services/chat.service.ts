/**
 * Chat Service - Modern implementation using Drizzle ORM
 * Handles sessions, messages, and chat-related operations
 */

import { eq } from 'drizzle-orm';
import { usersRepository, studySessionsRepository, messagesRepository, filesRepository, type CreateStudySessionInput } from '../db/repositories';
import { db } from '../db/connection';
import { messages } from '../db/schema';
import type { Message as DbMessage, SchoolLevel, AIModel } from '../db/schema';
import { safeUUID } from '../utils/uuid';
import { logger } from '../lib/observability';
import { deleteFile as deleteScalewayFile } from './storage/scaleway-storage.service.js';

export interface SessionDetails {
  id: string;
  userId: string;
  subject: string;
  startedAt: Date;
  endedAt: Date | null;
  durationMinutes: number | null;
  frustrationAvg: number | null;
  questionLevelsAvg: number | null;
  conceptsCovered: string | null;
}

export interface MessageDetails {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  frustrationLevel: number | null;
  questionLevel: number | null;
  aiModel: string | null;
  isFallback: boolean;
  timestamp: Date;
  tokensUsed: number | null;
  costEstimate: number | null;
  attachedFile?: {
    fileName: string;
    fileId?: string;
    geminiFileId?: string;
    mimeType?: string;
    fileSizeBytes?: number;
  } | null;
}

export interface ProgressUpdate {
  userId: string;
  subject: string;
  concept: string;
  masteryLevel: number;
  practiceTime: number;
  successRate: number;
}

export interface UserSession {
  id: string;
  subject: string;
  startedAt: Date;
  endedAt: Date | null;
  messagesCount: number;
  lastActivity: Date;
  frustrationAvg: number;
}

export class ChatService {
  /**
   * Get existing active session for user (any subject), or create a new one
   * Pattern: Chat unique multi-matière
   */
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

  /**
   * Create a new active session in database
   */
  async createSession(userId: string, subject: string, topic?: string): Promise<string> {
    try {
      const input: CreateStudySessionInput = {
        userId,
        subject,
        ...(topic && { topic })
      };

      // Drizzle applique automatiquement tous les defaults du schema :
      // - id: defaultRandom()
      // - status: default('active')
      // - startedAt: defaultNow()
      // - aiModelUsed: default('gemini_3_flash')
      // - frustrationAvg, questionLevelsAvg, etc.: default('0')
      // - conceptsCovered: default(sql`'{}'::text[]`)
      // - sessionMetadata: default({})
      // - createdAt, updatedAt: defaultNow()
      const session = await studySessionsRepository.create(input);

      logger.info('Session created successfully', {
        sessionId: session.id,
        userId,
        subject,
        operation: 'createSession'
      });

      return session.id;

    } catch (_error) {
      // CRITICAL: PostgreSQL error detailed logging
      const error = _error instanceof Error ? _error : new Error(String(_error));

      // PostgreSQL errors have specific properties
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
        _error: error, // ✅ Full Error object avec stack
        userId,
        subject,
        topic,
        // PostgreSQL specific error details
        pgCode: pgError.code,
        pgDetail: pgError.detail,
        pgHint: pgError.hint,
        pgConstraint: pgError.constraint,
        pgTable: pgError.table,
        pgColumn: pgError.column,
        severity: 'high' as const
      });

      // Re-throw original error pour préserver stack trace
      throw error;
    }
  }

  /**
   * Update session metadata with analyzed files
   */
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

      // Récupérer les métadonnées actuelles
      const currentSession = await studySessionsRepository.findById(validSessionId);
      if (!currentSession) {
        throw new Error(`Session not found: ${sessionId}`);
      }

      // Récupérer les métadonnées existantes ou initialiser
      const currentMetadata = (currentSession.sessionMetadata as Record<string, unknown>) ?? {};

      // Initialiser le tableau de fichiers s'il n'existe pas
      if (!Array.isArray(currentMetadata.attachedFiles)) {
        currentMetadata.attachedFiles = [];
      }

      // Ajouter le nouveau fichier analysé
      (currentMetadata.attachedFiles as Array<unknown>).push({
        fileName: fileData.fileName,
        analysis: fileData.analysis,
        extractedText: fileData.extractedText,
        fileType: fileData.fileType,
        size: fileData.size,
        uploadedAt: fileData.uploadedAt,
        analyzedAt: new Date().toISOString()
      });

      // Mettre à jour la session
      // Note: updatedAt est géré automatiquement par le repository
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

  /**
   * Get session files for context in AI responses
   */
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

  /**
   * Get session details by ID with UUID validation
   */
  async getSession(sessionId: string): Promise<SessionDetails | null> {
    try {
      // Valider l'UUID avant la requête
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

  /**
   * Get session summary data for SummaryBuffer pattern
   */
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

  /**
   * Get session message history with UUID validation
   * Options permettent de limiter le nombre de messages pour l'historique conversationnel
   * MAIS gardent tous les fichiers pour maintenir le contexte complet
   *
   * afterMessageId: Si fourni, ne retourne que les messages APRÈS ce message ID
   * (utilisé avec SummaryBuffer pour ne charger que les messages récents)
   */
  async getSessionHistory(sessionId: string, options?: { limit?: number; afterMessageId?: string }): Promise<DbMessage[]> {
    try {
      // Valider l'UUID avant la requête
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

      // Filtrer par afterMessageId si fourni (SummaryBuffer: ne garder que les récents)
      if (options?.afterMessageId) {
        const cutoffIndex = sessionMessages.findIndex(m => m.id === options.afterMessageId);
        if (cutoffIndex !== -1) {
          sessionMessages = sessionMessages.slice(cutoffIndex + 1);
        }
      }

      // Si limite spécifiée, l'appliquer MAIS garder TOUS les messages avec fichiers
      if (options?.limit && sessionMessages.length > options.limit) {
        // Séparer les messages avec et sans fichiers pour prioriser le contexte fichier
        const messagesWithFiles = sessionMessages.filter(msg => msg.attachedFile !== null);
        const messagesWithoutFiles = sessionMessages.filter(msg => msg.attachedFile === null);

        // Prendre les derniers messages sans fichiers selon la limite
        const recentMessages = messagesWithoutFiles.slice(-options.limit);

        // Combiner avec TOUS les messages contenant des fichiers (pas de limite)
        const combinedMessages = [...messagesWithFiles, ...recentMessages];

        // Trier par date de création pour maintenir l'ordre chronologique
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

  /**
   * Get user sessions with messages
   * @param userId - User ID
   * @param limit - Optional limit on number of sessions to return
   */
  async getUserSessions(userId: string, limit?: number): Promise<UserSession[]> {
    try {
      // Get all sessions with their message counts
      const sessions = await studySessionsRepository.findByUserIdWithStats(userId);

      // Retourner les sessions (limitées si spécifié)
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

  /**
   * Save a message to an existing session
   * Pattern propre : Session must be created explicitly via createSession() first
   */
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
    }
  ): Promise<{ messageId: string; realSessionId: string }> {
    try {
      // Valider UUID de session (pattern propre : fail fast si invalide)
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

      // Vérifier que la session existe
      // Pattern propre : Sessions doivent être créées explicitement via createSession()
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
        messageMetadata: {},
        createdAt: new Date()
      });
      
      return { messageId: message.id, realSessionId: validSessionId };
    } catch (_error) {
      logger.error('Error saving message', { operation: 'chat:message:save', _error: _error instanceof Error ? _error.message : String(_error), sessionId, role, severity: 'high' as const });
      throw new Error('Failed to save message');
    }
  }

  /**
   * Delete a session and its messages with UUID validation
   * Also deletes associated files from Scaleway storage
   */
  async deleteSession(sessionId: string, userId?: string): Promise<void> {
    try {
      // Valider l'UUID avant la requête
      const validSessionId = safeUUID(sessionId);
      if (!validSessionId) {
        throw new Error(`Invalid session UUID: "${sessionId}"`);
      }

      // Vérifier que la session appartient à l'utilisateur si userId fourni
      if (userId) {
        const session = await studySessionsRepository.findById(validSessionId);
        if (!session || session.userId !== userId) {
          throw new Error('Session not found or access denied');
        }
      }

      // Récupérer les messages pour extraire les fileIds
      const sessionMessages = await messagesRepository.findBySessionId(validSessionId);

      // Extraire les fileIds des messages avec fichiers attachés
      const fileIds: string[] = [];
      for (const msg of sessionMessages) {
        if (msg.attachedFile && typeof msg.attachedFile === 'object' && 'fileId' in msg.attachedFile) {
          const fileId = (msg.attachedFile as { fileId?: string }).fileId;
          if (fileId) {
            fileIds.push(fileId);
          }
        }
      }

      // Supprimer les fichiers de Scaleway et de la base de données
      if (fileIds.length > 0) {
        logger.info('Deleting files associated with session', {
          operation: 'chat:session:delete:files',
          sessionId: validSessionId,
          fileCount: fileIds.length,
        });

        for (const fileId of fileIds) {
          const file = await filesRepository.findById(fileId);
          if (file) {
            // Supprimer de Scaleway
            await deleteScalewayFile(file.storageKey);
            // Supprimer de la base de données
            await filesRepository.hardDelete(fileId);
          }
        }
      }

      // Delete all messages (due to foreign key constraint)
      await db.delete(messages).where(eq(messages.sessionId, validSessionId));

      // Delete the session
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

  /**
   * Reset a session: archive the old one and create a new one
   * Preserves history for parent visibility
   * @returns The new session ID
   */
  async resetSession(sessionId: string, userId: string): Promise<string> {
    try {
      const validSessionId = safeUUID(sessionId);
      if (!validSessionId) {
        throw new Error(`Invalid session UUID: "${sessionId}"`);
      }

      // Vérifier que la session appartient à l'utilisateur
      const session = await studySessionsRepository.findById(validSessionId);
      if (!session || session.userId !== userId) {
        throw new Error('Session not found or access denied');
      }

      // Archiver l'ancienne session (status: completed)
      await studySessionsRepository.update(validSessionId, {
        status: 'completed',
        endedAt: new Date(),
      });

      // Créer une nouvelle session active pour la même matière
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

  /**
   * Map AI model names from providers to database TEXT field
   * Architecture 2025: TEXT au lieu d'ENUM pour flexibilité
   */
  private mapAIModelName(modelName?: string | null): AIModel | null {
    return modelName ?? null;
  }

  /**
   * Get a message by ID with user authorization
   */
  async getMessageById(messageId: string, userId: string): Promise<MessageDetails | null> {
    try {
      // Valider l'UUID du message
      const validMessageId = safeUUID(messageId);
      if (!validMessageId) {
        logger.warn('Invalid message UUID provided', {
          operation: 'message:validation:uuid',
          messageId,
          severity: 'low' as const
        });
        return null;
      }

      // Récupérer le message
      const message = await messagesRepository.findById(validMessageId);
      if (!message) {
        return null;
      }

      // Vérifier que la session appartient à l'utilisateur
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
        role: message.role as 'user' | 'assistant', // Cast pour le type union
        content: message.content,
        frustrationLevel: message.frustrationLevel,
        questionLevel: message.questionLevel,
        aiModel: message.aiModel,
        isFallback: false, // Pas dans le schéma, utiliser false par défaut
        timestamp: message.createdAt,
        tokensUsed: message.tokensUsed,
        costEstimate: null, // Pas dans le schéma, utiliser null par défaut
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

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<{ id: string; schoolLevel: SchoolLevel; firstName?: string } | null> {
    try {
      const user = await usersRepository.findById(userId);
      if (!user) {
        return null;
      }

      // Validation stricte : un utilisateur DOIT avoir un niveau scolaire
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

// Export singleton instance
export const chatService = new ChatService();