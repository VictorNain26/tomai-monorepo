import { Hono } from 'hono';
import { requireUser, type AppEnv } from '../../platform/http/context.js';
import { progressRepository } from '../../db/repositories';
import { getStudyStats } from './study-stats.js';
import { logger } from '../../platform/observability/logger';

export const progressRoutes = new Hono<AppEnv>()

  .get('/progress/dashboard', requireUser, async (c) => {
    const user = c.var.user;
    try {
      const [sessionStats, progressSummary] = await Promise.all([
        getStudyStats(user.id),
        progressRepository.getProgressSummary(user.id),
      ]);
      return c.json({
        success: true,
        student: {
          id: user.id,
          firstName: user.firstName,
          level: user.schoolLevel
        },
        stats: {
          totalSessions: sessionStats.totalSessions,
          totalStudyTime: sessionStats.totalMinutes,
          conceptsLearned: progressSummary.totalConcepts,
          averageFrustration: sessionStats.averageFrustration
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
