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
let insertCalled = false;
let updateCalled = false;
let deleteCalled = false;

const mockWhere = mock(() => {
  return findResult ? [findResult] : [];
});

const mockSet = mock(() => ({
  where: mock(async () => {
    updateCalled = true;
  }),
}));

const mockValues = mock(async () => {
  insertCalled = true;
});

const mockDeleteWhere = mock(async () => {
  deleteCalled = true;
});

mock.module('../db/connection', () => ({
  db: {
    select: mock(() => ({
      from: mock(() => ({
        where: mockWhere,
      })),
    })),
    insert: mock(() => ({
      values: mockValues,
    })),
    update: mock(() => ({
      set: mockSet,
    })),
    delete: mock(() => ({
      where: mockDeleteWhere,
    })),
  },
}));

mock.module('../db/schema', () => ({
  pronoteCredentials: {
    userId: 'userId',
    encryptedToken: 'encryptedToken',
    encryptedMetadata: 'encryptedMetadata',
    tokenExpiresAt: 'tokenExpiresAt',
    updatedAt: 'updatedAt',
  },
}));

mock.module('drizzle-orm', () => ({
  eq: (...args: unknown[]) => ({ type: 'eq', args }),
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
    insertCalled = false;
    updateCalled = false;
    deleteCalled = false;
    mockEncrypt.mockClear();
    mockDecrypt.mockClear();
    mockLogger.info.mockClear();
    mockLogger.error.mockClear();
    mockLogger.warn.mockClear();
  });

  // ============================================
  // upsertCredentials
  // ============================================

  describe('upsertCredentials', () => {
    it('should create new credentials when none exist', async () => {
      findResult = undefined;

      const result = await pronoteSyncService.upsertCredentials(VALID_USER_ID, {
        token: VALID_TOKEN,
        metadata: VALID_METADATA,
        tokenExpiresAt: VALID_EXPIRES,
      });

      expect(result.success).toBe(true);
      expect(insertCalled).toBe(true);
      expect(updateCalled).toBe(false);
      expect(mockEncrypt).toHaveBeenCalledTimes(2);
    });

    it('should update existing credentials', async () => {
      findResult = {
        id: 'cred-001',
        userId: VALID_USER_ID,
        encryptedToken: 'encrypted:old-token',
        encryptedMetadata: 'encrypted:old-meta',
        tokenExpiresAt: new Date('2026-03-01'),
      };

      const result = await pronoteSyncService.upsertCredentials(VALID_USER_ID, {
        token: VALID_TOKEN,
        metadata: VALID_METADATA,
        tokenExpiresAt: VALID_EXPIRES,
      });

      expect(result.success).toBe(true);
      expect(updateCalled).toBe(true);
      expect(insertCalled).toBe(false);
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
      expect(insertCalled).toBe(false);
      expect(updateCalled).toBe(false);
    });

    it('should reject invalid metadata JSON', async () => {
      const result = await pronoteSyncService.upsertCredentials(VALID_USER_ID, {
        token: VALID_TOKEN,
        metadata: 'not-valid-json{{{',
        tokenExpiresAt: VALID_EXPIRES,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(insertCalled).toBe(false);
      expect(updateCalled).toBe(false);
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
