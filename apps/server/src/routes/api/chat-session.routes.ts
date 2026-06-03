import { Elysia } from 'elysia';
import { authMacro } from '../../lib/auth-macro';
import { chatService } from '../../services/chat.service';
import { AppError } from '../../lib/errors';
import { logger } from '../../lib/observability';

export const chatSessionApiRoutes = new Elysia({ name: 'api-chat-session' })
  .use(authMacro)
  .guard({ auth: true })

  /**
   * GET /chat/conversations - List all conversations for the user
   * Ordered by most recent activity. Supports pagination.
   */
  .get('/chat/conversations', async ({ user, query }) => {
    try {
      const limit = Math.min(Number(query?.limit) || 20, 50);
      const offset = Math.max(Number(query?.offset) || 0, 0);

      const conversations = await chatService.listConversations(user.id, { limit, offset });

      return {
        success: true,
        conversations: conversations.map(c => ({
          id: c.id,
          title: c.title,
          subject: c.subject,
          status: c.status,
          messageCount: c.messageCount,
          lastMessagePreview: c.lastMessagePreview,
          lastMessageRole: c.lastMessageRole,
          lastActivityAt: c.lastActivityAt.toISOString(),
          startedAt: c.startedAt.toISOString(),
        })),
      };
    } catch (_error) {
      logger.error('Conversations list failed', {
        operation: 'api:chat:conversations:list',
        userId: user.id,
        _error: _error instanceof Error ? _error.message : String(_error),
        severity: 'medium' as const,
      });
      throw new AppError('INTERNAL_ERROR', 'Conversations list failed');
    }
  })

  .get('/chat/sessions/latest', async ({ user }) => {
    try {
      const sessions = await chatService.getUserSessions(user.id, 1);
      const latestSession = sessions[0] ?? null;

      return {
        success: true,
        session: latestSession ? {
          id: latestSession.id,
          subject: latestSession.subject,
          startedAt: latestSession.startedAt.toISOString(),
          endedAt: latestSession.endedAt?.toISOString() ?? null,
          messagesCount: latestSession.messagesCount
        } : null
      };
    } catch (_error) {
      logger.error('Latest session retrieval failed', {
        operation: 'api:chat:sessions:latest',
        userId: user.id,
        _error: _error instanceof Error ? _error.message : String(_error),
        severity: 'medium' as const,
      });
      throw new AppError('INTERNAL_ERROR', 'Latest session retrieval failed');
    }
  })

  .post('/chat/session', async ({ user }) => {
    try {
      const sessionId = await chatService.getOrCreateActiveSession(user.id);
      return { success: true, sessionId };
    } catch (_error) {
      logger.error('Session retrieval failed', {
        operation: 'api:chat:session:getOrCreate',
        userId: user.id,
        _error: _error instanceof Error ? _error.message : String(_error),
        severity: 'medium' as const,
      });
      throw new AppError('INTERNAL_ERROR', 'Session retrieval failed');
    }
  })

  /**
   * POST /chat/session/new - Always create a new conversation
   * Used by the FAB button on conversations list.
   */
  .post('/chat/session/new', async ({ user }) => {
    try {
      const sessionId = await chatService.createSession(user.id, 'général');
      return { success: true, sessionId };
    } catch (_error) {
      logger.error('Session creation failed', {
        operation: 'api:chat:session:new',
        userId: user.id,
        _error: _error instanceof Error ? _error.message : String(_error),
        severity: 'medium' as const,
      });
      throw new AppError('INTERNAL_ERROR', 'Session creation failed');
    }
  })

  .post('/chat/session/:id/reset', async ({ params, user }) => {
    try {
      const newSessionId = await chatService.resetSession(params.id, user.id);
      return { success: true, sessionId: newSessionId };
    } catch (_error) {
      logger.error('Session reset failed', {
        operation: 'api:chat:session:reset',
        userId: user.id,
        sessionId: params.id,
        _error: _error instanceof Error ? _error.message : String(_error),
        severity: 'medium' as const,
      });
      throw new AppError('INTERNAL_ERROR', 'Session reset failed');
    }
  })

  .delete('/chat/session/:id', async ({ params, user }) => {
    try {
      await chatService.deleteSession(params.id, user.id);
      return { success: true, message: 'Session deleted successfully' };
    } catch (_error) {
      logger.error('Session deletion failed', {
        operation: 'api:chat:session:delete',
        userId: user.id,
        _error: _error instanceof Error ? _error.message : String(_error),
        severity: 'medium' as const,
      });
      throw new AppError('INTERNAL_ERROR', 'Session deletion failed');
    }
  })

  .get('/chat/session/:id/history', async ({ params, user, set }) => {
    try {
      const session = await chatService.getSession(params.id);
      if (!session || session.userId !== user.id) {
        set.status = 403;
        return { _error: 'Session not found or access denied' };
      }

      const messages = await chatService.getSessionHistory(params.id);

      // Detect orphan: last message is user with no assistant reply (crash recovery)
      const lastMessage = messages[messages.length - 1];
      const hasOrphanMessage = lastMessage?.role === 'user';

      return {
        success: true,
        hasOrphanMessage,
        messages: messages.map(m => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: m.createdAt.toISOString(),
          aiModel: m.aiModel ?? null,
          attachedFile: m.attachedFile ?? null
        }))
      };
    } catch (_error) {
      logger.error('Session history retrieval failed', {
        operation: 'api:chat:session:history',
        userId: user.id,
        _error: _error instanceof Error ? _error.message : String(_error),
        severity: 'medium' as const
      });
      set.status = 500;
      return { _error: 'Session history retrieval failed' };
    }
  })

  .get('/chat/message/:id', async ({ params, user }) => {
    try {
      const message = await chatService.getMessageById(params.id, user.id);

      if (!message) {
        throw new AppError('SESSION_NOT_FOUND', 'Message not found');
      }

      return {
        success: true,
        id: message.id,
        role: message.role,
        content: message.content,
        timestamp: message.timestamp.toISOString(),
        sessionId: message.sessionId,
        aiModel: message.aiModel ?? null,
        attachedFile: message.attachedFile ?? null
      };
    } catch (_error) {
      if (_error instanceof AppError) throw _error;
      logger.error('Message retrieval failed', {
        operation: 'api:chat:message',
        userId: user.id,
        _error: _error instanceof Error ? _error.message : String(_error),
        severity: 'medium' as const,
      });
      throw new AppError('INTERNAL_ERROR', 'Message retrieval failed');
    }
  });
