import { Elysia } from 'elysia';
import { authMacro } from '../../lib/auth-macro.js';
import { progressService } from '../../services/progress.service';
import { logger } from '../../lib/observability';

export const progressApiRoutes = new Elysia({ name: 'api-progress' })
  .use(authMacro)

  .guard({ auth: true })
  .get('/progress/dashboard', async ({ user, status }) => {
    try {
      const stats = await progressService.getStudentStats(user.id);
      return {
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
      };
    } catch (_error) {
      logger.error('Progress dashboard retrieval failed', {
        operation: 'api:progress:dashboard',
        userId: user.id,
        _error: _error instanceof Error ? _error.message : String(_error),
        severity: 'medium' as const
      });
      return status(500, { error: 'Progress retrieval failed' });
    }
  });
