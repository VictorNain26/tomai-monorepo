import { usersRepository, createStudentAccount, setPassword } from '../auth/index.js';
import { filesRepository, deleteFiles } from '../documents/index.js';
import { parentChildRepository } from './parent-child.repository.js';
import { listChildren } from './children.js';
import { logger } from '../../platform/observability/logger';
import type { SchoolLevel } from '../../db/schema.js';
import { ParentDashboardService } from './parent-dashboard.service';
import type { ChildInfo, ParentDashboardMetrics } from './parent-types';

export class ParentService {
  private readonly dashboard = new ParentDashboardService();

  async getParentChildren(parentId: string): Promise<ChildInfo[]> {
    try {
      const children = await listChildren(parentId);
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
        isActive: child.isActive,
        parentId: parentId,
        role: 'student' as const,
        createdAt: child.createdAt.toISOString(),
      }));

      logger.debug('Processed children data', {
        parentId,
        processedCount: result.length,
        operation: 'parent:getChildren'
      });
      return result;
    } catch (_error) {
      logger.error('Failed to get parent children', {
        err: _error,
        parentId,
        operation: 'parent:getChildren',
        severity: 'high' as const
      });
      throw new Error('Failed to get parent children', { cause: _error });
    }
  }

  async getParentDashboardMetrics(parentId: string, children: ChildInfo[]): Promise<ParentDashboardMetrics[]> {
    return this.dashboard.getParentDashboardMetrics(parentId, children);
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

    const childId = await createStudentAccount({
      ...childData,
      schoolLevel: childData.schoolLevel as SchoolLevel,
    });

    try {
      await parentChildRepository.link(parentId, childId);
    } catch (err) {
      await usersRepository.deleteById(childId);
      throw err;
    }

    return {
      id: childId,
      firstName: childData.firstName,
      lastName: childData.lastName,
      username: childData.username,
      schoolLevel: childData.schoolLevel,
      dateOfBirth: childData.dateOfBirth,
      isActive: true,
      parentId: parentId,
      role: 'student' as const,
      createdAt: new Date().toISOString(),
    };
  }

  async updateChild(parentId: string, childId: string, updateData: {
    firstName?: string;
    lastName?: string;
    dateOfBirth?: string;
    schoolLevel?: string;
    password?: string;
  }): Promise<ChildInfo> {
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

      if (updateData.password) {
        await setPassword(childId, updateData.password);
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
        isActive: updatedChild.isActive,
        parentId: parentId,
        role: 'student' as const,
        createdAt: updatedChild.createdAt.toISOString(),
      };
    } catch (_error) {
      logger.error('Error updating child', { operation: 'parent:child:update', err: _error, parentId, childId, severity: 'medium' as const });
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

      const deleted = await usersRepository.deleteById(childId);
      if (!deleted) {
        throw new Error('Failed to delete child from database');
      }

      const checkUser = await usersRepository.findById(childId);
      if (checkUser) {
        logger.error('CRITICAL: Child still exists after deletion', { operation: 'parent:child:delete:verify', reason: 'Child persists after delete query', childId, parentId, severity: 'critical' as const });
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
          reason: 'deleteFiles reported failures (S3 errors already logged by storage service)',
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
      });
    } catch (_error) {
      logger.error('Error deleting child', { operation: 'parent:child:delete', err: _error, parentId, childId, severity: 'high' as const });
      throw new Error('Failed to delete child', { cause: _error });
    }
  }
}

export const parentService = new ParentService();
