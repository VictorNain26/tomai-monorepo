/**
 * Progress Service - Modern implementation using Drizzle ORM
 * Handles student progress, statistics, costs, and dashboard metrics
 */

import { eq, desc, count, sum, sql, and, gte } from 'drizzle-orm';
import { studySessionsRepository, progressRepository } from '../db/repositories';
import { db } from '../db/connection';
import { studySessions, messages, costTracking } from '../db/schema';
import { logger } from '../lib/observability';

export interface StudentStats {
  totalSessions: number;
  totalStudyTime: number; // in minutes
  conceptsLearned: number;
  averageFrustration: number;
  averageSessionDuration: number;
  subjectsStudied: number;
  lastSessionDate: Date | null;
  weeklyActivity: number;
  monthlyActivity: number;
}

export interface SessionOverview {
  id: string;
  subject: string;
  startedAt: Date;
  endedAt: Date | null;
  messagesCount: number;
  avgFrustration: number;
  durationMinutes: number;
}

export interface CostTracking {
  date: string;
  totalMessages: number;
  totalTokens: number;
  estimatedCost: number;
}

export interface MonthlyCost {
  month: string;
  year: number;
  totalCost: number;
  totalMessages: number;
  totalTokens: number;
}

export interface StudentPerformance {
  averageFrustration: number;
  totalMessagesExchanged: number;
  studyConsistency: 'Regular' | 'Irregular' | 'Excellent';
  improvementTrend: 'Improving' | 'Stable' | 'Declining';
  engagementLevel: 'High' | 'Medium' | 'Low';
}

export class ProgressService {
  /**
   * Get comprehensive student statistics
   */
  async getStudentStats(userId: string): Promise<StudentStats> {
    try {
      // Get basic session stats
      const sessionStats = await studySessionsRepository.getSessionStats(userId);
      
      // Get progress stats (concepts learned)
      const progressSummary = await progressRepository.getProgressSummary(userId);
      
      // Get subjects studied
      const subjects = await db
        .selectDistinct({ subject: studySessions.subject })
        .from(studySessions)
        .where(eq(studySessions.userId, userId));

      // Get last session date
      const lastSession = await db
        .select({ startedAt: studySessions.startedAt })
        .from(studySessions)
        .where(eq(studySessions.userId, userId))
        .orderBy(desc(studySessions.startedAt))
        .limit(1);

      // Calculate activity metrics
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

      const weeklyActivity = await db
        .select({ count: count() })
        .from(studySessions)
        .where(and(eq(studySessions.userId, userId), gte(studySessions.startedAt, oneWeekAgo)));

      const monthlyActivity = await db
        .select({ count: count() })
        .from(studySessions)
        .where(and(eq(studySessions.userId, userId), gte(studySessions.startedAt, oneMonthAgo)));

      return {
        totalSessions: sessionStats.totalSessions,
        totalStudyTime: sessionStats.totalMinutes,
        conceptsLearned: progressSummary.totalConcepts,
        averageFrustration: sessionStats.averageFrustration,
        averageSessionDuration: sessionStats.totalMinutes / Math.max(sessionStats.totalSessions, 1),
        subjectsStudied: subjects.length,
        lastSessionDate: lastSession[0]?.startedAt ?? null,
        weeklyActivity: weeklyActivity[0]?.count ?? 0,
        monthlyActivity: monthlyActivity[0]?.count ?? 0,
      };
    } catch (_error) {
      logger.error('Error getting student stats', { operation: 'progress:stats:get', _error: _error instanceof Error ? _error.message : String(_error), userId, severity: 'medium' as const });
      throw new Error('Failed to get student statistics');
    }
  }

  /**
   * Get user sessions overview
   */
  async getUserSessions(userId: string): Promise<SessionOverview[]> {
    try {
      const sessions = await studySessionsRepository.findByUserIdWithStats(userId);
      
      return sessions.map(session => ({
        id: session.id,
        subject: session.subject,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
        messagesCount: session.messageCount,
        avgFrustration: parseFloat(session.frustrationAvg ?? '0'),
        durationMinutes: session.durationMinutes ?? 0,
      }));
    } catch (_error) {
      logger.error('Error getting user sessions', { operation: 'progress:sessions:get', _error: _error instanceof Error ? _error.message : String(_error), userId, severity: 'medium' as const });
      throw new Error('Failed to get user sessions');
    }
  }

  /**
   * Get daily cost tracking using real cost_tracking table
   */
  async getCostTracking(): Promise<CostTracking[]> {
    try {
      // Utiliser la vraie table cost_tracking pour des données précises
      const last7Days = new Date();
      last7Days.setDate(last7Days.getDate() - 7);
      
      const costData = await db
        .select({
          date: sql`DATE(${costTracking.createdAt})`.as('date'),
          totalMessages: count(costTracking.id),
          totalTokensInput: sum(costTracking.tokensInput),
          totalTokensOutput: sum(costTracking.tokensOutput),
          totalCostCents: sum(costTracking.costCents)
        })
        .from(costTracking)
        .where(gte(costTracking.createdAt, last7Days))
        .groupBy(sql`DATE(${costTracking.createdAt})`)
        .orderBy(desc(sql`DATE(${costTracking.createdAt})`));

      return costData.map(row => ({
        date: String(row.date),
        totalMessages: Number(row.totalMessages) || 0,
        totalTokens: (Number(row.totalTokensInput) || 0) + (Number(row.totalTokensOutput) || 0),
        estimatedCost: (Number(row.totalCostCents) || 0) / 100 // Convertir centimes en euros
      }));
    } catch (_error) {
      logger.error('Error getting cost tracking', { operation: 'progress:costs:daily', _error: _error instanceof Error ? _error.message : String(_error), severity: 'medium' as const });
      throw new Error('Failed to get cost tracking');
    }
  }

  /**
   * Get monthly cost tracking (placeholder implementation)
   */
  async getMonthlyCosts(): Promise<MonthlyCost[]> {
    try {
      const currentDate = new Date();
      const currentMonth = currentDate.toISOString().slice(0, 7); // YYYY-MM format
      
      const monthlyMessages = await db
        .select({ 
          count: count(),
          totalTokens: sum(messages.tokensUsed)
        })
        .from(messages)
        .where(sql`to_char(${messages.createdAt}, 'YYYY-MM') = ${currentMonth}`);

      const messageCount = monthlyMessages[0]?.count ?? 0;
      const tokenCount = Number(monthlyMessages[0]?.totalTokens) || 0;
      
      // Estimate cost: roughly 0.002€ per 1000 tokens
      const estimatedCost = (tokenCount / 1000) * 0.002;

      return [{
        month: currentMonth,
        year: currentDate.getFullYear(),
        totalCost: parseFloat(estimatedCost.toFixed(4)),
        totalMessages: messageCount,
        totalTokens: tokenCount
      }];
    } catch (_error) {
      logger.error('Error getting monthly costs', { operation: 'progress:costs:monthly', _error: _error instanceof Error ? _error.message : String(_error), severity: 'medium' as const });
      throw new Error('Failed to get monthly costs');
    }
  }

  /**
   * Analyze student performance trends
   */
  async getStudentPerformance(userId: string): Promise<StudentPerformance> {
    try {
      const sessions = await this.getUserSessions(userId);
      
      if (sessions.length === 0) {
        return {
          averageFrustration: 0,
          totalMessagesExchanged: 0,
          studyConsistency: 'Irregular',
          improvementTrend: 'Stable',
          engagementLevel: 'Low'
        };
      }

      const averageFrustration = sessions.reduce((sum, session) => sum + session.avgFrustration, 0) / sessions.length;
      const totalMessagesExchanged = sessions.reduce((sum, session) => sum + session.messagesCount, 0);
      
      // Analyze consistency (sessions per week)
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      const recentSessions = sessions.filter(session => session.startedAt >= oneWeekAgo);
      
      let studyConsistency: 'Regular' | 'Irregular' | 'Excellent' = 'Irregular';
      if (recentSessions.length >= 5) studyConsistency = 'Excellent';
      else if (recentSessions.length >= 2) studyConsistency = 'Regular';

      // Analyze improvement trend (comparing first half vs second half of sessions)
      const midPoint = Math.floor(sessions.length / 2);
      const firstHalf = sessions.slice(0, midPoint);
      const secondHalf = sessions.slice(midPoint);
      
      let improvementTrend: 'Improving' | 'Stable' | 'Declining' = 'Stable';
      if (firstHalf.length > 0 && secondHalf.length > 0) {
        const firstHalfFrustration = firstHalf.reduce((sum, s) => sum + s.avgFrustration, 0) / firstHalf.length;
        const secondHalfFrustration = secondHalf.reduce((sum, s) => sum + s.avgFrustration, 0) / secondHalf.length;
        
        if (secondHalfFrustration < firstHalfFrustration - 0.5) improvementTrend = 'Improving';
        else if (secondHalfFrustration > firstHalfFrustration + 0.5) improvementTrend = 'Declining';
      }

      // Analyze engagement level
      const averageSessionDuration = sessions.reduce((sum, s) => sum + s.durationMinutes, 0) / sessions.length;
      let engagementLevel: 'High' | 'Medium' | 'Low' = 'Low';
      if (averageSessionDuration >= 20 && totalMessagesExchanged >= 50) engagementLevel = 'High';
      else if (averageSessionDuration >= 10 && totalMessagesExchanged >= 20) engagementLevel = 'Medium';

      return {
        averageFrustration,
        totalMessagesExchanged,
        studyConsistency,
        improvementTrend,
        engagementLevel
      };
    } catch (_error) {
      logger.error('Error getting student performance', { operation: 'progress:performance:get', _error: _error instanceof Error ? _error.message : String(_error), userId, severity: 'medium' as const });
      throw new Error('Failed to get student performance');
    }
  }

  /**
   * Check if user has access to student data
   */
  async hasAccessToStudent(parentId: string, studentId: string): Promise<boolean> {
    try {
      const { parentService } = await import('./parent.service');
      return await parentService.isParentOf(parentId, studentId);
    } catch (_error) {
      logger.error('Error checking student access', { operation: 'progress:access:check', _error: _error instanceof Error ? _error.message : String(_error), parentId, studentId, severity: 'medium' as const });
      return false;
    }
  }
}

// Export singleton instance
export const progressService = new ProgressService();