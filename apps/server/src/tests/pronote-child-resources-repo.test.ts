import { describe, it, expect, beforeEach, mock } from 'bun:test';

// ============================================
// MOCKS
// ============================================

let selectResult: Record<string, unknown> | undefined = undefined;
let deleteCalled = false;

const mockOnConflictDoUpdate = mock(async () => {});

const mockValues = mock(() => ({
  onConflictDoUpdate: mockOnConflictDoUpdate,
}));

const mockSelectWhere = mock(() => {
  return selectResult ? [selectResult] : [];
});

const mockDeleteWhere = mock(async () => {
  deleteCalled = true;
});

mock.module('../db/connection', () => ({
  db: {
    select: mock(() => ({
      from: mock(() => ({
        where: mockSelectWhere,
      })),
    })),
    insert: mock(() => ({
      values: mockValues,
    })),
    delete: mock(() => ({
      where: mockDeleteWhere,
    })),
  },
}));

mock.module('../db/schema', () => ({
  pronoteChildResources: {
    childUserId: 'childUserId',
    parentUserId: 'parentUserId',
    credentialId: 'credentialId',
    resourceId: 'resourceId',
    updatedAt: 'updatedAt',
  },
}));

mock.module('drizzle-orm', () => ({
  eq: (...args: unknown[]) => ({ type: 'eq', args }),
}));

// Import after mocks
const { pronoteChildResourcesRepository } = await import(
  '../db/repositories/pronote-child-resources.repository'
);

// ============================================
// Test data
// ============================================

const PARENT_USER_ID = 'parent-001';
const CHILD_USER_ID = 'child-001';
const CREDENTIAL_ID = 'cred-uuid-001';
const RESOURCE_ID = 42;

// ============================================
// PronoteChildResourcesRepository
// ============================================

describe('PronoteChildResourcesRepository', () => {
  beforeEach(() => {
    selectResult = undefined;
    deleteCalled = false;
    mockOnConflictDoUpdate.mockClear();
    mockValues.mockClear();
    mockSelectWhere.mockClear();
    mockDeleteWhere.mockClear();
  });

  describe('upsertMapping', () => {
    it('calls insert().values().onConflictDoUpdate() with credentialId and parentUserId+childUserId conflict target', async () => {
      await pronoteChildResourcesRepository.upsertMapping(
        PARENT_USER_ID,
        CHILD_USER_ID,
        CREDENTIAL_ID,
        RESOURCE_ID,
        null,
        null,
      );

      expect(mockValues).toHaveBeenCalledTimes(1);
      const valuesArg = (mockValues.mock.calls as unknown as Array<[Record<string, unknown>]>)[0]?.[0];
      expect(valuesArg?.parentUserId).toBe(PARENT_USER_ID);
      expect(valuesArg?.childUserId).toBe(CHILD_USER_ID);
      expect(valuesArg?.credentialId).toBe(CREDENTIAL_ID);
      expect(valuesArg?.resourceId).toBe(RESOURCE_ID);

      expect(mockOnConflictDoUpdate).toHaveBeenCalledTimes(1);
      const conflictArg = (mockOnConflictDoUpdate.mock.calls as unknown as Array<[Record<string, unknown>]>)[0]?.[0];
      expect(conflictArg?.target).toBeDefined();
    });
  });

  describe('getMapping', () => {
    it('returns { parentUserId, credentialId, resourceId } when a row exists with a credentialId', async () => {
      selectResult = { parentUserId: PARENT_USER_ID, credentialId: CREDENTIAL_ID, resourceId: RESOURCE_ID };

      const result = await pronoteChildResourcesRepository.getMapping(CHILD_USER_ID);

      expect(result).toEqual({ parentUserId: PARENT_USER_ID, credentialId: CREDENTIAL_ID, resourceId: RESOURCE_ID });
    });

    it('returns null when credentialId is null (mapping not resolvable)', async () => {
      selectResult = { parentUserId: PARENT_USER_ID, credentialId: null, resourceId: RESOURCE_ID };

      const result = await pronoteChildResourcesRepository.getMapping(CHILD_USER_ID);

      expect(result).toBeNull();
    });

    it('returns null when no row exists', async () => {
      selectResult = undefined;

      const result = await pronoteChildResourcesRepository.getMapping(CHILD_USER_ID);

      expect(result).toBeNull();
    });
  });

  describe('deleteByChild', () => {
    it('calls delete().where() with childUserId', async () => {
      await pronoteChildResourcesRepository.deleteByChild(CHILD_USER_ID);

      expect(mockDeleteWhere).toHaveBeenCalledTimes(1);
      expect(deleteCalled).toBe(true);
    });
  });
});
