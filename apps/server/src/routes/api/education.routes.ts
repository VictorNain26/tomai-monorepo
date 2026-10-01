import { Hono } from 'hono';
import type { AppEnv } from '../../lib/http.js';
import { logger } from '../../lib/observability';
import { educationService } from '../../services/education.service';

export const educationApiRoutes = new Hono<AppEnv>()

  .get('/education/levels', (c) => {
    const levels = educationService.getAvailableLevels();

    logger.info('Education levels retrieved', {
      operation: 'api:education:levels:success',
      total: levels.length,
      availableCount: levels.filter(l => l.available).length,
      severity: 'low' as const
    });

    return c.json({
      success: true,
      levels,
      total: levels.length,
      availableCount: levels.filter(l => l.available).length
    });
  });
