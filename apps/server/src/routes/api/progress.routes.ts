import { Hono } from 'hono';
import { requireUser, type AppEnv } from '../../platform/http/context.js';
import { progressService } from '../../services/progress.service';
import { logger } from '../../platform/observability/logger';

export const progressApiRoutes = new Hono<AppEnv>()

  .get('/progress/dashboard', requireUser, async (c) => {
    const user = c.var.user;
    try {
      const stats = await progressService.getStudentStats(user.id);
      return c.json({
        success: true,
        student: {
          id: user.id,
          firstName: user.firstName,
          level: user.schoolLevel
        },
        stats: {
          totalSessions: stats.totalSessions,
          totalStudyTime: stats.totalStudyTime,
          conceptsLearned: stats.conceptsLearned,
          averageFrustration: stats.averageFrustration
        }
      });
    } catch (_error) {
      logger.error('Progress dashboard retrieval failed', {
        operation: 'api:progress:dashboard',
        userId: user.id,
        err: _error,
        severity: 'medium' as const
      });
      return c.json({ error: 'Progress retrieval failed' }, 500);
    }
  });
