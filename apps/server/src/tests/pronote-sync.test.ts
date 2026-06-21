/**
 * Tests unitaires - PronoteSyncService
 * Mock: db, drizzle-orm, encryption, logger
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';

// ============================================
// MOCKS
// ============================================

const mockLogger = createMockLogger();
mock.module('../lib/observability', () => ({ logger: mockLogger }));

// Encryption mocks
const mockEncrypt = mock(async (val: string) => `encrypted:${val}`);
const mockDecrypt = mock(async (val: string) => val.replace('encrypted:', ''));

mock.module('../lib/encryption', () => ({
  encrypt: mockEncrypt,
  decrypt: mockDecrypt,
}));

// DB mock state
let findResult: Record<string, unknown> | undefined = undefined;
let upsertCalled = false;
let deleteCalled = false;
let capturedOrderBy: unknown[] = [];
let capturedLimit: number | undefined = undefined;

const mockLimit = mock((n: number) => {
  capturedLimit = n;
  return findResult ? [findResult] : [];
});

const mockOrderBy = mock((...args: unknown[]) => {
  capturedOrderBy = args;
  return { limit: mockLimit };
});

const mockWhere = mock(() => {
  return { orderBy: mockOrderBy };
});

const mockReturning = mock(() => {
  upsertCalled = true;
  return Promise.resolve([{ id: 'mock-cred-id' }]);
});

const mockOnConflictDoUpdate = mock(() => ({
  returning: mockReturning,
}));

const mockValues = mock(() => ({
  onConflictDoUpdate: mockOnConflictDoUpdate,
}));

const mockDeleteWhere = mock(async () => {
  deleteCalled = true;
});

// groupBy stub for listCredentialSummaries child-count query (returns empty array → childCount 0)
const mockGroupBy = mock(() => Promise.resolve([]));

mock.module('../db/connection', () => ({
  db: {
    select: mock(() => ({
      from: mock(() => ({
        where: mockWhere,
        groupBy: mockGroupBy,
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
  pronoteCredentials: {
    id: 'id',
    userId: 'userId',
    establishmentUrl: 'establishmentUrl',
    establishmentName: 'establishmentName',
    encryptedToken: 'encryptedToken',
    encryptedMetadata: 'encryptedMetadata',
    tokenExpiresAt: 'tokenExpiresAt',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  },
  pronoteChildResources: {
    id: 'id',
    credentialId: 'credentialId',
    parentUserId: 'parentUserId',
    childUserId: 'childUserId',
    resourceId: 'resourceId',
    className: 'className',
    establishmentName: 'establishmentName',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  },
}));

mock.module('drizzle-orm', () => ({
  eq: (...args: unknown[]) => ({ type: 'eq', args }),
  asc: (col: unknown) => ({ type: 'asc', col }),
  and: (...args: unknown[]) => args,
  count: (col: unknown) => ({ fn: 'count', col }),
}));

// Import after mocks
const { pronoteSyncService } = await import('../services/pronote-sync.service');

// ============================================
// Test data
// ============================================

const VALID_USER_ID = 'user-001';
const VALID_TOKEN = 'pronote-session-token-abc123';
const VALID_METADATA = JSON.stringify({
  instanceUrl: 'https://demo.index-education.net/pronote',
  username: 'jean.dupont',
  deviceUuid: 'device-uuid-123',
});
const VALID_EXPIRES = '2026-04-10T12:00:00Z';

// ============================================
// PronoteSyncService
// ============================================

describe('PronoteSyncService', () => {
  beforeEach(() => {
    findResult = undefined;
    upsertCalled = false;
    deleteCalled = false;
    capturedOrderBy = [];
    capturedLimit = undefined;
    mockEncrypt.mockClear();
    mockDecrypt.mockClear();
    mockLogger.info.mockClear();
    mockLogger.error.mockClear();
    mockLogger.warn.mockClear();
    mockReturning.mockClear();
    mockOnConflictDoUpdate.mockClear();
    mockOrderBy.mockClear();
    mockLimit.mockClear();
  });

  // ============================================
  // upsertCredentials
  // ============================================

  describe('upsertCredentials', () => {
    it('should upsert credentials (atomic insert or update)', async () => {
      const result = await pronoteSyncService.upsertCredentials(VALID_USER_ID, {
        token: VALID_TOKEN,
        metadata: VALID_METADATA,
        tokenExpiresAt: VALID_EXPIRES,
      });

      expect(result.success).toBe(true);
      expect(upsertCalled).toBe(true);
      expect(mockEncrypt).toHaveBeenCalledTimes(2);
    });

    it('should reject empty token', async () => {
      const result = await pronoteSyncService.upsertCredentials(VALID_USER_ID, {
        token: '',
        metadata: VALID_METADATA,
        tokenExpiresAt: VALID_EXPIRES,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(upsertCalled).toBe(false);
    });

    it('should reject invalid tokenExpiresAt date', async () => {
      const result = await pronoteSyncService.upsertCredentials(VALID_USER_ID, {
        token: VALID_TOKEN,
        metadata: VALID_METADATA,
        tokenExpiresAt: 'not-a-date',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('valid ISO date');
      expect(upsertCalled).toBe(false);
    });

    it('should reject invalid metadata JSON', async () => {
      const result = await pronoteSyncService.upsertCredentials(VALID_USER_ID, {
        token: VALID_TOKEN,
        metadata: 'not-valid-json{{{',
        tokenExpiresAt: VALID_EXPIRES,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(upsertCalled).toBe(false);
    });
  });

  // ============================================
  // getCredentials
  // ============================================

  describe('getCredentials', () => {
    it('should return null when no credentials exist', async () => {
      findResult = undefined;

      const result = await pronoteSyncService.getCredentials(VALID_USER_ID);
      expect(result).toBeNull();
    });

    it('should return decrypted credentials when they exist', async () => {
      findResult = {
        id: 'cred-001',
        userId: VALID_USER_ID,
        encryptedToken: `encrypted:${VALID_TOKEN}`,
        encryptedMetadata: `encrypted:${VALID_METADATA}`,
        tokenExpiresAt: new Date(VALID_EXPIRES),
      };

      const result = await pronoteSyncService.getCredentials(VALID_USER_ID);

      expect(result).not.toBeNull();
      expect(result?.token).toBe(VALID_TOKEN);
      expect(result?.metadata).toBe(VALID_METADATA);
      expect(mockDecrypt).toHaveBeenCalledTimes(2);
    });

    it('should apply orderBy(createdAt asc) and limit(1) for determinism', async () => {
      findResult = {
        id: 'cred-001',
        userId: VALID_USER_ID,
        encryptedToken: `encrypted:${VALID_TOKEN}`,
        encryptedMetadata: `encrypted:${VALID_METADATA}`,
        tokenExpiresAt: new Date(VALID_EXPIRES),
      };

      await pronoteSyncService.getCredentials(VALID_USER_ID);

      expect(capturedLimit).toBe(1);
      expect(capturedOrderBy).toHaveLength(1);
      expect(capturedOrderBy[0]).toEqual({ type: 'asc', col: 'createdAt' });
    });

    it('should always return the oldest credential regardless of result set size', async () => {
      // Mock returns a single row (the mock resolves limit=1 at the mock layer).
      // This test verifies that even when multiple credentials would exist,
      // the query uses limit(1), so at most one row is ever processed.
      findResult = {
        id: 'cred-oldest',
        userId: VALID_USER_ID,
        encryptedToken: `encrypted:${VALID_TOKEN}`,
        encryptedMetadata: `encrypted:${VALID_METADATA}`,
        tokenExpiresAt: new Date(VALID_EXPIRES),
      };

      const result = await pronoteSyncService.getCredentials(VALID_USER_ID);

      expect(capturedLimit).toBe(1);
      expect(result?.token).toBe(VALID_TOKEN);
    });
  });

  // ============================================
  // deleteCredentials
  // ============================================

  describe('deleteCredentials', () => {
    it('should delete credentials', async () => {
      const result = await pronoteSyncService.deleteCredentials(VALID_USER_ID);
      expect(result).toBe(true);
      expect(deleteCalled).toBe(true);
    });

    it('should return true even when no credentials exist', async () => {
      const result = await pronoteSyncService.deleteCredentials(VALID_USER_ID);
      expect(result).toBe(true);
      expect(deleteCalled).toBe(true);
    });
  });
});
