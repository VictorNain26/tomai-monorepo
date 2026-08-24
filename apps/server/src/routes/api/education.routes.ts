import { Elysia } from 'elysia';
import { logger } from '../../lib/observability';
import { educationService } from '../../services/education.service';

export const educationApiRoutes = new Elysia({ name: 'api-education' })

  .get('/education/levels', () => {
    const levels = educationService.getAvailableLevels();

    logger.info('Education levels retrieved', {
      operation: 'api:education:levels:success',
      total: levels.length,
      availableCount: levels.filter(l => l.available).length,
      severity: 'low' as const
    });

    return {
      success: true,
      levels,
      total: levels.length,
      availableCount: levels.filter(l => l.available).length
    };
  });
