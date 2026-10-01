import { Hono } from 'hono';
import { requireUser, type AppEnv } from '../../lib/http.js';
import { progressService } from '../../services/progress.service';
import { logger } from '../../lib/observability';

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
        _error: _error instanceof Error ? _error.message : String(_error),
        severity: 'medium' as const
      });
      return c.json({ error: 'Progress retrieval failed' }, 500);
    }
  });
