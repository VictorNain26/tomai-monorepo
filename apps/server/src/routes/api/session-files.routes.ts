import { Elysia, t } from 'elysia';
import { authMacro } from '../../lib/auth-macro.js';
import { chatSessionService } from '../../services/chat/chat-session.service';
import { logger } from '../../lib/observability';

const sessionParams = t.Object({ id: t.String({ format: 'uuid' }) });
const sessionFileParams = t.Object({
  id: t.String({ format: 'uuid' }),
  fileId: t.String({ format: 'uuid' }),
});

export const sessionFilesApiRoutes = new Elysia({ name: 'api-session-files' })
  .use(authMacro)

  .guard({ auth: true })
  .get('/files', async ({ user, status }) => {
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
      return status(500, { error: 'Failed to list files' });
    }
  })

  .get('/chat/session/:id/files', async ({ params, user, status }) => {
    try {
      const session = await chatSessionService.getSessionForUser(params.id, user.id);
      if (!session) {
        return status(403, { error: 'Session not found or access denied' });
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
      return status(500, { error: 'Failed to list session files' });
    }
  }, { params: sessionParams })

  .post('/chat/session/:id/files', async ({ params, body, user, status }) => {
    try {
      const { fileId } = body;

      const session = await chatSessionService.getSessionForUser(params.id, user.id);
      if (!session) {
        return status(403, { error: 'Session not found or access denied' });
      }

      const { filesRepository, sessionFilesRepository } = await import('../../db/repositories/index');
      const file = await filesRepository.findById(fileId);
      if (!file || file.userId !== user.id) {
        return status(403, { error: 'File not found or access denied' });
      }

      const count = await sessionFilesRepository.countBySession(params.id);
      if (count >= 10) {
        return status(400, { error: 'Maximum 10 fichiers par session' });
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
      return status(500, { error: 'Failed to attach file' });
    }
  }, {
    params: sessionParams,
    body: t.Object({
      fileId: t.String({ format: 'uuid' }),
    }),
  })

  .delete('/chat/session/:id/files/:fileId', async ({ params, user, status }) => {
    try {
      const session = await chatSessionService.getSessionForUser(params.id, user.id);
      if (!session) {
        return status(403, { error: 'Session not found or access denied' });
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
      return status(500, { error: 'Failed to detach file' });
    }
  }, { params: sessionFileParams });
