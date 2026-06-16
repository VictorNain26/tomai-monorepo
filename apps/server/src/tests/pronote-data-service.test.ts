/**
 * Tests — PronoteDataService
 * Mock: pronoteChildResourcesRepository, pronoteSyncService, pawnoteServerAdapter
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';

// ============================================
// MOCKS — must precede service import
// ============================================

const mockGetMapping = mock(async (_childId: string) => null as { parentUserId: string; resourceId: number } | null);
const mockGetCredentials = mock(async (_userId: string) => null as { token: string; metadata: string; tokenExpiresAt: string } | null);
const mockUpsertCredentials = mock(async () => ({ success: true }));
const mockConnect = mock(async () => ({ token: 'rotated-token', username: 'jean.dupont', handle: {} }));
const mockGetGrades = mock(async () => [
  { subject: 'Maths', value: 15, scale: 20, date: '2026-06-01', comment: null },
]);
const mockGetHomework = mock(async () => [
  { subject: 'Histoire', description: 'Réviser', dueDate: '2026-06-10', done: false },
]);
const mockGetTimetable = mock(async () => [
  { subject: 'SVT', start: '2026-06-10T08:00:00.000Z', end: '2026-06-10T09:00:00.000Z', room: 'A1', canceled: false },
]);

mock.module('../db/repositories/pronote-child-resources.repository', () => ({
  pronoteChildResourcesRepository: {
    getMapping: mockGetMapping,
  },
}));

mock.module('../services/pronote-sync.service', () => ({
  pronoteSyncService: {
    getCredentials: mockGetCredentials,
    upsertCredentials: mockUpsertCredentials,
  },
}));

mock.module('../services/pronote/pawnote-server.adapter', () => ({
  pawnoteServerAdapter: {
    connect: mockConnect,
    getGrades: mockGetGrades,
    getHomework: mockGetHomework,
    getTimetable: mockGetTimetable,
  },
  PronoteReauthRequired: class PronoteReauthRequired extends Error {
    constructor(cause: unknown) {
      super('reauth');
      this.name = 'PronoteReauthRequired';
      this.cause = cause;
    }
  },
}));

// Import after mocks
const {
  pronoteDataService,
  PronoteResourceNotMappedError,
  PronoteNotConnectedError,
  PronoteMetadataError,
} = await import('../services/pronote/pronote-data.service');

// ============================================
// Test data
// ============================================

const CHILD_ID = 'child-001';
const PARENT_ID = 'parent-001';
const RESOURCE_ID = 0;
const VALID_METADATA = JSON.stringify({
  instanceUrl: 'https://demo.index-education.net/pronote',
  username: 'jean.dupont',
  deviceUuid: 'device-uuid-123',
  accountKind: 7,
});
const VALID_CREDENTIALS = {
  token: 'stored-token-abc',
  metadata: VALID_METADATA,
  tokenExpiresAt: '2026-12-31T00:00:00Z',
};
const VALID_MAPPING = { parentUserId: PARENT_ID, resourceId: RESOURCE_ID };

// ============================================
// PronoteDataService
// ============================================

describe('PronoteDataService', () => {
  beforeEach(() => {
    mockGetMapping.mockClear();
    mockGetCredentials.mockClear();
    mockUpsertCredentials.mockClear();
    mockConnect.mockClear();
    mockGetGrades.mockClear();
    mockGetHomework.mockClear();
    mockGetTimetable.mockClear();

    // Reset to happy-path defaults
    mockGetMapping.mockImplementation(async () => VALID_MAPPING);
    mockGetCredentials.mockImplementation(async () => VALID_CREDENTIALS);
    mockConnect.mockImplementation(async () => ({ token: 'rotated-token', username: 'jean.dupont', handle: {} }));
    mockGetGrades.mockImplementation(async () => [
      { subject: 'Maths', value: 15, scale: 20, date: '2026-06-01', comment: null },
    ]);
    mockGetHomework.mockImplementation(async () => [
      { subject: 'Histoire', description: 'Réviser', dueDate: '2026-06-10', done: false },
    ]);
    mockGetTimetable.mockImplementation(async () => [
      { subject: 'SVT', start: '2026-06-10T08:00:00.000Z', end: '2026-06-10T09:00:00.000Z', room: 'A1', canceled: false },
    ]);
  });

  // ============================================
  // Happy path: cache MISS → connect → read → re-persist
  // ============================================

  describe('getGrades — cache miss', () => {
    it('returns grades using stored credentials and re-persists the rotated token', async () => {
      const grades = await pronoteDataService.getGrades(CHILD_ID);

      expect(grades).toHaveLength(1);
      expect(grades[0]!.subject).toBe('Maths');

      // connect was called with stored token
      expect(mockConnect).toHaveBeenCalledTimes(1);
      const connectArg = (mockConnect.mock.calls as unknown as Array<[Record<string, unknown>]>)[0]?.[0];
      expect(connectArg?.token).toBe('stored-token-abc');
      expect(connectArg?.url).toBe('https://demo.index-education.net/pronote');

      // rotated token re-persisted with existing metadata and tokenExpiresAt
      expect(mockUpsertCredentials).toHaveBeenCalledTimes(1);
      const upsertArgs = (mockUpsertCredentials.mock.calls as unknown as Array<[string, Record<string, unknown>]>)[0];
      expect(upsertArgs?.[0]).toBe(PARENT_ID);
      expect(upsertArgs?.[1]?.token).toBe('rotated-token');
      expect(upsertArgs?.[1]?.metadata).toBe(VALID_METADATA);
      expect(upsertArgs?.[1]?.tokenExpiresAt).toBe(VALID_CREDENTIALS.tokenExpiresAt);

      // reads called with resourceId from mapping
      expect(mockGetGrades).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================
  // Cache hit: second call skips connect + upsert
  // ============================================

  describe('cache hit', () => {
    it('does not call connect or upsertCredentials on a second call for the same parent', async () => {
      // Use a distinct childId to isolate this test's cache entry from other tests
      const childIdForCacheTest = 'child-cache-test';
      mockGetMapping.mockImplementation(async () => ({ parentUserId: 'parent-cache-test', resourceId: 0 }));
      mockGetCredentials.mockImplementation(async () => VALID_CREDENTIALS);

      await pronoteDataService.getGrades(childIdForCacheTest);
      mockConnect.mockClear();
      mockUpsertCredentials.mockClear();
      mockGetGrades.mockClear();

      await pronoteDataService.getGrades(childIdForCacheTest);

      expect(mockConnect).not.toHaveBeenCalled();
      expect(mockUpsertCredentials).not.toHaveBeenCalled();
      expect(mockGetGrades).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================
  // Error: mapping not found
  // ============================================

  describe('PronoteResourceNotMappedError', () => {
    it('throws when getMapping returns null', async () => {
      mockGetMapping.mockImplementation(async () => null);

      // eslint-disable-next-line @typescript-eslint/await-thenable -- bun:test .rejects.toBeInstanceOf() is not typed as Promise but is awaitable
      await expect(pronoteDataService.getGrades(CHILD_ID)).rejects.toBeInstanceOf(
        PronoteResourceNotMappedError,
      );
    });

    it('carries the childId', async () => {
      mockGetMapping.mockImplementation(async () => null);

      const err = await pronoteDataService.getGrades(CHILD_ID).catch((e: unknown) => e);
      expect((err as InstanceType<typeof PronoteResourceNotMappedError>).childId).toBe(CHILD_ID);
    });
  });

  // ============================================
  // Error: no credentials stored
  // (use distinct child/parent IDs — singleton cache persists across tests)
  // ============================================

  describe('PronoteNotConnectedError', () => {
    it('throws when getCredentials returns null', async () => {
      const childIdNC = 'child-no-creds';
      const parentIdNC = 'parent-no-creds';
      mockGetMapping.mockImplementation(async () => ({ parentUserId: parentIdNC, resourceId: 0 }));
      mockGetCredentials.mockImplementation(async () => null);

      // eslint-disable-next-line @typescript-eslint/await-thenable -- bun:test .rejects.toBeInstanceOf() is not typed as Promise but is awaitable
      await expect(pronoteDataService.getGrades(childIdNC)).rejects.toBeInstanceOf(
        PronoteNotConnectedError,
      );
    });

    it('carries the parentUserId', async () => {
      const childIdNC2 = 'child-no-creds-2';
      const parentIdNC2 = 'parent-no-creds-2';
      mockGetMapping.mockImplementation(async () => ({ parentUserId: parentIdNC2, resourceId: 0 }));
      mockGetCredentials.mockImplementation(async () => null);

      const err = await pronoteDataService.getGrades(childIdNC2).catch((e: unknown) => e);
      expect((err as InstanceType<typeof PronoteNotConnectedError>).parentUserId).toBe(parentIdNC2);
    });
  });

  // ============================================
  // Error: metadata missing accountKind
  // (use distinct child/parent IDs — singleton cache persists across tests)
  // ============================================

  describe('PronoteMetadataError', () => {
    it('throws when metadata lacks accountKind', async () => {
      const childIdMeta = 'child-bad-meta';
      const parentIdMeta = 'parent-bad-meta';
      mockGetMapping.mockImplementation(async () => ({ parentUserId: parentIdMeta, resourceId: 0 }));
      const metaWithoutKind = JSON.stringify({
        instanceUrl: 'https://demo.index-education.net/pronote',
        username: 'jean.dupont',
        deviceUuid: 'device-uuid-123',
        // accountKind intentionally absent
      });
      mockGetCredentials.mockImplementation(async () => ({
        ...VALID_CREDENTIALS,
        metadata: metaWithoutKind,
      }));

      // eslint-disable-next-line @typescript-eslint/await-thenable -- bun:test .rejects.toBeInstanceOf() is not typed as Promise but is awaitable
      await expect(pronoteDataService.getGrades(childIdMeta)).rejects.toBeInstanceOf(
        PronoteMetadataError,
      );
    });
  });

  // ============================================
  // getHomework + getTimetable delegate correctly
  // ============================================

  describe('getHomework', () => {
    it('returns homework items', async () => {
      // Use a fresh parent to force cache miss
      const childIdHW = 'child-hw-test';
      mockGetMapping.mockImplementation(async () => ({ parentUserId: 'parent-hw-test', resourceId: 0 }));

      const hw = await pronoteDataService.getHomework(childIdHW);

      expect(hw).toHaveLength(1);
      expect(hw[0]!.subject).toBe('Histoire');
      expect(mockGetHomework).toHaveBeenCalledTimes(1);
    });
  });

  describe('getTimetable', () => {
    it('returns timetable items and passes day param', async () => {
      const childIdTT = 'child-tt-test';
      mockGetMapping.mockImplementation(async () => ({ parentUserId: 'parent-tt-test', resourceId: 0 }));

      const lessons = await pronoteDataService.getTimetable(childIdTT, '2026-06-10');

      expect(lessons).toHaveLength(1);
      expect(lessons[0]!.subject).toBe('SVT');
      const ttArg = (mockGetTimetable.mock.calls as unknown as Array<[unknown, number, string]>)[0];
      expect(ttArg?.[2]).toBe('2026-06-10');
    });
  });
});
