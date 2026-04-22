/**
 * Parent Service - Re-export facade for backward compatibility
 * Implementation split into parent/parent-dashboard.service.ts and parent/parent-types.ts
 */

import { usersRepository } from '../db/repositories';
import { logger } from '../lib/observability';
import { auth } from '../lib/auth';
import type { SchoolLevel } from '../db/schema.js';
import { ParentDashboardService } from './parent/parent-dashboard.service';
import type { ChildInfo, ParentDashboardMetrics, StudentProgress, SessionSummary, SessionMessage } from './parent/parent-types';

// Re-export types
export type { ChildInfo, ParentDashboardMetrics, StudentProgress, SessionSummary, SessionMessage } from './parent/parent-types';

export class ParentService {
  private readonly dashboard = new ParentDashboardService();

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

  async getParentDashboardMetrics(parentId: string): Promise<ParentDashboardMetrics[]> {
    return this.dashboard.getParentDashboardMetrics(parentId, (id) => this.getParentChildren(id));
  }

  async getParentStudentProgress(parentId: string, studentId?: string, cachedChildren?: ChildInfo[]): Promise<StudentProgress[]> {
    return this.dashboard.getParentStudentProgress(parentId, (id) => this.getParentChildren(id), studentId, cachedChildren);
  }

  async getStudentSessions(parentId: string, studentId: string): Promise<SessionSummary[]> {
    return this.dashboard.getStudentSessions(parentId, studentId, (id) => this.getParentChildren(id));
  }

  async getSessionMessages(parentId: string, sessionId: string): Promise<SessionMessage[]> {
    return this.dashboard.getSessionMessages(parentId, sessionId, (id) => this.getParentChildren(id));
  }

  async getParentStatistics(parentId: string): Promise<{
    totalChildren: number;
    totalStudyTime: number;
    totalSessions: number;
    avgFrustration: number;
    activeStudents: number;
  }> {
    return this.dashboard.getParentStatistics(
      parentId,
      (id) => this.getParentChildren(id),
      (id) => this.getParentDashboardMetrics(id)
    );
  }

  async createChild(parentId: string, childData: {
    firstName: string;
    lastName: string;
    username: string;
    password: string;
    schoolLevel: string;
    dateOfBirth: string;
  }): Promise<ChildInfo> {
    const existingUser = await usersRepository.findByUsername(childData.username);
    if (existingUser) {
      throw new Error('Ce nom d\'utilisateur existe déjà');
    }

    const result = await auth.api.signUpEmail({
      body: {
        email: `child_${Date.now()}_${Math.random().toString(36).substring(7)}@internal.tomai`,
        password: childData.password,
        name: `${childData.firstName} ${childData.lastName}`.trim(),
        username: childData.username
      }
    });

    await usersRepository.update(result.user.id, {
      firstName: childData.firstName,
      lastName: childData.lastName,
      username: childData.username,
      displayUsername: childData.username,
      role: 'student',
      schoolLevel: childData.schoolLevel as SchoolLevel,
      dateOfBirth: childData.dateOfBirth,
      parentId: parentId
    });

    return {
      id: result.user.id,
      firstName: childData.firstName,
      lastName: childData.lastName,
      username: childData.username,
      schoolLevel: childData.schoolLevel,
      dateOfBirth: childData.dateOfBirth ?? undefined,
      isActive: true,
      parentId: parentId,
      role: 'student' as const,
      createdAt: new Date().toISOString()
    };
  }

  async updateChild(parentId: string, childId: string, updateData: {
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    schoolLevel?: string;
    password?: string;
  }, requestHeaders?: Headers): Promise<ChildInfo> {
    try {
      const children = await this.getParentChildren(parentId);
      const child = children.find(c => c.id === childId);

      if (!child) {
        throw new Error('Access denied: Student does not belong to parent');
      }

      const updateObject: Partial<{
        firstName: string;
        lastName: string;
        schoolLevel: SchoolLevel;
        dateOfBirth: string;
        updatedAt: Date;
      }> = {
        updatedAt: new Date()
      };

      if (updateData.firstName !== undefined) updateObject.firstName = updateData.firstName;
      if (updateData.lastName !== undefined) updateObject.lastName = updateData.lastName;
      if (updateData.dateOfBirth !== undefined) updateObject.dateOfBirth = updateData.dateOfBirth;
      if (updateData.schoolLevel !== undefined) updateObject.schoolLevel = updateData.schoolLevel as SchoolLevel;

      // Update password via Better Auth admin API (bcrypt hashing handled internally)
      if (updateData.password && requestHeaders) {
        await auth.api.setUserPassword({
          body: { newPassword: updateData.password, userId: childId },
          headers: requestHeaders,
        });
      }

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
        dateOfBirth: updatedChild.dateOfBirth ?? undefined,
        isActive: updatedChild.isActive ?? true,
        parentId: parentId,
        role: 'student' as const,
        createdAt: updatedChild.createdAt?.toISOString() ?? new Date().toISOString()
      };
    } catch (_error) {
      logger.error('Error updating child', { operation: 'parent:child:update', _error: _error instanceof Error ? _error.message : String(_error), parentId, childId, severity: 'medium' as const });
      throw _error instanceof Error ? _error : new Error('Failed to update child');
    }
  }

  async deleteChild(parentId: string, childId: string): Promise<void> {
    try {
      const children = await this.getParentChildren(parentId);
      const child = children.find(c => c.id === childId);

      if (!child) {
        throw new Error('Access denied: Student does not belong to parent');
      }

      const deleted = await usersRepository.deleteById(childId);
      if (!deleted) {
        throw new Error('Failed to delete child from database');
      }

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

export const parentService = new ParentService();
