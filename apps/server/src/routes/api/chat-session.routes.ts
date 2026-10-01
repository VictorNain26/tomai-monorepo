import { Hono } from 'hono';
import { z } from 'zod';
import { requireUser, validate, type AppEnv } from '../../lib/http.js';
import { chatSessionService } from '../../services/chat/chat-session.service';
import { chatMessageService } from '../../services/chat/chat-message.service';
import { AppError } from '../../lib/errors';
import { logger } from '../../lib/observability';

const idParams = z.object({ id: z.uuid() });

export const chatSessionApiRoutes = new Hono<AppEnv>()

  /**
   * GET /chat/conversations - List all conversations for the user
   * Ordered by most recent activity. Supports pagination.
   */
  .get('/chat/conversations', requireUser, async (c) => {
    const user = c.var.user;
    try {
      const limit = Math.min(Number(c.req.query('limit')) || 20, 50);
      const offset = Math.max(Number(c.req.query('offset')) || 0, 0);

      const conversations = await chatSessionService.listConversations(user.id, { limit, offset });

      return c.json({
        success: true,
        conversations: conversations.map(conv => ({
          id: conv.id,
          title: conv.title,
          subject: conv.subject,
          status: conv.status,
          messageCount: conv.messageCount,
          lastMessagePreview: conv.lastMessagePreview,
          lastMessageRole: conv.lastMessageRole,
          lastActivityAt: conv.lastActivityAt.toISOString(),
          startedAt: conv.startedAt.toISOString(),
        })),
      });
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

  .get('/chat/sessions/latest', requireUser, async (c) => {
    const user = c.var.user;
    try {
      const sessions = await chatSessionService.getUserSessions(user.id, 1);
      const latestSession = sessions[0] ?? null;

      return c.json({
        success: true,
        session: latestSession ? {
          id: latestSession.id,
          subject: latestSession.subject,
          startedAt: latestSession.startedAt.toISOString(),
          endedAt: latestSession.endedAt?.toISOString() ?? null,
          messagesCount: latestSession.messagesCount
        } : null
      });
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

  .post('/chat/session', requireUser, async (c) => {
    const user = c.var.user;
    try {
      const sessionId = await chatSessionService.getOrCreateActiveSession(user.id);
      return c.json({ success: true, sessionId });
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
  .post('/chat/session/new', requireUser, async (c) => {
    const user = c.var.user;
    try {
      const sessionId = await chatSessionService.createSession(user.id, 'général');
      return c.json({ success: true, sessionId });
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

  .post('/chat/session/:id/reset', requireUser, validate('param', idParams), async (c) => {
    const user = c.var.user;
    const params = c.req.valid('param');
    try {
      const newSessionId = await chatSessionService.resetSession(params.id, user.id);
      return c.json({ success: true, sessionId: newSessionId });
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

  .delete('/chat/session/:id', requireUser, validate('param', idParams), async (c) => {
    const user = c.var.user;
    const params = c.req.valid('param');
    try {
      await chatSessionService.deleteSession(params.id, user.id);
      return c.json({ success: true, message: 'Session deleted successfully' });
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

  .get('/chat/session/:id/history', requireUser, validate('param', idParams), async (c) => {
    const user = c.var.user;
    const params = c.req.valid('param');
    try {
      const session = await chatSessionService.getSessionForUser(params.id, user.id);
      if (!session) {
        return c.json({ error: 'Session not found or access denied' }, 403);
      }

      const messages = await chatMessageService.getSessionHistory(params.id);

      // Detect orphan: last message is user with no assistant reply (crash recovery)
      const lastMessage = messages[messages.length - 1];
      const hasOrphanMessage = lastMessage?.role === 'user';

      return c.json({
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
      });
    } catch (_error) {
      logger.error('Session history retrieval failed', {
        operation: 'api:chat:session:history',
        userId: user.id,
        _error: _error instanceof Error ? _error.message : String(_error),
        severity: 'medium' as const
      });
      return c.json({ error: 'Session history retrieval failed' }, 500);
    }
  })

  .get('/chat/message/:id', requireUser, validate('param', idParams), async (c) => {
    const user = c.var.user;
    const params = c.req.valid('param');
    try {
      const message = await chatMessageService.getMessageById(params.id, user.id);

      if (!message) {
        throw new AppError('SESSION_NOT_FOUND', 'Message not found');
      }

      return c.json({
        success: true,
        id: message.id,
        role: message.role,
        content: message.content,
        timestamp: message.timestamp.toISOString(),
        sessionId: message.sessionId,
        aiModel: message.aiModel ?? null,
        attachedFile: message.attachedFile ?? null
      });
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
