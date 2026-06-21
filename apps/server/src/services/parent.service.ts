/**
 * Parent Service - Re-export facade for backward compatibility
 * Implementation split into parent/parent-dashboard.service.ts and parent/parent-types.ts
 */

import { usersRepository, filesRepository, retrievalAuditRepository } from '../db/repositories';
import { parentChildRepository } from '../db/repositories/parent-child.repository';
import { logger } from '../lib/observability';
import { deleteFiles } from './storage/scaleway-storage.service';
import { auth } from '../lib/auth';
import type { SchoolLevel } from '../db/schema.js';
import { ParentDashboardService } from './parent/parent-dashboard.service';
import type { ChildInfo, ParentDashboardMetrics, StudentProgress, SessionSummary, SessionMessage } from './parent/parent-types';

// Re-export types
;

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
      throw new Error('Failed to get parent children', { cause: _error });
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
    dateOfBirth?: string;
  }): Promise<ChildInfo> {
    const existingUser = await usersRepository.findByUsername(childData.username);
    if (existingUser) {
      throw new Error('Ce nom d\'utilisateur existe déjà');
    }

    // The username plugin augments signUpEmail at runtime but TS overloads
    // don't reflect it yet — cast only the `username` addition; the other
    // fields remain fully typed so typos in email/password/name are still caught.
    const typedBody = {
      email: `child_${Date.now()}_${Math.random().toString(36).substring(7)}@internal.tomai`,
      password: childData.password,
      name: `${childData.firstName} ${childData.lastName}`.trim(),
    };
    const result = await auth.api.signUpEmail({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      body: { ...typedBody, username: childData.username } as typeof typedBody & Record<string, any>,
    });

    try {
      await usersRepository.update(result.user.id, {
        firstName: childData.firstName,
        lastName: childData.lastName,
        username: childData.username,
        displayUsername: childData.username,
        role: 'student',
        schoolLevel: childData.schoolLevel as SchoolLevel,
        dateOfBirth: childData.dateOfBirth,
      });
      await parentChildRepository.link(parentId, result.user.id);
    } catch (err) {
      await usersRepository.deleteById(result.user.id);
      throw err;
    }

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

      // Collect storage keys before the cascade destroys the DB references
      const fileRecords = await filesRepository.listByUserId(childId);

      // RGPD art. 17 — anonymize the append-only RAG audit trail (no FK cascade)
      // BEFORE erasing the account. Defensive order: a failure here aborts the
      // deletion, so we never leave an identifiable audit row pointing at a user
      // that has already been removed.
      const auditRowsPseudonymized = await retrievalAuditRepository.pseudonymizeByUserId(childId);

      const deleted = await usersRepository.deleteById(childId);
      if (!deleted) {
        throw new Error('Failed to delete child from database');
      }

      const checkUser = await usersRepository.findById(childId);
      if (checkUser) {
        logger.error('CRITICAL: Child still exists after deletion', { operation: 'parent:child:delete:verify', _error: 'Child persists after delete query', childId, parentId, severity: 'critical' as const });
        throw new Error('Deletion failed: User still exists in database');
      }

      // Best-effort S3 purge — a storage failure must never block the erasure
      // right. One batched DeleteObjects instead of one request per file.
      // deleteFiles never throws: it returns the keys it could not delete.
      const { deleted: filesPurged, failed: filesFailedKeys } = await deleteFiles(
        fileRecords.map((record) => record.storageKey)
      );
      if (filesFailedKeys.length > 0) {
        logger.error('S3 purge failed for some child files', {
          operation: 'parent:delete-child-s3-purge',
          _error: 'deleteFiles reported failures (S3 errors already logged by storage service)',
          failedCount: filesFailedKeys.length,
          childId,
          severity: 'high' as const,
        });
      }

      logger.info('Child account deleted with S3 purge', {
        operation: 'parent:delete-child',
        childId,
        filesPurged,
        filesFailed: filesFailedKeys.length,
        auditRowsPseudonymized,
      });
    } catch (_error) {
      logger.error('Error deleting child', { operation: 'parent:child:delete', _error: _error instanceof Error ? _error.message : String(_error), parentId, childId, severity: 'high' as const });
      throw new Error('Failed to delete child', { cause: _error });
    }
  }

  async isParentOf(parentId: string, studentId: string): Promise<boolean> {
    try {
      return await parentChildRepository.isLinked(parentId, studentId);
    } catch (error) {
      logger.error('Error verifying parent-child relationship', {
        operation: 'parent:isParentOf:error',
        parentId,
        studentId,
        _error: error instanceof Error ? error.message : String(error),
        severity: 'medium' as const,
      });
      return false;
    }
  }
}

export const parentService = new ParentService();
