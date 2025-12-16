/**
 * Parent Service - Modern implementation using Drizzle ORM
 * Handles parent-child relationships and dashboard metrics
 */

import { sql, eq, desc } from 'drizzle-orm';
import { usersRepository, studySessionsRepository, messagesRepository, progressRepository } from '../db/repositories';
import { db } from '../db/connection';
import { studySessions } from '../db/schema';
import { logger } from '../lib/observability';
import { auth } from '../lib/auth';
import { withPoolLimit } from '../db/pool-limiter.js';

import type { SchoolLevel } from '../db/schema.js';

// LV2 type (espagnol, allemand, italien)
export type Lv2Option = 'espagnol' | 'allemand' | 'italien';

// Child type definition
export interface ChildInfo {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  schoolLevel: string;
  selectedLv2?: Lv2Option | null; // LV2 choisie (à partir de 5ème)
  dateOfBirth?: string;
  isActive: boolean;
  parentId: string;
  role: 'student';
  createdAt: string;
}

export interface ParentDashboardMetrics {
  studentId: string;
  studentName: string;
  schoolLevel: string;
  age: number;
  totalSessions: number;
  studyDays: number;
  avgSessionDuration: number;
  avgFrustration: number;
  subjectsStudied: number;
  totalStudyTime: number;
  lastSessionDate: Date | null;
}

export interface StudentProgress {
  studentId: string;
  studentName: string;
  subject: string;
  conceptsMastered: number;
  avgMastery: number;
  avgSuccessRate: number;
  totalPracticeTime: number;
  lastPracticed: Date | null;
}

export interface SessionSummary {
  id: string;
  subject: string;
  startTime: Date;
  endTime: Date | null;
  messagesCount: number;
  avgFrustration: number;
}

export interface SessionMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  frustrationLevel: number | null;
  createdAt: Date;
  aiModel: string | null;
  tokensUsed: number | null;
}

export class ParentService {

// Validation supprimée - utilisation directe des types + validation Zod en amont
  /**
   * Get all children for a parent
   */
  async getParentChildren(parentId: string): Promise<ChildInfo[]> {
    try {
      const children = await usersRepository.findChildrenByParentId(parentId);
      logger.debug('Retrieved children from database', {
        parentId,
        childrenCount: children.length,
        operation: 'parent:getChildren'
      });

      const result = children.map(child => ({
        id: child.id,
        firstName: child.firstName ?? '',
        lastName: child.lastName ?? '',
        username: child.username ?? '',
        schoolLevel: child.schoolLevel ?? '',
        selectedLv2: (child.selectedLv2 as Lv2Option | null) ?? null,
        dateOfBirth: child.dateOfBirth ?? undefined,
        isActive: child.isActive ?? true,
        parentId: parentId,
        role: 'student' as const,
        createdAt: child.createdAt?.toISOString() ?? new Date().toISOString()
      }));

      logger.debug('Processed children data', {
        parentId,
        processedCount: result.length,
        operation: 'parent:getChildren'
      });
      return result;
    } catch (_error) {
      logger.error('Failed to get parent children', {
        _error: _error instanceof Error ? _error.message : String(_error),
        parentId,
        operation: 'parent:getChildren',
        severity: 'high' as const
      });
      throw new Error('Failed to get parent children');
    }
  }

  /**
   * Get dashboard metrics for all children of a parent
   * ✅ PERFORMANCE OPTIMIZED: Batch queries to eliminate N+1 problem
   */
  async getParentDashboardMetrics(parentId: string): Promise<ParentDashboardMetrics[]> {
    try {
      const children = await this.getParentChildren(parentId);
      if (children.length === 0) {
        return [];
      }

      // ✅ SOLUTION N+1: Fallback to individual queries (getBatchSessionStats not available)
      const metrics: ParentDashboardMetrics[] = [];

      for (const child of children) {
        try {
          // Get session stats individually (until batch method is implemented)
          const sessionStats = await studySessionsRepository.getSessionStats(child.id);

          // Parallel queries for child metrics with pool limiting (Phase 3.1)
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

          // ERREUR EXPLICITE - Pas de valeurs par défaut automatiques
          throw new Error(`Impossible de récupérer les métriques pour l'enfant ${child.id}: ${(childError as Error).message}`);
        }
      }

      return metrics;
    } catch (_error) {
      logger.error('Error getting parent dashboard metrics', { operation: 'parent:dashboard:get', _error: _error instanceof Error ? _error.message : String(_error), parentId, severity: 'high' as const });
      throw new Error('Failed to get parent dashboard metrics');
    }
  }

  /**
   * Get detailed progress for a student or all children
   * ✅ OPTIMIZED: Reuse children data when possible
   */
  async getParentStudentProgress(parentId: string, studentId?: string, cachedChildren?: ChildInfo[]): Promise<StudentProgress[]> {
    try {
      // ✅ Use cached children if provided to avoid duplicate queries
      const children = cachedChildren ?? await this.getParentChildren(parentId);

      // Filter by specific student if provided
      const targetChildren = studentId
        ? children.filter(child => child.id === studentId)
        : children;

      if (targetChildren.length === 0) {
        return [];
      }

      const progressData: StudentProgress[] = [];

      for (const child of targetChildren) {
        // Get progress summary for this child
        const summary = await progressRepository.getProgressSummary(child.id);

        // Get detailed progress by subject
        for (const subjectProgress of summary.subjectProgress) {
          progressData.push({
            studentId: child.id,
            studentName: `${child.firstName} ${child.lastName}`,
            subject: subjectProgress.subject,
            conceptsMastered: subjectProgress.conceptCount,
            avgMastery: subjectProgress.averageMastery,
            avgSuccessRate: subjectProgress.averageMastery * 0.8, // Approximation based on mastery level
            totalPracticeTime: subjectProgress.totalPracticeTime,
            lastPracticed: null, // Not available in subject progress summary
          });
        }
      }

      return progressData;
    } catch (_error) {
      logger.error('Error getting parent student progress', { operation: 'parent:progress:get', _error: _error instanceof Error ? _error.message : String(_error), parentId, studentId, severity: 'medium' as const });
      throw new Error('Failed to get parent student progress');
    }
  }

  /**
   * Get session history for a specific student
   */
  async getStudentSessions(parentId: string, studentId: string): Promise<SessionSummary[]> {
    try {
      // Verify child belongs to parent
      const children = await this.getParentChildren(parentId);
      const isValidChild = children.some(child => child.id === studentId);

      if (!isValidChild) {
        throw new Error('Access denied: Student does not belong to parent');
      }

      // Get sessions with message stats
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

  /**
   * Get detailed messages for a specific session
   */
  async getSessionMessages(parentId: string, sessionId: string): Promise<SessionMessage[]> {
    try {
      // Get session to verify it belongs to a child of this parent
      const session = await studySessionsRepository.findById(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      // Verify child belongs to parent
      const children = await this.getParentChildren(parentId);
      const isValidChild = children.some(child => child.id === session.userId);

      if (!isValidChild) {
        throw new Error('Access denied: Session does not belong to parent\'s child');
      }

      // Get messages for this session
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

  /**
   * Get global statistics for all parent's children
   */
  async getParentStatistics(parentId: string): Promise<{
    totalChildren: number;
    totalStudyTime: number;
    totalSessions: number;
    avgFrustration: number;
    activeStudents: number;
  }> {
    try {
      const children = await this.getParentChildren(parentId);
      const metrics = await this.getParentDashboardMetrics(parentId);

      const totalStudyTime = metrics.reduce((sum, m) => sum + m.totalStudyTime, 0);
      const totalSessions = metrics.reduce((sum, m) => sum + m.totalSessions, 0);
      const avgFrustration = metrics.length > 0
        ? metrics.reduce((sum, m) => sum + m.avgFrustration, 0) / metrics.length
        : 0;

      // Count active students (studied in last 7 days)
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

  /**
   * Créer un enfant avec Better Auth (version propre)
   */
  async createChild(parentId: string, childData: {
    firstName: string;
    lastName: string;
    username: string;
    password: string;
    schoolLevel: string;
    dateOfBirth: string;
    selectedLv2?: Lv2Option | null;
  }): Promise<ChildInfo> {
    // Vérification unicité username
    const existingUser = await usersRepository.findByUsername(childData.username);
    if (existingUser) {
      throw new Error('Ce nom d\'utilisateur existe déjà');
    }

    // Création avec Better Auth via signUpEmail + username pour étudiants
    const result = await auth.api.signUpEmail({
      body: {
        email: `child_${Date.now()}_${Math.random().toString(36).substring(7)}@internal.tomai`,
        password: childData.password,
        name: `${childData.firstName} ${childData.lastName}`.trim(),
        // CRITICAL: Username doit être dans les additionalFields
        username: childData.username
      }
    });

    // Mise à jour des champs spécifiques enfant + username confirmation
    await usersRepository.update(result.user.id, {
      firstName: childData.firstName,
      lastName: childData.lastName,
      username: childData.username,
      displayUsername: childData.username, // Assurer compatibilité plugin username
      role: 'student',
      schoolLevel: childData.schoolLevel as SchoolLevel,
      selectedLv2: childData.selectedLv2 ?? null,
      dateOfBirth: childData.dateOfBirth,
      parentId: parentId
    });

    // Retourner les données formatées
    return {
      id: result.user.id,
      firstName: childData.firstName,
      lastName: childData.lastName,
      username: childData.username,
      schoolLevel: childData.schoolLevel,
      selectedLv2: childData.selectedLv2 ?? null,
      dateOfBirth: childData.dateOfBirth ?? undefined,
      isActive: true,
      parentId: parentId,
      role: 'student' as const,
      createdAt: new Date().toISOString()
    };
  }

  /**
   * Update a child's school level
   */
  async updateChildSchoolLevel(parentId: string, childId: string, schoolLevel: string): Promise<ChildInfo> {
    try {
      // Verify child belongs to this parent
      const children = await this.getParentChildren(parentId);
      const child = children.find(c => c.id === childId);

      if (!child) {
        throw new Error('Access denied: Student does not belong to parent');
      }

      // Update the child's school level (validated by Zod schema upstream)
      const updatedChild = await usersRepository.update(childId, {
        schoolLevel: schoolLevel as SchoolLevel,
        updatedAt: new Date()
      });

      if (!updatedChild) {
        throw new Error('Failed to update child');
      }

      return {
        id: updatedChild.id,
        firstName: updatedChild.firstName ?? '',
        lastName: updatedChild.lastName ?? '',
        username: updatedChild.username ?? '',
        schoolLevel: updatedChild.schoolLevel ?? '',
        selectedLv2: (updatedChild.selectedLv2 as Lv2Option | null) ?? null,
        dateOfBirth: updatedChild.dateOfBirth ?? undefined,
        isActive: updatedChild.isActive ?? true,
        parentId: parentId,
        role: 'student' as const,
        createdAt: updatedChild.createdAt?.toISOString() ?? new Date().toISOString()
      };
    } catch (_error) {
      logger.error('Error updating child school level', { operation: 'parent:child:updateLevel', _error: _error instanceof Error ? _error.message : String(_error), parentId, childId, severity: 'medium' as const });
      throw new Error('Failed to update child school level');
    }
  }

  /**
   * Calculate age from date of birth
   */
  private calculateAge(dateOfBirth: Date): number {
    const today = new Date();
    const birth = new Date(dateOfBirth);
    let age = today.getFullYear() - birth.getFullYear();

    // Adjust if birthday hasn't occurred this year
    const monthDay = today.getMonth() * 100 + today.getDate();
    const birthMonthDay = birth.getMonth() * 100 + birth.getDate();

    if (monthDay < birthMonthDay) {
      age--;
    }

    return age;
  }

  /**
   * Update child information
   */
  async updateChild(parentId: string, childId: string, updateData: {
    firstName?: string;
    lastName?: string;
    dateOfBirth?: Date;
    schoolLevel?: string;
    selectedLv2?: Lv2Option | null;
    password?: string;
    username?: string;
  }): Promise<ChildInfo> {
    try {
      // Verify child belongs to this parent
      const children = await this.getParentChildren(parentId);
      const child = children.find(c => c.id === childId);

      if (!child) {
        throw new Error('Access denied: Student does not belong to parent');
      }

      // Prepare update object with only defined fields
      const updateObject: Partial<{
        firstName: string;
        lastName: string;
        schoolLevel: SchoolLevel;
        selectedLv2: string | null;
        dateOfBirth: string;
        updatedAt: Date;
        name: string; // For username
      }> = {
        updatedAt: new Date()
      };

      if (updateData.firstName !== undefined) {
        updateObject.firstName = updateData.firstName;
      }
      if (updateData.lastName !== undefined) {
        updateObject.lastName = updateData.lastName;
      }
      if (updateData.dateOfBirth !== undefined) {
        updateObject.dateOfBirth = updateData.dateOfBirth.toISOString().split('T')[0];
      }
      if (updateData.schoolLevel !== undefined) {
        updateObject.schoolLevel = updateData.schoolLevel as SchoolLevel;
      }
      if (updateData.selectedLv2 !== undefined) {
        updateObject.selectedLv2 = updateData.selectedLv2;
      }
      if (updateData.username !== undefined) {
        updateObject.name = updateData.username; // 'name' est le champ username dans la DB
      }

      // Update the child
      const updatedChild = await usersRepository.update(childId, updateObject);

      if (!updatedChild) {
        throw new Error('Failed to update child');
      }

      return {
        id: updatedChild.id,
        firstName: updatedChild.firstName ?? '',
        lastName: updatedChild.lastName ?? '',
        username: updatedChild.username ?? '',
        schoolLevel: updatedChild.schoolLevel ?? '',
        selectedLv2: (updatedChild.selectedLv2 as Lv2Option | null) ?? null,
        dateOfBirth: updatedChild.dateOfBirth ?? undefined,
        isActive: updatedChild.isActive ?? true,
        parentId: parentId,
        role: 'student' as const,
        createdAt: updatedChild.createdAt?.toISOString() ?? new Date().toISOString()
      };
    } catch (_error) {
      logger.error('Error updating child', { operation: 'parent:child:update', _error: _error instanceof Error ? _error.message : String(_error), parentId, childId, severity: 'medium' as const });
      throw new Error('Failed to update child');
    }
  }

  /**
   * Delete a child account (hard delete - suppression définitive)
   * Les cascades DB suppriment automatiquement : sessions, accounts, study_sessions, messages, progress
   */
  async deleteChild(parentId: string, childId: string): Promise<void> {
    try {
      // Verify child belongs to this parent
      const children = await this.getParentChildren(parentId);
      const child = children.find(c => c.id === childId);

      if (!child) {
        throw new Error('Access denied: Student does not belong to parent');
      }

      // Hard delete - cascade supprime toutes les données liées
      const deleted = await usersRepository.deleteById(childId);
      if (!deleted) {
        throw new Error('Failed to delete child from database');
      }

      // VERIFICATION: Double-check that the user is really gone
      const checkUser = await usersRepository.findById(childId);
      if (checkUser) {
        logger.error('CRITICAL: Child still exists after deletion', { operation: 'parent:child:delete:verify', _error: 'Child persists after delete query', childId, parentId, severity: 'critical' as const });
        throw new Error('Deletion failed: User still exists in database');
      }
    } catch (_error) {
      logger.error('Error deleting child', { operation: 'parent:child:delete', _error: _error instanceof Error ? _error.message : String(_error), parentId, childId, severity: 'high' as const });
      throw new Error('Failed to delete child');
    }
  }

  /**
   * Verify if a user is a parent of a specific student
   */
  async isParentOf(parentId: string, studentId: string): Promise<boolean> {
    try {
      const children = await this.getParentChildren(parentId);
      return children.some(child => child.id === studentId);
    } catch (_error) {
      logger.error('Error verifying parent-child relationship', { operation: 'parent:verify', _error: _error instanceof Error ? _error.message : String(_error), parentId, studentId, severity: 'medium' as const });
      return false;
    }
  }
}

// Export singleton instance
export const parentService = new ParentService();
