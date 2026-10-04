import { Hono } from 'hono';
import { requireUser, type AppEnv } from '../../platform/http/context.js';
import { logger } from '../../platform/observability/logger';
import { filesRepository } from './files.repository.js';

export const filesRoutes = new Hono<AppEnv>()

  .get('/files', requireUser, async (c) => {
    const user = c.var.user;
    try {
      const userFiles = await filesRepository.findByUserId(user.id);
      return c.json({
        success: true,
        files: userFiles.map(f => {
          const eduCtx = f.educationalContext as { subject?: string } | null;
          return {
            id: f.id,
            fileName: f.fileName,
            mimeType: f.mimeType,
            sizeBytes: f.sizeBytes,
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
  });
