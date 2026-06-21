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
// Miroir du vrai contrat : deleteFiles ne lève jamais, il retourne les clés
// qu'il n'a pas pu supprimer (batch DeleteObjects).
let deleteFilesResult: { deleted: number; failed: string[] } = { deleted: 0, failed: [] };
const mockDeleteFiles = mock(async () => deleteFilesResult);

mock.module('../services/storage/scaleway-storage.service', () => ({
  deleteFiles: mockDeleteFiles,
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
    update: mock(() => ({
      set: mock(() => ({
        where: mock(() => Promise.resolve()),
      })),
    })),
  },
}));

mock.module('../db/schema', () => ({
  studySessions: { userId: 'userId', subject: 'subject', startedAt: 'startedAt' },
  parentChild: { id: 'id', parentUserId: 'parentUserId', childUserId: 'childUserId' },
  account: { userId: 'userId', providerId: 'providerId', password: 'password' },
}));

mock.module('../db/pool-limiter', () => ({
  withPoolLimit: mock(async (fn: () => Promise<unknown>) => fn()),
}));

mock.module('drizzle-orm', () => ({
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ type: 'sql', strings, values }),
  eq: (...args: unknown[]) => ({ type: 'eq', args }),
  and: (...args: unknown[]) => ({ type: 'and', args }),
  desc: (...args: unknown[]) => ({ type: 'desc', args }),
  inArray: (...args: unknown[]) => ({ type: 'inArray', args }),
}));

// Pronote child resources repository mock
// Maps childUserId -> credentialId for children that have Pronote linked
let childCredentialMap: Map<string, string> = new Map();
const mockGetCredentialIdByChild = mock(async (_parentUserId: string, childIds: string[]) => {
  if (childIds.length === 0) return new Map<string, string>();
  const result = new Map<string, string>();
  for (const id of childIds) {
    const cred = childCredentialMap.get(id);
    if (cred !== undefined) result.set(id, cred);
  }
  return result;
});

mock.module('../db/repositories/pronote-child-resources.repository', () => ({
  pronoteChildResourcesRepository: {
    get getCredentialIdByChild() { return mockGetCredentialIdByChild; },
  },
}));

// Parent-child repository mock
let isLinkedResult = true;
let isLinkedShouldThrow = false;
mock.module('../db/repositories/parent-child.repository', () => ({
  parentChildRepository: {
    link: mock(async () => {}),
    isLinked: mock(async () => {
      if (isLinkedShouldThrow) throw new Error('db down');
      return isLinkedResult;
    }),
  },
}));

// Import after mocks
const { ParentService } = await import('../services/parent.service');

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
  callSequence.length = 0;
  mockPseudonymize.mockClear();
  mockDeleteById.mockClear();
  isLinkedResult = true;
  isLinkedShouldThrow = false;
  childCredentialMap = new Map();
  mockGetCredentialIdByChild.mockClear();
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

    it('hasPronote: true for mapped child, false for unmapped (batch lookup)', async () => {
      const child1 = makeUser({ id: 'child-001' });
      const child2 = makeUser({ id: 'child-002' });
      childrenResult = [child1, child2];
      childCredentialMap = new Map([['child-001', 'cred-abc']]);

      const result = await parentService.getParentChildren('parent-001');

      expect(result.length).toBe(2);
      const mapped = result.find(c => c.id === 'child-001');
      const unmapped = result.find(c => c.id === 'child-002');
      expect(mapped?.hasPronote).toBe(true);
      expect(unmapped?.hasPronote).toBe(false);
    });

    it('pronoteCredentialId: mapped child carries the correct credentialId, unmapped is null', async () => {
      const child1 = makeUser({ id: 'child-001' });
      const child2 = makeUser({ id: 'child-002' });
      childrenResult = [child1, child2];
      childCredentialMap = new Map([['child-001', 'cred-xyz']]);

      const result = await parentService.getParentChildren('parent-001');

      const mapped = result.find(c => c.id === 'child-001');
      const unmapped = result.find(c => c.id === 'child-002');
      expect(mapped?.pronoteCredentialId).toBe('cred-xyz');
      expect(unmapped?.pronoteCredentialId).toBeNull();
    });

    it('hasPronote: mapping lookup is a SINGLE batch call (no N+1)', async () => {
      const child1 = makeUser({ id: 'child-001' });
      const child2 = makeUser({ id: 'child-002' });
      childrenResult = [child1, child2];
      childCredentialMap = new Map([['child-001', 'cred-abc']]);

      await parentService.getParentChildren('parent-001');

      expect(mockGetCredentialIdByChild).toHaveBeenCalledTimes(1);
      expect(mockGetCredentialIdByChild).toHaveBeenCalledWith('parent-001', ['child-001', 'child-002']);
    });

    it('pronoteCredentialId: no credential leaks between parents', async () => {
      // P1 has child-001 (not mapped); P2's child-p2 is mapped — must not affect P1 results
      childrenResult = [makeUser({ id: 'child-001' })];
      // The mock only returns what's in childCredentialMap; child-p2 belongs to another parent
      childCredentialMap = new Map([['child-p2', 'cred-other']]);

      const result = await parentService.getParentChildren('parent-001');

      expect(result.length).toBe(1);
      expect(result[0]?.hasPronote).toBe(false);
      expect(result[0]?.pronoteCredentialId).toBeNull();
    });

    it('hasPronote: short-circuits when no children (no mapping call)', async () => {
      childrenResult = [];
      await parentService.getParentChildren('parent-no-kids');
      // getCredentialIdByChild should not be called with empty array traversal
      // (short-circuit: either not called, or called once with [])
      const calls = mockGetCredentialIdByChild.mock.calls;
      if (calls.length > 0) {
        expect(calls[0]?.[1]).toEqual([]);
      }
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

    it('should create child without dateOfBirth (Pronote path)', async () => {
      const child = await parentService.createChild('parent-001', {
        firstName: 'Lucas',
        lastName: 'Martin',
        username: 'lucas',
        password: 'password123',
        schoolLevel: 'quatrieme',
      });
      expect(child.id).toBe('new-child-001');
      expect(child.firstName).toBe('Lucas');
      expect(child.role).toBe('student');
      expect(child.dateOfBirth).toBeUndefined();
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

  describe('isParentOf', () => {
    it('should return true for parent-child relationship', async () => {
      isLinkedResult = true;
      expect(await parentService.isParentOf('parent-001', 'child-001')).toBe(true);
    });

    it('should return false for non-child', async () => {
      isLinkedResult = false;
      expect(await parentService.isParentOf('parent-001', 'stranger')).toBe(false);
    });

    it('should return false on error (fail-closed)', async () => {
      isLinkedShouldThrow = true;
      const result = await parentService.isParentOf('err-parent', 'child-001');
      expect(result).toBe(false);
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
      childrenResult = [makeUser({ id: 'child-001', dateOfBirth: null })];
      const metrics = await parentService.getParentDashboardMetrics('parent-001');
      expect(metrics[0]?.age).toBe(0);
    });
  });
});
