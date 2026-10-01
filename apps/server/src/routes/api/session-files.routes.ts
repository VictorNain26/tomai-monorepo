import { Hono } from 'hono';
import { z } from 'zod';
import { requireUser, validate, type AppEnv } from '../../platform/http/context.js';
import { chatSessionService } from '../../services/chat/chat-session.service';
import { logger } from '../../platform/observability/logger';

const sessionParams = z.object({ id: z.uuid() });
const sessionFileParams = z.object({ id: z.uuid(), fileId: z.uuid() });
const attachBody = z.object({ fileId: z.uuid() });

export const sessionFilesApiRoutes = new Hono<AppEnv>()

  .get('/files', requireUser, async (c) => {
    const user = c.var.user;
    try {
      const { filesRepository } = await import('../../db/repositories/index');

      const userFiles = await filesRepository.findByUserId(user.id);
      return c.json({
        success: true,
        files: userFiles.map(f => {
          const eduCtx = f.educationalContext as {
            documentType?: string;
            subject?: string;
          } | null;
          return {
            id: f.id,
            fileName: f.fileName,
            mimeType: f.mimeType,
            sizeBytes: f.sizeBytes,
            documentType: eduCtx?.documentType ?? null,
            subject: eduCtx?.subject ?? null,
            createdAt: f.createdAt.toISOString(),
          };
        }),
      });
    } catch (_error) {
      logger.error('Files listing failed', {
        operation: 'api:files:list',
        userId: user.id,
        err: _error,
        severity: 'medium' as const
      });
      return c.json({ error: 'Failed to list files' }, 500);
    }
  })

  .get('/chat/session/:id/files', requireUser, validate('param', sessionParams), async (c) => {
    const user = c.var.user;
    const params = c.req.valid('param');
    try {
      const session = await chatSessionService.getSessionForUser(params.id, user.id);
      if (!session) {
        return c.json({ error: 'Session not found or access denied' }, 403);
      }

      const { sessionFilesRepository } = await import('../../db/repositories/index');
      const attachedFiles = await sessionFilesRepository.findBySession(params.id);

      return c.json({
        success: true,
        files: attachedFiles.map(f => ({
          id: f.fileId,
          fileName: f.fileName,
          mimeType: f.mimeType,
          sizeBytes: f.sizeBytes,
          attachedAt: f.attachedAt.toISOString(),
        })),
      });
    } catch (_error) {
      logger.error('Session files listing failed', {
        operation: 'api:chat:session:files:list',
        userId: user.id,
        err: _error,
        severity: 'medium' as const
      });
      return c.json({ error: 'Failed to list session files' }, 500);
    }
  })

  .post('/chat/session/:id/files', requireUser, validate('param', sessionParams), validate('json', attachBody), async (c) => {
    const user = c.var.user;
    const params = c.req.valid('param');
    try {
      const { fileId } = c.req.valid('json');

      const session = await chatSessionService.getSessionForUser(params.id, user.id);
      if (!session) {
        return c.json({ error: 'Session not found or access denied' }, 403);
      }

      const { filesRepository, sessionFilesRepository } = await import('../../db/repositories/index');
      const file = await filesRepository.findById(fileId);
      if (!file || file.userId !== user.id) {
        return c.json({ error: 'File not found or access denied' }, 403);
      }

      const count = await sessionFilesRepository.countBySession(params.id);
      if (count >= 10) {
        return c.json({ error: 'Maximum 10 fichiers par session' }, 400);
      }

      await sessionFilesRepository.attach(params.id, fileId);

      return c.json({ success: true });
    } catch (_error) {
      logger.error('Session file attach failed', {
        operation: 'api:chat:session:files:attach',
        userId: user.id,
        err: _error,
        severity: 'medium' as const
      });
      return c.json({ error: 'Failed to attach file' }, 500);
    }
  })

  .delete('/chat/session/:id/files/:fileId', requireUser, validate('param', sessionFileParams), async (c) => {
    const user = c.var.user;
    const params = c.req.valid('param');
    try {
      const session = await chatSessionService.getSessionForUser(params.id, user.id);
      if (!session) {
        return c.json({ error: 'Session not found or access denied' }, 403);
      }

      const { sessionFilesRepository } = await import('../../db/repositories/index');
      await sessionFilesRepository.detach(params.id, params.fileId);

      return c.json({ success: true });
    } catch (_error) {
      logger.error('Session file detach failed', {
        operation: 'api:chat:session:files:detach',
        userId: user.id,
        err: _error,
        severity: 'medium' as const
      });
      return c.json({ error: 'Failed to detach file' }, 500);
    }
  });
