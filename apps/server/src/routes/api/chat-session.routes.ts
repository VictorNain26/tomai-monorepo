import { Elysia } from 'elysia';
import { handleAuthWithCookies } from '../../middleware/auth.middleware';
import { chatService } from '../../services/chat.service';
import { logger } from '../../lib/observability';

export const chatSessionApiRoutes = new Elysia({ name: 'api-chat-session' })

  .get('/chat/sessions/latest', async ({ request: { headers }, set }) => {
    const authContext = await handleAuthWithCookies(headers, set);
    if (!authContext.success) {
      return authContext.error;
    }

    try {
      const sessions = await chatService.getUserSessions(authContext.user.id, 1);
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
        userId: authContext.user.id,
        _error: _error instanceof Error ? _error.message : String(_error),
        severity: 'medium' as const
      });
      set.status = 500;
      return { _error: 'Latest session retrieval failed' };
    }
  })

  .post('/chat/session', async ({ request: { headers }, set }) => {
    const authContext = await handleAuthWithCookies(headers, set);
    if (!authContext.success) {
      return authContext.error;
    }

    try {
      const sessionId = await chatService.getOrCreateActiveSession(authContext.user.id);
      return { success: true, sessionId };
    } catch (_error) {
      logger.error('Session retrieval failed', {
        operation: 'api:chat:session:getOrCreate',
        userId: authContext.user.id,
        _error: _error instanceof Error ? _error.message : String(_error),
        severity: 'medium' as const
      });
      set.status = 500;
      return { _error: 'Session retrieval failed' };
    }
  })

  .post('/chat/session/:id/reset', async ({ params, request: { headers }, set }) => {
    const authContext = await handleAuthWithCookies(headers, set);
    if (!authContext.success) {
      return authContext.error;
    }

    try {
      const newSessionId = await chatService.resetSession(params.id, authContext.user.id);
      return { success: true, sessionId: newSessionId };
    } catch (_error) {
      logger.error('Session reset failed', {
        operation: 'api:chat:session:reset',
        userId: authContext.user.id,
        sessionId: params.id,
        _error: _error instanceof Error ? _error.message : String(_error),
        severity: 'medium' as const
      });
      set.status = 500;
      return { _error: 'Session reset failed' };
    }
  })

  .delete('/chat/session/:id', async ({ params, request: { headers }, set }) => {
    const authContext = await handleAuthWithCookies(headers, set);
    if (!authContext.success) {
      return authContext.error;
    }

    try {
      await chatService.deleteSession(params.id, authContext.user.id);
      return { success: true, message: 'Session deleted successfully' };
    } catch (_error) {
      logger.error('Session deletion failed', {
        operation: 'api:chat:session:delete',
        userId: authContext.user.id,
        _error: _error instanceof Error ? _error.message : String(_error),
        severity: 'medium' as const
      });
      set.status = 500;
      return { _error: 'Session deletion failed' };
    }
  })

  .get('/chat/session/:id/history', async ({ params, request: { headers }, set }) => {
    const authContext = await handleAuthWithCookies(headers, set);
    if (!authContext.success) {
      return authContext.error;
    }

    try {
      const messages = await chatService.getSessionHistory(params.id);
      return {
        success: true,
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
        userId: authContext.user.id,
        _error: _error instanceof Error ? _error.message : String(_error),
        severity: 'medium' as const
      });
      set.status = 500;
      return { _error: 'Session history retrieval failed' };
    }
  })

  .get('/chat/message/:id', async ({ params, request: { headers }, set }) => {
    const authContext = await handleAuthWithCookies(headers, set);
    if (!authContext.success) {
      return authContext.error;
    }

    try {
      const message = await chatService.getMessageById(params.id, authContext.user.id);

      if (!message) {
        set.status = 404;
        return { _error: 'Message not found' };
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
      logger.error('Message retrieval failed', {
        operation: 'api:chat:message',
        userId: authContext.user.id,
        _error: _error instanceof Error ? _error.message : String(_error),
        severity: 'medium' as const
      });
      set.status = 500;
      return { _error: 'Message retrieval failed' };
    }
  });
