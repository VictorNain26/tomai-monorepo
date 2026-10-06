import { usersRepository } from '../auth/index.js';
import { studySessionsRepository, type CreateStudySessionInput } from './study-sessions.repository.js';
import type { SchoolLevel } from '../../db/schema';
import { logger } from '../../platform/observability/logger';
import { deleteSessionCascade } from './session-cleanup';
import type { SessionDetails, UserSession, ConversationListItem } from './chat-types';

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
        err: error,
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

      // The postgres error is the cause of drizzle's: its code, table and constraint come with `err`.
      logger.error('Failed to create session', {
        operation: 'createSession',
        err: error,
        userId,
        subject,
        hasTopic: Boolean(topic),
        severity: 'high' as const
      });

      throw error;
    }
  }

  async getSession(sessionId: string): Promise<SessionDetails | null> {
    try {
      const session = await studySessionsRepository.findById(sessionId);
      if (!session) {
        return null;
      }

      return {
        id: session.id,
        userId: session.userId,
        subject: session.subject,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
      };
    } catch (_error) {
      logger.error('Error getting session', { operation: 'chat:session:get', err: _error, sessionId, severity: 'medium' as const });
      throw new Error('Failed to get session', { cause: _error });
    }
  }

  /**
   * Fetch a session only if it belongs to `userId`. Returns null when the
   * session is missing or owned by someone else — collapsing the
   * "not found" and "forbidden" cases so callers can't leak existence (IDOR).
   */
  async getSessionForUser(sessionId: string, userId: string): Promise<SessionDetails | null> {
    const session = await this.getSession(sessionId);
    return session?.userId === userId ? session : null;
  }

  async getSessionWithSummary(sessionId: string): Promise<{
    conversationSummary: string | null;
    summaryUpToMessageId: string | null;
    subject: string | null;
  } | null> {
    try {
      const session = await studySessionsRepository.findById(sessionId);
      if (!session) return null;

      return {
        conversationSummary: session.conversationSummary ?? null,
        summaryUpToMessageId: session.summaryUpToMessageId ?? null,
        subject: session.subject,
      };
    } catch (_error) {
      logger.error('Error getting session summary', {
        operation: 'chat:session:summary',
        err: _error,
        sessionId,
        severity: 'medium' as const
      });
      return null;
    }
  }

  async getUserSessions(userId: string, limit: number): Promise<UserSession[]> {
    try {
      const sessions = await studySessionsRepository.findByUserIdWithStats(userId, limit);

      const result = sessions.map(session => ({
        id: session.id,
        subject: session.subject,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        messagesCount: session.messageCount,
        lastActivity: session.endedAt ?? session.startedAt,
      }));

      return result;

    } catch (_error) {
      logger.error('Error getting user sessions', { operation: 'chat:sessions:list', err: _error, userId, severity: 'medium' as const });
      throw new Error('Failed to get user sessions', { cause: _error });
    }
  }

  /**
   * List sessions for conversation list UI.
   * Returns sessions with last message preview, ordered by recent activity.
   */
  async listConversations(userId: string, options: { limit?: number; offset?: number } = {}): Promise<ConversationListItem[]> {
    try {
      const sessions = await studySessionsRepository.findByUserIdWithLastMessage(userId, options);

      return sessions.map(session => ({
        id: session.id,
        title: session.topic ?? null,
        subject: session.subject,
        status: session.status,
        messageCount: session.messageCount,
        lastMessagePreview: session.lastMessageContent
          ? session.lastMessageContent.slice(0, 120) + (session.lastMessageContent.length > 120 ? '...' : '')
          : null,
        lastMessageRole: session.lastMessageRole as 'user' | 'assistant' | null,
        lastActivityAt: session.lastMessageAt ?? session.startedAt,
        startedAt: session.startedAt,
      }));
    } catch (_error) {
      logger.error('Error listing conversations', {
        operation: 'chat:conversations:list',
        err: _error,
        userId,
        severity: 'medium' as const,
      });
      throw new Error('Failed to list conversations', { cause: _error });
    }
  }

  async deleteSession(sessionId: string, userId?: string): Promise<void> {
    return deleteSessionCascade(sessionId, userId);
  }

  async resetSession(sessionId: string, userId: string): Promise<string> {
    try {
      const session = await studySessionsRepository.findById(sessionId);
      if (session?.userId !== userId) {
        throw new Error('Session not found or access denied');
      }

      await studySessionsRepository.update(sessionId, {
        status: 'completed',
        endedAt: new Date(),
      });

      const newSessionId = await this.createSession(userId, session.subject);

      logger.info('Session reset: archived old, created new', {
        operation: 'chat:session:reset',
        oldSessionId: sessionId,
        newSessionId,
        subject: session.subject,
      });

      return newSessionId;
    } catch (_error) {
      logger.error('Error resetting session', {
        operation: 'chat:session:reset',
        err: _error,
        sessionId,
        severity: 'medium' as const
      });
      throw new Error('Failed to reset session', { cause: _error });
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
        schoolLevel: user.schoolLevel,
        ...(user.firstName && { firstName: user.firstName })
      };
    } catch (_error) {
      logger.error('Error getting user by ID', { operation: 'chat:user:get', err: _error, userId, severity: 'medium' as const });
      throw new Error('Failed to get user', { cause: _error });
    }
  }
}

export const chatSessionService = new ChatSessionService();
