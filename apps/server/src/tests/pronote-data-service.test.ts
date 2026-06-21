/**
 * Tests — PronoteDataService
 * Mock: pronoteChildResourcesRepository, pronoteSyncService, pawnoteServerAdapter
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';

// ============================================
// MOCKS — must precede service import
// ============================================

const mockGetMapping = mock(async (_childId: string) => null as { parentUserId: string; credentialId: string; resourceId: number } | null);
const mockUpsertMapping = mock(async (_parentId: string, _childId: string, _credId: string, _resId: number, _className: string | null, _estName: string | null) => {});
const mockGetCredentialById = mock(async (_id: string) => null as { id: string; token: string; metadata: string; tokenExpiresAt: string } | null);
const mockUpdateTokenById = mock(async (_id: string, _token: string) => true);

const MOCK_RESOURCES = [
  { name: 'Emma Dupont', className: '3ème A', establishmentName: 'Collège Jean Moulin' },
  { name: 'Lucas Dupont', className: '5ème B', establishmentName: 'Collège Jean Moulin' },
];
const mockConnect = mock(async () => ({
  token: 'rotated-token',
  username: 'jean.dupont',
  handle: { user: { resources: MOCK_RESOURCES } },
}));
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
    upsertMapping: mockUpsertMapping,
  },
}));

mock.module('../services/pronote-sync.service', () => ({
  pronoteSyncService: {
    getCredentialById: mockGetCredentialById,
    updateTokenById: mockUpdateTokenById,
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
const CRED_ID = 'cred-uuid-001';
const VALID_CREDENTIALS = {
  id: CRED_ID,
  token: 'stored-token-abc',
  metadata: VALID_METADATA,
  tokenExpiresAt: '2026-12-31T00:00:00Z',
};
const VALID_MAPPING = { parentUserId: PARENT_ID, credentialId: 'cred-uuid-001', resourceId: RESOURCE_ID };

// ============================================
// PronoteDataService
// ============================================

describe('PronoteDataService', () => {
  beforeEach(() => {
    mockGetMapping.mockClear();
    mockUpsertMapping.mockClear();
    mockGetCredentialById.mockClear();
    mockUpdateTokenById.mockClear();
    mockConnect.mockClear();
    mockGetGrades.mockClear();
    mockGetHomework.mockClear();
    mockGetTimetable.mockClear();

    // Reset to happy-path defaults
    mockGetMapping.mockImplementation(async () => VALID_MAPPING);
    mockGetCredentialById.mockImplementation(async () => VALID_CREDENTIALS);
    mockConnect.mockImplementation(async () => ({
      token: 'rotated-token',
      username: 'jean.dupont',
      handle: { user: { resources: MOCK_RESOURCES } },
    }));
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

      // rotated token re-persisted via updateTokenById with credentialId
      expect(mockUpdateTokenById).toHaveBeenCalledTimes(1);
      const updateArgs = (mockUpdateTokenById.mock.calls as unknown as Array<[string, string]>)[0];
      expect(updateArgs?.[0]).toBe(CRED_ID);
      expect(updateArgs?.[1]).toBe('rotated-token');

      // reads called with resourceId from mapping
      expect(mockGetGrades).toHaveBeenCalledTimes(1);
    });
  });

  // ============================================
  // Cache hit: second call skips connect + upsert
  // ============================================

  describe('cache hit', () => {
    it('does not call connect or updateTokenById on a second call for the same credential', async () => {
      // Use a distinct childId to isolate this test's cache entry from other tests
      const childIdForCacheTest = 'child-cache-test';
      mockGetMapping.mockImplementation(async () => ({ parentUserId: 'parent-cache-test', credentialId: 'cred-cache', resourceId: 0 }));
      mockGetCredentialById.mockImplementation(async () => ({ ...VALID_CREDENTIALS, id: 'cred-cache' }));

      await pronoteDataService.getGrades(childIdForCacheTest);
      mockConnect.mockClear();
      mockUpdateTokenById.mockClear();
      mockGetGrades.mockClear();

      await pronoteDataService.getGrades(childIdForCacheTest);

      expect(mockConnect).not.toHaveBeenCalled();
      expect(mockUpdateTokenById).not.toHaveBeenCalled();
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
    it('throws when getCredentialById returns null', async () => {
      const childIdNC = 'child-no-creds';
      mockGetMapping.mockImplementation(async () => ({ parentUserId: 'parent-no-creds', credentialId: 'cred-nc', resourceId: 0 }));
      mockGetCredentialById.mockImplementation(async () => null);

      // eslint-disable-next-line @typescript-eslint/await-thenable -- bun:test .rejects.toBeInstanceOf() is not typed as Promise but is awaitable
      await expect(pronoteDataService.getGrades(childIdNC)).rejects.toBeInstanceOf(
        PronoteNotConnectedError,
      );
    });

    it('carries the credentialId', async () => {
      const childIdNC2 = 'child-no-creds-2';
      mockGetMapping.mockImplementation(async () => ({ parentUserId: 'parent-no-creds-2', credentialId: 'cred-nc2', resourceId: 0 }));
      mockGetCredentialById.mockImplementation(async () => null);

      const err = await pronoteDataService.getGrades(childIdNC2).catch((e: unknown) => e);
      expect((err as InstanceType<typeof PronoteNotConnectedError>).credentialId).toBe('cred-nc2');
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
      mockGetMapping.mockImplementation(async () => ({ parentUserId: parentIdMeta, credentialId: 'cred-meta', resourceId: 0 }));
      const metaWithoutKind = JSON.stringify({
        instanceUrl: 'https://demo.index-education.net/pronote',
        username: 'jean.dupont',
        deviceUuid: 'device-uuid-123',
        // accountKind intentionally absent
      });
      mockGetCredentialById.mockImplementation(async () => ({
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
  // Error: PronoteReauthRequired propagates out of getGrades
  // ============================================

  describe('PronoteReauthRequired propagation', () => {
    it('propagates PronoteReauthRequired thrown by connect without wrapping', async () => {
      const { PronoteReauthRequired } = await import('../services/pronote/pawnote-server.adapter');
      const childIdReauth = 'child-reauth-test';
      const parentIdReauth = 'parent-reauth-test';
      mockGetMapping.mockImplementation(async () => ({ parentUserId: parentIdReauth, credentialId: 'cred-reauth', resourceId: 0 }));
      mockGetCredentialById.mockImplementation(async () => VALID_CREDENTIALS);
      mockConnect.mockImplementation(async () => { throw new PronoteReauthRequired(new Error('token rejected')); });

      // eslint-disable-next-line @typescript-eslint/await-thenable -- bun:test .rejects.toBeInstanceOf() is not typed as Promise but is awaitable
      await expect(pronoteDataService.getGrades(childIdReauth)).rejects.toBeInstanceOf(PronoteReauthRequired);
    });
  });

  // ============================================
  // getHomework + getTimetable delegate correctly
  // ============================================

  describe('getHomework', () => {
    it('returns homework items', async () => {
      // Use a fresh parent to force cache miss
      const childIdHW = 'child-hw-test';
      mockGetMapping.mockImplementation(async () => ({ parentUserId: 'parent-hw-test', credentialId: 'cred-hw', resourceId: 0 }));

      const hw = await pronoteDataService.getHomework(childIdHW);

      expect(hw).toHaveLength(1);
      expect(hw[0]!.subject).toBe('Histoire');
      expect(mockGetHomework).toHaveBeenCalledTimes(1);
    });
  });

  describe('getTimetable', () => {
    it('returns timetable items and passes day param', async () => {
      const childIdTT = 'child-tt-test';
      mockGetMapping.mockImplementation(async () => ({ parentUserId: 'parent-tt-test', credentialId: 'cred-tt', resourceId: 0 }));

      const lessons = await pronoteDataService.getTimetable(childIdTT, '2026-06-10');

      expect(lessons).toHaveLength(1);
      expect(lessons[0]!.subject).toBe('SVT');
      const ttArg = (mockGetTimetable.mock.calls as unknown as Array<[unknown, number, string]>)[0];
      expect(ttArg?.[2]).toBe('2026-06-10');
    });
  });

  // ============================================
  // configureResource: populates className/establishmentName from live resource list
  // ============================================

  describe('configureResource', () => {
    it('resolves className and establishmentName from listResources and passes them to upsertMapping', async () => {
      const childIdCR = 'child-configure-resource';
      const credIdCR = 'cred-configure-resource';
      // resourceId 1 → Lucas Dupont in MOCK_RESOURCES: { className: '5ème B', establishmentName: 'Collège Jean Moulin' }
      mockGetCredentialById.mockImplementation(async () => ({ ...VALID_CREDENTIALS, id: credIdCR }));

      await pronoteDataService.configureResource(PARENT_ID, childIdCR, credIdCR, 1);

      expect(mockUpsertMapping).toHaveBeenCalledTimes(1);
      const [calledParent, calledChild, calledCred, calledResId, calledClass, calledEst] =
        mockUpsertMapping.mock.calls[0] as [string, string, string, number, string | null, string | null];
      expect(calledParent).toBe(PARENT_ID);
      expect(calledChild).toBe(childIdCR);
      expect(calledCred).toBe(credIdCR);
      expect(calledResId).toBe(1);
      expect(calledClass).toBe('5ème B');
      expect(calledEst).toBe('Collège Jean Moulin');
    });

    it('passes null className/establishmentName when resourceId not found in list', async () => {
      const childIdCR2 = 'child-configure-resource-unknown';
      const credIdCR2 = 'cred-configure-resource-unknown';
      mockGetCredentialById.mockImplementation(async () => ({ ...VALID_CREDENTIALS, id: credIdCR2 }));

      await pronoteDataService.configureResource(PARENT_ID, childIdCR2, credIdCR2, 99);

      expect(mockUpsertMapping).toHaveBeenCalledTimes(1);
      const [, , , , calledClass, calledEst] =
        mockUpsertMapping.mock.calls[0] as [string, string, string, number, string | null, string | null];
      expect(calledClass).toBeNull();
      expect(calledEst).toBeNull();
    });
  });
});
