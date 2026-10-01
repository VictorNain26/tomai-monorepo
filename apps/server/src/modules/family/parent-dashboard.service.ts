import { getStudyStats } from '../tutor/index.js';
import { logger } from '../../platform/observability/logger';
import type { ChildInfo, ParentDashboardMetrics } from './parent-types';

export class ParentDashboardService {
  async getParentDashboardMetrics(
    parentId: string,
    getChildren: (parentId: string) => Promise<ChildInfo[]>
  ): Promise<ParentDashboardMetrics[]> {
    try {
      const children = await getChildren(parentId);
      if (children.length === 0) {
        return [];
      }

      const metrics = await Promise.all(
        children.map(async (child): Promise<ParentDashboardMetrics> => {
          try {
            const stats = await getStudyStats(child.id);

            return {
              studentId: child.id,
              studentName: `${child.firstName} ${child.lastName}`,
              schoolLevel: child.schoolLevel ?? 'Not defined',
              age: child.dateOfBirth ? this.calculateAge(new Date(child.dateOfBirth)) : 0,
              totalSessions: stats.totalSessions,
              studyDays: stats.studyDays,
              avgSessionDuration: stats.totalSessions > 0
                ? stats.totalMinutes / stats.totalSessions
                : 0,
              avgFrustration: stats.averageFrustration,
              subjectsStudied: Object.keys(stats.subjectBreakdown).length,
              totalStudyTime: stats.totalMinutes,
              lastSessionDate: stats.lastSessionDate,
            };
          } catch (childError) {
            logger.error('Critical error fetching child metrics', { operation: 'parent:dashboard:child', err: childError, childId: child.id, parentId, severity: 'high' as const });
            throw new Error(`Impossible de récupérer les métriques pour l'enfant ${child.id}: ${(childError as Error).message}`, { cause: childError });
          }
        }),
      );

      return metrics;
    } catch (_error) {
      logger.error('Error getting parent dashboard metrics', { operation: 'parent:dashboard:get', err: _error, parentId, severity: 'high' as const });
      throw new Error('Failed to get parent dashboard metrics', { cause: _error });
    }
  }

  calculateAge(dateOfBirth: Date): number {
    const today = new Date();
    const birth = new Date(dateOfBirth);
    let age = today.getFullYear() - birth.getFullYear();

    const monthDay = today.getMonth() * 100 + today.getDate();
    const birthMonthDay = birth.getMonth() * 100 + birth.getDate();

    if (monthDay < birthMonthDay) {
      age--;
    }

    return age;
  }
}
