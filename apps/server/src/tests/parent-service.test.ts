/**
 * Tests unitaires - Parent Service (modules/family/parent.service.ts)
 * Mock: modules auth, documents, tutor + repositories family
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';
import { makeUser } from './_helpers/fixtures';

// ============================================
// TYPES
// ============================================

interface UserData {
  id: string;
  email: string;
  name: string;
  firstName: string;
  lastName: string;
  username: string;
  role: 'student' | 'parent';
  schoolLevel: string | null;
  dateOfBirth: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// MOCKS
// ============================================

const mockLogger = createMockLogger();
mock.module('../platform/observability/logger', () => ({ logger: mockLogger }));

// Accounts (auth module)
let childrenResult: UserData[] = [];
let userByUsername: UserData | null = null;
let updateResult: UserData | null = null;
let deleteResult = true;
let findByIdResult: UserData | null = null;
const mockDeleteById = mock(async () => deleteResult);
const mockCreateStudentAccount = mock(async (_input: Record<string, unknown>) => 'new-child-001');
const mockSetPassword = mock(async (_userId: string, _password: string) => {});

mock.module('../modules/auth/index', () => ({
  usersRepository: {
    findByUsername: mock(async () => userByUsername),
    update: mock(async () => updateResult),
    deleteById: mockDeleteById,
    findById: mock(async () => findByIdResult),
  },
  createStudentAccount: mockCreateStudentAccount,
  setPassword: mockSetPassword,
}));

// Files (documents module)
let listByUserIdResult: { id: string; storageKey: string }[] = [];
const mockListByUserId = mock(async () => listByUserIdResult);

// Miroir du vrai contrat : deleteFiles ne lève jamais, il retourne les clés
// qu'il n'a pas pu supprimer (batch DeleteObjects).
let deleteFilesResult: { deleted: number; failed: string[] } = { deleted: 0, failed: [] };
const mockDeleteFiles = mock(async () => deleteFilesResult);

mock.module('../modules/documents/index', () => ({
  deleteFiles: mockDeleteFiles,
  filesRepository: { listByUserId: mockListByUserId },
}));

// Study stats (tutor module)
mock.module('../modules/tutor/index', () => ({
  getStudyStats: mock(async () => ({
    totalSessions: 10,
    totalMinutes: 300,
    averageFrustration: 2.5,
    subjectBreakdown: { maths: 6, francais: 4 },
    lastSessionDate: new Date('2026-09-30T17:00:00Z'),
    studyDays: 5,
  })),
}));

mock.module('../modules/family/children', () => ({
  listChildren: mock(async () => childrenResult),
}));

let linkShouldThrow = false;
const mockLink = mock(async (_parentId: string, _childId: string) => {
  if (linkShouldThrow) throw new Error('db down');
});
mock.module('../modules/family/parent-child.repository', () => ({
  parentChildRepository: { link: mockLink },
}));

// Import after mocks
const { ParentService } = await import('../modules/family/parent.service');

let parentService: InstanceType<typeof ParentService>;

beforeEach(() => {
  parentService = new ParentService();
  const child = makeUser({ id: 'child-001' });
  childrenResult = [child];
  userByUsername = null;
  updateResult = { ...child, schoolLevel: 'seconde' };
  deleteResult = true;
  findByIdResult = null;
  listByUserIdResult = [];
  deleteFilesResult = { deleted: 0, failed: [] };
  mockDeleteFiles.mockClear();
  mockListByUserId.mockClear();
  mockLogger.error.mockClear();
  mockLogger.info.mockClear();
  mockDeleteById.mockClear();
  mockCreateStudentAccount.mockClear();
  mockSetPassword.mockClear();
  linkShouldThrow = false;
  mockLink.mockClear();
});

describe('Parent Service', () => {
  describe('getParentChildren', () => {
    it('should return children list', async () => {
      const result = await parentService.getParentChildren('parent-001');
      expect(result.length).toBe(1);
      expect(result[0]?.id).toBe('child-001');
      expect(result[0]?.role).toBe('student');
    });

    it('should return empty array when no children', async () => {
      childrenResult = [];
      const result = await parentService.getParentChildren('parent-no-kids');
      expect(result.length).toBe(0);
    });

  });

  describe('getParentDashboardMetrics', () => {
    it('should return metrics for children', async () => {
      const metrics = await parentService.getParentDashboardMetrics('parent-001', await parentService.getParentChildren('parent-001'));
      expect(metrics.length).toBe(1);
      expect(metrics[0]).toMatchObject({
        totalSessions: 10,
        totalStudyTime: 300,
        avgSessionDuration: 30,
        avgFrustration: 2.5,
        subjectsStudied: 2,
        studyDays: 5,
        lastSessionDate: new Date('2026-09-30T17:00:00Z'),
      });
    });

    it('should return empty when no children', async () => {
      childrenResult = [];
      const metrics = await parentService.getParentDashboardMetrics('parent-no-kids', []);
      expect(metrics.length).toBe(0);
    });
  });

  describe('createChild', () => {
    it('should create child successfully', async () => {
      const child = await parentService.createChild('parent-001', {
        firstName: 'Marie',
        lastName: 'Dupont',
        username: 'marie',
        password: 'password123',
        schoolLevel: 'sixieme',
        dateOfBirth: '2013-05-20',
      });
      expect(child.id).toBe('new-child-001');
      expect(child.firstName).toBe('Marie');
      expect(mockCreateStudentAccount).toHaveBeenCalledWith(expect.objectContaining({ username: 'marie', schoolLevel: 'sixieme' }));
      expect(mockLink).toHaveBeenCalledWith('parent-001', 'new-child-001');
    });

    it('removes the new account when linking it to the parent fails', async () => {
      linkShouldThrow = true;
      const error = await parentService
        .createChild('parent-001', {
          firstName: 'Marie',
          lastName: 'Dupont',
          username: 'marie',
          password: 'password123',
          schoolLevel: 'sixieme',
          dateOfBirth: '2013-05-20',
        })
        .then(() => undefined, (err: unknown) => err);
      expect(error).toBeInstanceOf(Error);
      expect(mockDeleteById).toHaveBeenCalledWith('new-child-001');
    });

    it('should throw on duplicate username', async () => {
      userByUsername = makeUser({ username: 'taken' });
      expect(
        parentService.createChild('parent-001', {
          firstName: 'Test',
          lastName: 'User',
          username: 'taken',
          password: 'pass',
          schoolLevel: 'cp',
          dateOfBirth: '2018-01-01',
        })
      ).rejects.toThrow();
    });
  });

  describe('deleteChild', () => {
    it('should delete child successfully', async () => {
      findByIdResult = null; // Post-delete check returns null (deleted)
      await parentService.deleteChild('parent-001', 'child-001');
      // Should not throw
    });

    it('should throw for non-child', async () => {
      childrenResult = [];
      expect(
        parentService.deleteChild('parent-001', 'stranger')
      ).rejects.toThrow();
    });

    it('batch-deletes all child storage keys in a single call', async () => {
      listByUserIdResult = [
        { id: 'file-001', storageKey: 'uploads/child-001/a.pdf' },
        { id: 'file-002', storageKey: 'uploads/child-001/b.png' },
      ];
      deleteFilesResult = { deleted: 2, failed: [] };
      findByIdResult = null;
      await parentService.deleteChild('parent-001', 'child-001');
      expect(mockDeleteFiles).toHaveBeenCalledTimes(1);
      expect(mockDeleteFiles).toHaveBeenCalledWith([
        'uploads/child-001/a.pdf',
        'uploads/child-001/b.png',
      ]);
    });

    it('does not throw when batch delete reports failures, logs and counts them', async () => {
      listByUserIdResult = [{ id: 'file-001', storageKey: 'uploads/child-001/a.pdf' }];
      deleteFilesResult = { deleted: 0, failed: ['uploads/child-001/a.pdf'] };
      findByIdResult = null;
      await parentService.deleteChild('parent-001', 'child-001'); // must not throw
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          operation: 'parent:delete-child-s3-purge',
          failedCount: 1,
        })
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ filesPurged: 0, filesFailed: 1 })
      );
    });

    it('passes an empty list to deleteFiles when the child has zero files', async () => {
      listByUserIdResult = [];
      findByIdResult = null;
      await parentService.deleteChild('parent-001', 'child-001');
      expect(mockDeleteFiles).toHaveBeenCalledWith([]);
    });
  });

  describe('updateChild', () => {
    it('should update partial fields (firstName only)', async () => {
      updateResult = { ...makeUser({ id: 'child-001' }), firstName: 'Marie' };
      const result = await parentService.updateChild('parent-001', 'child-001', {
        firstName: 'Marie',
      });
      expect(result.id).toBe('child-001');
      expect(result.firstName).toBe('Marie');
    });

    it('should update multiple fields at once', async () => {
      updateResult = {
        ...makeUser({ id: 'child-001' }),
        firstName: 'Jean',
        lastName: 'Martin',
        schoolLevel: 'seconde',
      };
      const result = await parentService.updateChild('parent-001', 'child-001', {
        firstName: 'Jean',
        lastName: 'Martin',
        schoolLevel: 'seconde',
      });
      expect(result.firstName).toBe('Jean');
      expect(result.lastName).toBe('Martin');
    });

    it('changes the password through the auth module', async () => {
      await parentService.updateChild('parent-001', 'child-001', { password: 'new-password-1' });
      expect(mockSetPassword).toHaveBeenCalledWith('child-001', 'new-password-1');
    });

    it('should throw Access denied for non-child', async () => {
      childrenResult = [];
      expect(
        parentService.updateChild('parent-001', 'stranger', { firstName: 'Hack' })
      ).rejects.toThrow();
    });

    it('should throw when update returns null', async () => {
      updateResult = null;
      expect(
        parentService.updateChild('parent-001', 'child-001', { firstName: 'Test' })
      ).rejects.toThrow();
    });
  });

  describe('calculateAge (indirect via dashboard metrics)', () => {
    it('should compute correct age from dateOfBirth in metrics', async () => {
      // Child born 2010-03-15, fixture BASE_DATE=2025-06-15
      // Today is ~2026-03-02 → age should be 15 (birthday not yet passed in 2026) or 16
      const metrics = await parentService.getParentDashboardMetrics('parent-001', await parentService.getParentChildren('parent-001'));
      expect(metrics[0]?.age).toBeGreaterThanOrEqual(15);
      expect(metrics[0]?.age).toBeLessThanOrEqual(16);
    });

    it('should return 0 when dateOfBirth is missing', async () => {
      childrenResult = [makeUser({ id: 'child-001', dateOfBirth: null })];
      const metrics = await parentService.getParentDashboardMetrics('parent-001', await parentService.getParentChildren('parent-001'));
      expect(metrics[0]?.age).toBe(0);
    });
  });
});
