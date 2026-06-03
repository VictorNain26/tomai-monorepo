import { Elysia, t } from 'elysia';
import { authMacro } from '../../lib/auth-macro';
import { chatService } from '../../services/chat.service';
import { logger } from '../../lib/observability';

export const sessionFilesApiRoutes = new Elysia({ name: 'api-session-files' })
  .use(authMacro)

  .guard({ auth: true })
  .get('/files', async ({ user, set }) => {
    try {
      const { filesRepository } = await import('../../db/repositories/index');

      const userFiles = await filesRepository.findByUserId(user.id);
      return {
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
      };
    } catch (_error) {
      logger.error('Files listing failed', {
        operation: 'api:files:list',
        userId: user.id,
        _error: _error instanceof Error ? _error.message : String(_error),
        severity: 'medium' as const
      });
      set.status = 500;
      return { error: 'Failed to list files' };
    }
  })

  .get('/chat/session/:id/files', async ({ params, user, set }) => {
    try {
      const session = await chatService.getSession(params.id);
      if (!session || session.userId !== user.id) {
        set.status = 403;
        return { error: 'Session not found or access denied' };
      }

      const { sessionFilesRepository } = await import('../../db/repositories/index');
      const attachedFiles = await sessionFilesRepository.findBySession(params.id);

      return {
        success: true,
        files: attachedFiles.map(f => ({
          id: f.fileId,
          fileName: f.fileName,
          mimeType: f.mimeType,
          sizeBytes: f.sizeBytes,
          attachedAt: f.attachedAt.toISOString(),
        })),
      };
    } catch (_error) {
      logger.error('Session files listing failed', {
        operation: 'api:chat:session:files:list',
        userId: user.id,
        _error: _error instanceof Error ? _error.message : String(_error),
        severity: 'medium' as const
      });
      set.status = 500;
      return { error: 'Failed to list session files' };
    }
  })

  .post('/chat/session/:id/files', async ({ params, body, user, set }) => {
    try {
      const { fileId } = body;

      const session = await chatService.getSession(params.id);
      if (!session || session.userId !== user.id) {
        set.status = 403;
        return { error: 'Session not found or access denied' };
      }

      const { filesRepository, sessionFilesRepository } = await import('../../db/repositories/index');
      const file = await filesRepository.findById(fileId);
      if (!file || file.userId !== user.id) {
        set.status = 403;
        return { error: 'File not found or access denied' };
      }

      const count = await sessionFilesRepository.countBySession(params.id);
      if (count >= 10) {
        set.status = 400;
        return { error: 'Maximum 10 fichiers par session' };
      }

      await sessionFilesRepository.attach(params.id, fileId);

      return { success: true };
    } catch (_error) {
      logger.error('Session file attach failed', {
        operation: 'api:chat:session:files:attach',
        userId: user.id,
        _error: _error instanceof Error ? _error.message : String(_error),
        severity: 'medium' as const
      });
      set.status = 500;
      return { error: 'Failed to attach file' };
    }
  }, {
    body: t.Object({
      fileId: t.String({ minLength: 1, maxLength: 100 }),
    }),
  })

  .delete('/chat/session/:id/files/:fileId', async ({ params, user, set }) => {
    try {
      const session = await chatService.getSession(params.id);
      if (!session || session.userId !== user.id) {
        set.status = 403;
        return { error: 'Session not found or access denied' };
      }

      const { sessionFilesRepository } = await import('../../db/repositories/index');
      await sessionFilesRepository.detach(params.id, params.fileId);

      return { success: true };
    } catch (_error) {
      logger.error('Session file detach failed', {
        operation: 'api:chat:session:files:detach',
        userId: user.id,
        _error: _error instanceof Error ? _error.message : String(_error),
        severity: 'medium' as const
      });
      set.status = 500;
      return { error: 'Failed to detach file' };
    }
  });
