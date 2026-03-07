import { sql, eq, desc } from 'drizzle-orm';
import { studySessionsRepository, messagesRepository, progressRepository } from '../../db/repositories';
import { db } from '../../db/connection';
import { studySessions } from '../../db/schema';
import { logger } from '../../lib/observability';
import { withPoolLimit } from '../../db/pool-limiter.js';
import type { ChildInfo, ParentDashboardMetrics, StudentProgress, SessionSummary, SessionMessage } from './parent-types';

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

      const metrics: ParentDashboardMetrics[] = [];

      for (const child of children) {
        try {
          const sessionStats = await studySessionsRepository.getSessionStats(child.id);

          const [subjectsResult, lastSessionResult, studyDaysResult] = await Promise.all([
            withPoolLimit(
              () => db
                .selectDistinct({ subject: studySessions.subject })
                .from(studySessions)
                .where(eq(studySessions.userId, child.id)),
              `subjects-${child.id}`
            ),
            withPoolLimit(
              () => db
                .select({ startedAt: studySessions.startedAt })
                .from(studySessions)
                .where(eq(studySessions.userId, child.id))
                .orderBy(desc(studySessions.startedAt))
                .limit(1),
              `last-session-${child.id}`
            ),
            withPoolLimit(
              () => db
                .select({
                  studyDays: sql<number>`COUNT(DISTINCT DATE(${studySessions.startedAt}))::int`
                })
                .from(studySessions)
                .where(eq(studySessions.userId, child.id)),
              `study-days-${child.id}`
            )
          ]);

          metrics.push({
            studentId: child.id,
            studentName: `${child.firstName} ${child.lastName}`,
            schoolLevel: child.schoolLevel ?? 'Not defined',
            age: child.dateOfBirth ? this.calculateAge(new Date(child.dateOfBirth)) : 0,
            totalSessions: sessionStats.totalSessions,
            studyDays: studyDaysResult[0]?.studyDays ?? 0,
            avgSessionDuration: sessionStats.totalSessions > 0
              ? sessionStats.totalMinutes / sessionStats.totalSessions
              : 0,
            avgFrustration: sessionStats.averageFrustration,
            subjectsStudied: subjectsResult.length,
            totalStudyTime: sessionStats.totalMinutes,
            lastSessionDate: lastSessionResult[0]?.startedAt ?? null,
          });
        } catch (childError) {
          logger.error('Critical error fetching child metrics', { operation: 'parent:dashboard:child', _error: (childError as Error).message, childId: child.id, parentId, severity: 'high' as const });
          throw new Error(`Impossible de récupérer les métriques pour l'enfant ${child.id}: ${(childError as Error).message}`);
        }
      }

      return metrics;
    } catch (_error) {
      logger.error('Error getting parent dashboard metrics', { operation: 'parent:dashboard:get', _error: _error instanceof Error ? _error.message : String(_error), parentId, severity: 'high' as const });
      throw new Error('Failed to get parent dashboard metrics');
    }
  }

  async getParentStudentProgress(
    parentId: string,
    getChildren: (parentId: string) => Promise<ChildInfo[]>,
    studentId?: string,
    cachedChildren?: ChildInfo[]
  ): Promise<StudentProgress[]> {
    try {
      const children = cachedChildren ?? await getChildren(parentId);

      const targetChildren = studentId
        ? children.filter(child => child.id === studentId)
        : children;

      if (targetChildren.length === 0) {
        return [];
      }

      const progressData: StudentProgress[] = [];

      for (const child of targetChildren) {
        const summary = await progressRepository.getProgressSummary(child.id);

        for (const subjectProgress of summary.subjectProgress) {
          progressData.push({
            studentId: child.id,
            studentName: `${child.firstName} ${child.lastName}`,
            subject: subjectProgress.subject,
            conceptsMastered: subjectProgress.conceptCount,
            avgMastery: subjectProgress.averageMastery,
            avgSuccessRate: subjectProgress.averageMastery * 0.8,
            totalPracticeTime: subjectProgress.totalPracticeTime,
            lastPracticed: null,
          });
        }
      }

      return progressData;
    } catch (_error) {
      logger.error('Error getting parent student progress', { operation: 'parent:progress:get', _error: _error instanceof Error ? _error.message : String(_error), parentId, studentId, severity: 'medium' as const });
      throw new Error('Failed to get parent student progress');
    }
  }

  async getStudentSessions(
    parentId: string,
    studentId: string,
    getChildren: (parentId: string) => Promise<ChildInfo[]>
  ): Promise<SessionSummary[]> {
    try {
      const children = await getChildren(parentId);
      const isValidChild = children.some(child => child.id === studentId);

      if (!isValidChild) {
        throw new Error('Access denied: Student does not belong to parent');
      }

      const sessions = await studySessionsRepository.findByUserIdWithStats(studentId);

      return sessions.map(session => ({
        id: session.id,
        subject: session.subject,
        startTime: session.startedAt,
        endTime: session.endedAt,
        messagesCount: session.messageCount,
        avgFrustration: parseFloat(session.frustrationAvg ?? '0'),
      }));
    } catch (_error) {
      logger.error('Error getting student sessions', { operation: 'parent:sessions:get', _error: _error instanceof Error ? _error.message : String(_error), parentId, studentId, severity: 'medium' as const });
      throw new Error('Failed to get student sessions');
    }
  }

  async getSessionMessages(
    parentId: string,
    sessionId: string,
    getChildren: (parentId: string) => Promise<ChildInfo[]>
  ): Promise<SessionMessage[]> {
    try {
      const session = await studySessionsRepository.findById(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      const children = await getChildren(parentId);
      const isValidChild = children.some(child => child.id === session.userId);

      if (!isValidChild) {
        throw new Error('Access denied: Session does not belong to parent\'s child');
      }

      const sessionMessages = await messagesRepository.findBySessionId(sessionId);

      return sessionMessages.map(message => ({
        id: message.id,
        role: message.role,
        content: message.content,
        frustrationLevel: message.frustrationLevel,
        createdAt: message.createdAt,
        aiModel: message.aiModel,
        tokensUsed: message.tokensUsed,
      }));
    } catch (_error) {
      logger.error('Error getting session messages', { operation: 'parent:messages:get', _error: _error instanceof Error ? _error.message : String(_error), parentId, sessionId, severity: 'medium' as const });
      throw new Error('Failed to get session messages');
    }
  }

  async getParentStatistics(
    parentId: string,
    getChildren: (parentId: string) => Promise<ChildInfo[]>,
    getMetrics: (parentId: string) => Promise<ParentDashboardMetrics[]>
  ): Promise<{
    totalChildren: number;
    totalStudyTime: number;
    totalSessions: number;
    avgFrustration: number;
    activeStudents: number;
  }> {
    try {
      const children = await getChildren(parentId);
      const metrics = await getMetrics(parentId);

      const totalStudyTime = metrics.reduce((sum, m) => sum + m.totalStudyTime, 0);
      const totalSessions = metrics.reduce((sum, m) => sum + m.totalSessions, 0);
      const avgFrustration = metrics.length > 0
        ? metrics.reduce((sum, m) => sum + m.avgFrustration, 0) / metrics.length
        : 0;

      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const activeStudents = metrics.filter(m =>
        m.lastSessionDate && m.lastSessionDate > oneWeekAgo
      ).length;

      return {
        totalChildren: children.length,
        totalStudyTime,
        totalSessions,
        avgFrustration,
        activeStudents,
      };
    } catch (_error) {
      logger.error('Error getting parent statistics', { operation: 'parent:stats:get', _error: _error instanceof Error ? _error.message : String(_error), parentId, severity: 'medium' as const });
      throw new Error('Failed to get parent statistics');
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
