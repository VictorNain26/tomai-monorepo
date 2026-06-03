import { Elysia } from 'elysia';
import { authMacro } from '../../lib/auth-macro';
import { progressService } from '../../services/progress.service';
import { logger } from '../../lib/observability';

export const progressApiRoutes = new Elysia({ name: 'api-progress' })
  .use(authMacro)

  .guard({ auth: true })
  .get('/progress/dashboard', async ({ user, set }) => {
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
      set.status = 500;
      return { _error: 'Progress retrieval failed' };
    }
  })

  .get('/rag/stats', async () => {
    try {
      const { qdrantService } = await import('../../services/qdrant.service.js');

      const isAvailable = await qdrantService.isAvailable();
      if (!isAvailable) {
        return {
          success: false,
          error: 'Qdrant service unavailable',
          healthy: false
        };
      }

      const stats = await qdrantService.getStats();

      return {
        success: true,
        healthy: true,
        collection: 'tomai_educational',
        totalPoints: stats.total_points,
        byNiveau: stats.by_niveau,
        byMatiere: stats.by_matiere
      };
    } catch (_error) {
      logger.error('RAG stats retrieval failed', {
        operation: 'api:rag:stats',
        _error: _error instanceof Error ? _error.message : String(_error),
        severity: 'medium' as const
      });
      return {
        success: false,
        error: 'Failed to retrieve RAG stats'
      };
    }
  });
