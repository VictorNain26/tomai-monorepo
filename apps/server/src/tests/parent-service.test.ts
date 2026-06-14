/**
 * Tests unitaires - Parent Service (services/parent.service.ts)
 * Mock: repos + auth + DB + logger
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
  parentId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// MOCKS
// ============================================

const mockLogger = createMockLogger();
mock.module('../lib/observability', () => ({ logger: mockLogger }));

// Users repository mock
let childrenResult: UserData[] = [];
let userByUsername: UserData | null = null;
let updateResult: UserData | null = null;
let deleteResult = true;
let findByIdResult: UserData | null = null;

// Files repository mock
let listByUserIdResult: { id: string; storageKey: string }[] = [];
const mockListByUserId = mock(async () => listByUserIdResult);

// Storage service mock
// Miroir du vrai contrat : deleteFile ne lève jamais, il retourne false en échec.
let deleteFileShouldFail = false;
const mockDeleteFile = mock(async () => {
  return !deleteFileShouldFail;
});

mock.module('../services/storage/scaleway-storage.service', () => ({
  deleteFile: mockDeleteFile,
}));

// RGPD art.17 — pseudonymization repo mock + call-order tracking so we can
// assert the audit trail is anonymized BEFORE the user row is erased.
const callSequence: string[] = [];
const mockPseudonymize = mock(async () => { callSequence.push('pseudonymize'); return 3; });
const mockDeleteById = mock(async () => { callSequence.push('delete'); return deleteResult; });

mock.module('../db/repositories', () => ({
  usersRepository: {
    findChildrenByParentId: mock(async () => childrenResult),
    findByUsername: mock(async () => userByUsername),
    update: mock(async () => updateResult),
    deleteById: mockDeleteById,
    findById: mock(async () => findByIdResult),
  },
  retrievalAuditRepository: {
    pseudonymizeByUserId: mockPseudonymize,
  },
  filesRepository: {
    listByUserId: mockListByUserId,
  },
  studySessionsRepository: {
    getSessionStats: mock(async () => ({
      totalSessions: 10,
      totalMinutes: 300,
      averageFrustration: 2.5,
    })),
    findByUserIdWithStats: mock(async () => [
      { id: 'sess-1', subject: 'maths', startedAt: new Date(), endedAt: null, messageCount: 5, frustrationAvg: '2.0' },
    ]),
    findById: mock(async () => ({
      id: 'sess-1',
      userId: 'child-001',
      subject: 'maths',
    })),
  },
  messagesRepository: {
    findBySessionId: mock(async () => [
      { id: 'msg-1', role: 'user', content: 'Hello', frustrationLevel: null, createdAt: new Date(), aiModel: null, tokensUsed: null },
    ]),
  },
  progressRepository: {
    getProgressSummary: mock(async () => ({
      subjectProgress: [
        { subject: 'maths', conceptCount: 5, averageMastery: 0.7, totalPracticeTime: 120 },
      ],
    })),
  },
}));

// Auth mock
mock.module('../lib/auth', () => ({
  auth: {
    api: {
      signUpEmail: mock(async () => ({
        user: { id: 'new-child-001' },
      })),
    },
  },
}));

// DB mock for pool limiter and direct queries
mock.module('../db/connection', () => ({
  db: {
    selectDistinct: mock(() => ({
      from: mock(() => ({
        where: mock(() => [{ subject: 'maths' }]),
      })),
    })),
    select: mock(() => ({
      from: mock(() => ({
        where: mock(() => ({
          orderBy: mock(() => ({
            limit: mock(() => [{ startedAt: new Date() }]),
          })),
          limit: mock(() => [{ studyDays: 5 }]),
        })),
      })),
    })),
  },
}));

mock.module('../db/schema', () => ({
  studySessions: { userId: 'userId', subject: 'subject', startedAt: 'startedAt' },
}));

mock.module('../db/pool-limiter', () => ({
  withPoolLimit: mock(async (fn: () => Promise<unknown>) => fn()),
}));

mock.module('drizzle-orm', () => ({
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ type: 'sql', strings, values }),
  eq: (...args: unknown[]) => ({ type: 'eq', args }),
  desc: (...args: unknown[]) => ({ type: 'desc', args }),
}));

// Import after mocks
const { ParentService } = await import('../services/parent.service');

let parentService: InstanceType<typeof ParentService>;

beforeEach(() => {
  parentService = new ParentService();
  const child = makeUser({ id: 'child-001', parentId: 'parent-001' });
  childrenResult = [child];
  userByUsername = null;
  updateResult = { ...child, schoolLevel: 'seconde' };
  deleteResult = true;
  findByIdResult = null;
  listByUserIdResult = [];
  deleteFileShouldFail = false;
  mockDeleteFile.mockClear();
  mockListByUserId.mockClear();
  mockLogger.error.mockClear();
  mockLogger.info.mockClear();
  callSequence.length = 0;
  mockPseudonymize.mockClear();
  mockDeleteById.mockClear();
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
      const metrics = await parentService.getParentDashboardMetrics('parent-001');
      expect(metrics.length).toBe(1);
      expect(metrics[0]?.totalSessions).toBe(10);
    });

    it('should return empty when no children', async () => {
      childrenResult = [];
      const metrics = await parentService.getParentDashboardMetrics('parent-no-kids');
      expect(metrics.length).toBe(0);
    });
  });

  describe('getStudentSessions', () => {
    it('should return sessions for valid child', async () => {
      const sessions = await parentService.getStudentSessions('parent-001', 'child-001');
      expect(sessions.length).toBe(1);
      expect(sessions[0]?.id).toBe('sess-1');
    });

    it('should throw Access denied for non-child', async () => {
      expect(
        parentService.getStudentSessions('parent-001', 'stranger-001')
      ).rejects.toThrow();
    });
  });

  describe('getSessionMessages', () => {
    it('should return messages for valid session', async () => {
      const messages = await parentService.getSessionMessages('parent-001', 'sess-1');
      expect(messages.length).toBe(1);
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

    it('pseudonymizes the retrieval audit trail BEFORE erasing the user (RGPD art.17)', async () => {
      findByIdResult = null;
      await parentService.deleteChild('parent-001', 'child-001');
      expect(mockPseudonymize).toHaveBeenCalledWith('child-001');
      // Defensive order: never leave an identifiable audit row pointing at a
      // user that has already been deleted.
      expect(callSequence.indexOf('pseudonymize')).toBeLessThan(callSequence.indexOf('delete'));
    });

    it('should throw for non-child', async () => {
      childrenResult = [];
      expect(
        parentService.deleteChild('parent-001', 'stranger')
      ).rejects.toThrow();
    });

    it('collects storage keys, deletes user, then calls deleteFile for each key', async () => {
      listByUserIdResult = [
        { id: 'file-001', storageKey: 'uploads/child-001/a.pdf' },
        { id: 'file-002', storageKey: 'uploads/child-001/b.png' },
      ];
      findByIdResult = null;
      await parentService.deleteChild('parent-001', 'child-001');
      expect(mockDeleteFile).toHaveBeenCalledTimes(2);
      expect(mockDeleteFile).toHaveBeenCalledWith('uploads/child-001/a.pdf');
      expect(mockDeleteFile).toHaveBeenCalledWith('uploads/child-001/b.png');
    });

    it('does not throw when an S3 delete fails, logs the error and counts the failure', async () => {
      listByUserIdResult = [{ id: 'file-001', storageKey: 'uploads/child-001/a.pdf' }];
      deleteFileShouldFail = true;
      findByIdResult = null;
      await parentService.deleteChild('parent-001', 'child-001'); // must not throw
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          operation: 'parent:delete-child-s3-purge',
          storageKey: 'uploads/child-001/a.pdf',
        })
      );
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ filesPurged: 0, filesFailed: 1 })
      );
    });

    it('makes no storage calls when the child has zero files', async () => {
      listByUserIdResult = [];
      findByIdResult = null;
      await parentService.deleteChild('parent-001', 'child-001');
      expect(mockDeleteFile).not.toHaveBeenCalled();
    });
  });

  describe('isParentOf', () => {
    it('should return true for parent-child relationship', async () => {
      expect(await parentService.isParentOf('parent-001', 'child-001')).toBe(true);
    });

    it('should return false for non-child', async () => {
      expect(await parentService.isParentOf('parent-001', 'stranger')).toBe(false);
    });

    it('should return false on error', async () => {
      childrenResult = []; // Simulate empty result
      const result = await parentService.isParentOf('err-parent', 'child-001');
      expect(result).toBe(false);
    });
  });

  describe('updateChild', () => {
    it('should update partial fields (firstName only)', async () => {
      updateResult = { ...makeUser({ id: 'child-001', parentId: 'parent-001' }), firstName: 'Marie' };
      const result = await parentService.updateChild('parent-001', 'child-001', {
        firstName: 'Marie',
      });
      expect(result.id).toBe('child-001');
      expect(result.firstName).toBe('Marie');
    });

    it('should update multiple fields at once', async () => {
      updateResult = {
        ...makeUser({ id: 'child-001', parentId: 'parent-001' }),
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

  describe('getParentStudentProgress', () => {
    it('should return progress by subject for a specific child', async () => {
      const progress = await parentService.getParentStudentProgress('parent-001', 'child-001');
      expect(progress.length).toBeGreaterThanOrEqual(1);
      expect(progress[0]?.subject).toBe('maths');
      expect(progress[0]?.conceptsMastered).toBe(5);
      expect(progress[0]?.avgMastery).toBe(0.7);
    });

    it('should return empty array for non-existent child (filtered out)', async () => {
      const progress = await parentService.getParentStudentProgress('parent-001', 'stranger');
      expect(progress.length).toBe(0);
    });

    it('should return progress for all children when no studentId', async () => {
      const progress = await parentService.getParentStudentProgress('parent-001');
      expect(progress.length).toBeGreaterThanOrEqual(1);
      expect(progress[0]?.studentId).toBe('child-001');
    });
  });

  describe('getParentStatistics', () => {
    it('should aggregate stats across all children', async () => {
      const stats = await parentService.getParentStatistics('parent-001');
      expect(stats.totalChildren).toBe(1);
      expect(stats.totalSessions).toBe(10);
      expect(stats.totalStudyTime).toBe(300);
      expect(stats.avgFrustration).toBe(2.5);
    });

    it('should return zero stats for parent with no children', async () => {
      childrenResult = [];
      const stats = await parentService.getParentStatistics('parent-no-kids');
      expect(stats.totalChildren).toBe(0);
      expect(stats.totalSessions).toBe(0);
      expect(stats.totalStudyTime).toBe(0);
      expect(stats.avgFrustration).toBe(0);
      expect(stats.activeStudents).toBe(0);
    });
  });

  describe('calculateAge (indirect via dashboard metrics)', () => {
    it('should compute correct age from dateOfBirth in metrics', async () => {
      // Child born 2010-03-15, fixture BASE_DATE=2025-06-15
      // Today is ~2026-03-02 → age should be 15 (birthday not yet passed in 2026) or 16
      const metrics = await parentService.getParentDashboardMetrics('parent-001');
      expect(metrics[0]?.age).toBeGreaterThanOrEqual(15);
      expect(metrics[0]?.age).toBeLessThanOrEqual(16);
    });

    it('should return 0 when dateOfBirth is missing', async () => {
      childrenResult = [makeUser({ id: 'child-001', parentId: 'parent-001', dateOfBirth: null })];
      const metrics = await parentService.getParentDashboardMetrics('parent-001');
      expect(metrics[0]?.age).toBe(0);
    });
  });
});
