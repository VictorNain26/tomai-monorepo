import { Elysia } from 'elysia';
import { logger } from '../../lib/observability';

export const educationApiRoutes = new Elysia({ name: 'api-education' })

  .get('/education/levels', async ({ status }) => {
    try {
      const { educationService } = await import('../../services/education.service.js');
      const levels = await educationService.getAvailableLevels();

      logger.info('Education levels retrieved', {
        operation: 'api:education:levels:success',
        total: levels.length,
        ragAvailable: levels.filter(l => l.ragAvailable).length,
        severity: 'low' as const
      });

      return {
        success: true,
        levels,
        total: levels.length,
        ragAvailableCount: levels.filter(l => l.ragAvailable).length
      };
    } catch (_error) {
      logger.error('Education levels retrieval failed', {
        operation: 'api:education:levels:error',
        _error: _error instanceof Error ? _error.message : String(_error),
        severity: 'high' as const
      });
      return status(500, { error: 'Curriculum service unavailable' });
    }
  });
