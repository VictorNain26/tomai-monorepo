/**
 * Tests — PronoteConnectService
 *
 * Covers: connectQr — deviceUuid generated server-side, upsertCredentials called,
 * primeSession called, credentialId + resources returned.
 * Covers: discover — ownership check, suggestion, dedup.
 * Covers: activate — create/link + mappings, ownership check, partial failure.
 */

import { describe, it, expect, mock, beforeEach } from 'bun:test';

// ============================================
// MOCKS — must precede service import
// ============================================

const mockUpsertCredentials = mock(
  async (_userId: string, _input: unknown): Promise<{ success: boolean; credentialId?: string; error?: string }> => ({
    success: true,
    credentialId: 'cred-abc-123',
  }),
);

const mockPrimeSession = mock((_credentialId: string, _session: unknown) => {});

const mockGetCredentialById = mock(
  async (_id: string): Promise<{ id: string; userId: string; token: string; metadata: string; tokenExpiresAt: string } | null> => ({
    id: 'cred-abc-123',
    userId: 'user-001',
    token: 'tok',
    metadata: '{}',
    tokenExpiresAt: new Date().toISOString(),
  })
);

// PronoteCredentialForbiddenError moved to pronote-sync.service (source of truth)
// and re-exported by pronote-connect.service — must be present in the mock.
class PronoteCredentialForbiddenErrorStub extends Error {
  constructor() {
    super('This Pronote credential does not belong to the requesting user');
    this.name = 'PronoteCredentialForbiddenError';
  }
}

mock.module('../services/pronote-sync.service', () => ({
  PronoteCredentialForbiddenError: PronoteCredentialForbiddenErrorStub,
  pronoteSyncService: {
    upsertCredentials: mockUpsertCredentials,
    getCredentialById: mockGetCredentialById,
  },
}));

const mockListResources = mock(async (_credentialId: string) => [
  { resourceId: 0, name: 'Emma Dupont', className: '3ème A', establishmentName: 'Collège Jean Moulin' },
  { resourceId: 1, name: 'Lucas Dupont', className: '5ème B', establishmentName: 'Collège Jean Moulin' },
]);

mock.module('../services/pronote/pronote-data.service', () => ({
  pronoteDataService: {
    primeSession: mockPrimeSession,
    listResources: mockListResources,
  },
  PronoteNotConnectedError: class PronoteNotConnectedError extends Error {
    constructor(credentialId: string) {
      super(`No Pronote credentials found for credential ${credentialId}`);
      this.name = 'PronoteNotConnectedError';
    }
  },
  PronoteMetadataError: class PronoteMetadataError extends Error {
    constructor(field: string) {
      super(`Pronote metadata is missing required field: ${field}`);
      this.name = 'PronoteMetadataError';
    }
  },
}));

const mockGetParentChildren = mock(async (_parentId: string) => [
  { id: 'child-existing-1', firstName: 'Emma', lastName: 'Dupont', username: 'emmadupont', schoolLevel: 'troisieme', isActive: true, parentId: 'user-001', role: 'student' as const, createdAt: new Date().toISOString() },
]);

const mockCreateChild = mock(
  async (_parentId: string, _childData: unknown): Promise<{ id: string; firstName: string; lastName: string }> => ({
    id: 'child-new-1',
    firstName: 'Lucas',
    lastName: 'Dupont',
  }),
);

// isParentOf returns true by default (the linked child belongs to the parent)
const mockIsParentOf = mock(async (_parentId: string, _childId: string): Promise<boolean> => true);

mock.module('../services/parent.service', () => ({
  parentService: {
    getParentChildren: mockGetParentChildren,
    createChild: mockCreateChild,
    isParentOf: mockIsParentOf,
  },
}));

const mockDeleteById = mock(async (_id: string): Promise<boolean> => true);

mock.module('../db/repositories/users.repository', () => ({
  usersRepository: {
    deleteById: mockDeleteById,
  },
}));

const mockUpsertMapping = mock(
  async (_parentUserId: string, _childUserId: string, _credentialId: string, _resourceId: number, _className: string | null, _establishmentName: string | null): Promise<void> => {},
);

const mockGetResourceIdsByCredential = mock(async (_credentialId: string): Promise<number[]> => []);

// Returns null by default (no existing mapping)
const mockGetMapping = mock(
  async (_childUserId: string): Promise<{ parentUserId: string; credentialId: string; resourceId: number } | null> => null,
);

mock.module('../db/repositories/pronote-child-resources.repository', () => ({
  pronoteChildResourcesRepository: {
    upsertMapping: mockUpsertMapping,
    getResourceIdsByCredential: mockGetResourceIdsByCredential,
    getMapping: mockGetMapping,
  },
}));

mock.module('../lib/observability', () => ({
  logger: {
    info: mock(() => {}),
    warn: mock(() => {}),
    error: mock(() => {}),
  },
}));

// Minimal QR payload from the adapter
const FAKE_QR = { jeton: 'tok-abc', login: 'jean.dupont', url: 'https://demo.index-education.net/pronote' };
const FAKE_PIN = '1234';

const mockAdapterConnectWithQrPayload = mock(async (_input: unknown) => ({
  session: {
    token: 'rotated-token-xyz',
    username: 'jean.dupont',
    handle: {},
  },
  metadata: {
    instanceUrl: 'https://demo.index-education.net/pronote',
    username: 'jean.dupont',
    kind: 7,
    deviceUuid: 'server-generated-uuid',
  },
  resources: [
    { resourceId: 0, name: 'Emma Dupont', className: '3ème A', establishmentName: 'Collège Jean Moulin' },
    { resourceId: 1, name: 'Lucas Dupont', className: '5ème B', establishmentName: 'Collège Jean Moulin' },
  ],
}));

mock.module('../services/pronote/pawnote-server.adapter', () => ({
  pawnoteServerAdapter: {
    connectWithQrPayload: mockAdapterConnectWithQrPayload,
  },
  PronoteReauthRequired: class PronoteReauthRequired extends Error {
    constructor(cause: unknown) {
      super('reauth required');
      this.name = 'PronoteReauthRequired';
      this.cause = cause;
    }
  },
}));

// Import after mocks
const {
  pronoteConnectService,
  PronoteCredentialNotFoundError,
  PronoteCredentialForbiddenError,
} = await import('../services/pronote/pronote-connect.service');

// ============================================
// Tests
// ============================================

describe('PronoteConnectService.connectQr', () => {
  beforeEach(() => {
    mockUpsertCredentials.mockClear();
    mockPrimeSession.mockClear();
    mockAdapterConnectWithQrPayload.mockClear();
    mockGetCredentialById.mockClear();
    mockListResources.mockClear();
    mockGetParentChildren.mockClear();
    mockCreateChild.mockClear();
    mockIsParentOf.mockClear();
    mockDeleteById.mockClear();
    mockUpsertMapping.mockClear();
  });

  it('calls the adapter with the QR payload and PIN', async () => {
    await pronoteConnectService.connectQr('user-001', { qr: FAKE_QR, pin: FAKE_PIN });

    expect(mockAdapterConnectWithQrPayload).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const call = (mockAdapterConnectWithQrPayload.mock.calls[0] as any)[0];
    expect(call.qr).toEqual(FAKE_QR);
    expect(call.pin).toBe(FAKE_PIN);
  });

  it('calls upsertCredentials with correct metadata shape', async () => {
    await pronoteConnectService.connectQr('user-001', { qr: FAKE_QR, pin: FAKE_PIN });

    expect(mockUpsertCredentials).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [userId, input] = mockUpsertCredentials.mock.calls[0] as any;
    expect(userId).toBe('user-001');

    const meta = JSON.parse(input.metadata as string) as Record<string, unknown>;
    expect(meta.instanceUrl).toBe('https://demo.index-education.net/pronote');
    expect(meta.username).toBe('jean.dupont');
    expect(typeof meta.deviceUuid).toBe('string');
    expect((meta.deviceUuid as string).length).toBeGreaterThan(0);
    expect(meta.accountKind).toBe(7);

    // tokenExpiresAt must be ~ now+365d (within 1 minute tolerance)
    const expires = new Date(input.tokenExpiresAt as string);
    const nowPlus365 = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    expect(Math.abs(expires.getTime() - nowPlus365.getTime())).toBeLessThan(60_000);
  });

  it('calls primeSession with the credentialId and session', async () => {
    await pronoteConnectService.connectQr('user-001', { qr: FAKE_QR, pin: FAKE_PIN });

    expect(mockPrimeSession).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [credId, session] = mockPrimeSession.mock.calls[0] as any;
    expect(credId).toBe('cred-abc-123');
    expect(session.token).toBe('rotated-token-xyz');
  });

  it('returns credentialId and resources from the adapter', async () => {
    const result = await pronoteConnectService.connectQr('user-001', { qr: FAKE_QR, pin: FAKE_PIN });

    expect(result.credentialId).toBe('cred-abc-123');
    expect(result.resources).toHaveLength(2);
    expect(result.resources[0]).toEqual({
      resourceId: 0,
      name: 'Emma Dupont',
      className: '3ème A',
      establishmentName: 'Collège Jean Moulin',
    });
  });

  it('throws when upsertCredentials fails', async () => {
    mockUpsertCredentials.mockResolvedValueOnce({ success: false, error: 'encryption failed' });

    try {
      await pronoteConnectService.connectQr('user-001', { qr: FAKE_QR, pin: FAKE_PIN });
      expect(true).toBe(false); // should not reach here
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
    }
  });

  it('passes establishmentName from first resource to upsertCredentials', async () => {
    await pronoteConnectService.connectQr('user-001', { qr: FAKE_QR, pin: FAKE_PIN });

    expect(mockUpsertCredentials).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [, input] = mockUpsertCredentials.mock.calls[0] as any;
    expect(input.establishmentName).toBe('Collège Jean Moulin');
  });
});

// ============================================
// PronoteConnectService.discover
// ============================================

describe('PronoteConnectService.discover', () => {
  beforeEach(() => {
    mockGetCredentialById.mockClear();
    mockListResources.mockClear();
    mockGetParentChildren.mockClear();
    mockCreateChild.mockClear();
    mockUpsertMapping.mockClear();
    mockGetResourceIdsByCredential.mockClear();
  });

  it('returns enriched children with suggestions and dedup', async () => {
    const result = await pronoteConnectService.discover('user-001', 'cred-abc-123');

    expect(result).toHaveLength(2);

    // Emma Dupont already exists → existingChildId set
    expect(result[0]!.existingChildId).toBe('child-existing-1');
    expect(result[0]!.suggested.firstName).toBe('Emma');
    expect(result[0]!.suggested.lastName).toBe('Dupont');
    expect(result[0]!.suggested.schoolLevel).toBe('troisieme');

    // Lucas Dupont does not exist → existingChildId null
    expect(result[1]!.existingChildId).toBeNull();
    expect(result[1]!.suggested.firstName).toBe('Lucas');
    expect(result[1]!.suggested.lastName).toBe('Dupont');
    expect(result[1]!.suggested.schoolLevel).toBe('cinquieme');
  });

  it('throws PronoteCredentialNotFoundError when credential does not exist', async () => {
    mockGetCredentialById.mockResolvedValueOnce(null);

    try {
      await pronoteConnectService.discover('user-001', 'missing-cred');
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(PronoteCredentialNotFoundError);
    }
  });

  it('throws PronoteCredentialForbiddenError when credential belongs to another user', async () => {
    mockGetCredentialById.mockResolvedValueOnce({
      id: 'cred-abc-123',
      userId: 'user-other',
      token: 'tok',
      metadata: '{}',
      tokenExpiresAt: new Date().toISOString(),
    });

    try {
      await pronoteConnectService.discover('user-001', 'cred-abc-123');
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(PronoteCredentialForbiddenError);
    }
  });

  it('returns null schoolLevel for unrecognized class name', async () => {
    mockListResources.mockResolvedValueOnce([
      { resourceId: 0, name: 'Sophie Bernard', className: '302', establishmentName: 'Lycée X' },
    ]);

    const result = await pronoteConnectService.discover('user-001', 'cred-abc-123');

    expect(result[0]!.suggested.schoolLevel).toBeNull();
    expect(result[0]!.existingChildId).toBeNull();
  });
});

// ============================================
// PronoteConnectService.activate
// ============================================

describe('PronoteConnectService.activate', () => {
  beforeEach(() => {
    mockGetCredentialById.mockClear();
    mockListResources.mockClear();
    mockCreateChild.mockClear();
    mockIsParentOf.mockClear();
    mockDeleteById.mockClear();
    mockUpsertMapping.mockClear();
    mockGetMapping.mockClear();
  });

  it('(a) creates child and maps when no linkToChildId', async () => {
    const result = await pronoteConnectService.activate('user-001', 'cred-abc-123', [
      {
        resourceId: 1,
        firstName: 'Lucas',
        lastName: 'Dupont',
        schoolLevel: 'cinquieme',
        username: 'lucasdupont',
        password: 'password123',
      },
    ]);

    expect(mockCreateChild).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [parentId, childData] = mockCreateChild.mock.calls[0] as any;
    expect(parentId).toBe('user-001');
    expect(childData.firstName).toBe('Lucas');
    expect(childData.lastName).toBe('Dupont');
    expect(childData.username).toBe('lucasdupont');
    expect(childData.password).toBe('password123');
    expect(childData.schoolLevel).toBe('cinquieme');
    expect(childData.dateOfBirth).toBeUndefined();

    // isParentOf not called when creating (not linking) a child
    expect(mockIsParentOf).not.toHaveBeenCalled();

    expect(mockUpsertMapping).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [pId, cId, credId, resId] = mockUpsertMapping.mock.calls[0] as any;
    expect(pId).toBe('user-001');
    expect(cId).toBe('child-new-1');
    expect(credId).toBe('cred-abc-123');
    expect(resId).toBe(1);

    expect(result.activated).toHaveLength(1);
    expect(result.activated[0]).toEqual({ resourceId: 1, childId: 'child-new-1' });
    expect(result.failed).toHaveLength(0);
  });

  it('(b) links existing child and maps when linkToChildId present (no createChild)', async () => {
    // isParentOf returns true by default (child belongs to parent)
    const result = await pronoteConnectService.activate('user-001', 'cred-abc-123', [
      {
        resourceId: 0,
        firstName: 'Emma',
        lastName: 'Dupont',
        schoolLevel: 'troisieme',
        username: 'ignored-username',
        password: 'ignored-password',
        linkToChildId: 'child-existing-1',
      },
    ]);

    expect(mockCreateChild).not.toHaveBeenCalled();

    // C2: isParentOf must be checked before mapping
    expect(mockIsParentOf).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [pId, cId] = mockIsParentOf.mock.calls[0] as any;
    expect(pId).toBe('user-001');
    expect(cId).toBe('child-existing-1');

    expect(mockUpsertMapping).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const [mpId, mcId, credId, resId] = mockUpsertMapping.mock.calls[0] as any;
    expect(mpId).toBe('user-001');
    expect(mcId).toBe('child-existing-1');
    expect(credId).toBe('cred-abc-123');
    expect(resId).toBe(0);

    expect(result.activated).toHaveLength(1);
    expect(result.activated[0]).toEqual({ resourceId: 0, childId: 'child-existing-1' });
    expect(result.failed).toHaveLength(0);
  });

  it('(c) handles mixed selections (link + create)', async () => {
    mockCreateChild.mockResolvedValueOnce({ id: 'child-new-2', firstName: 'Lucas', lastName: 'Dupont' });

    const result = await pronoteConnectService.activate('user-001', 'cred-abc-123', [
      {
        resourceId: 0,
        firstName: 'Emma',
        lastName: 'Dupont',
        schoolLevel: 'troisieme',
        username: 'emmadupont',
        password: 'password123',
        linkToChildId: 'child-existing-1',
      },
      {
        resourceId: 1,
        firstName: 'Lucas',
        lastName: 'Dupont',
        schoolLevel: 'cinquieme',
        username: 'lucasdupont',
        password: 'password456',
      },
    ]);

    expect(mockIsParentOf).toHaveBeenCalledTimes(1);
    expect(mockCreateChild).toHaveBeenCalledTimes(1);
    expect(mockUpsertMapping).toHaveBeenCalledTimes(2);

    expect(result.activated).toHaveLength(2);
    expect(result.activated).toContainEqual({ resourceId: 0, childId: 'child-existing-1' });
    expect(result.activated).toContainEqual({ resourceId: 1, childId: 'child-new-2' });
    expect(result.failed).toHaveLength(0);
  });

  it('(d) throws PronoteCredentialForbiddenError and writes nothing when credential belongs to another user', async () => {
    mockGetCredentialById.mockResolvedValueOnce({
      id: 'cred-abc-123',
      userId: 'user-other',
      token: 'tok',
      metadata: '{}',
      tokenExpiresAt: new Date().toISOString(),
    });

    try {
      await pronoteConnectService.activate('user-001', 'cred-abc-123', [
        {
          resourceId: 1,
          firstName: 'Lucas',
          lastName: 'Dupont',
          schoolLevel: 'cinquieme',
          username: 'lucasdupont',
          password: 'password123',
        },
      ]);
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(PronoteCredentialForbiddenError);
    }

    expect(mockCreateChild).not.toHaveBeenCalled();
    expect(mockIsParentOf).not.toHaveBeenCalled();
    expect(mockUpsertMapping).not.toHaveBeenCalled();
  });

  it('(e) includes successful items even when one item fails — failed array non-empty', async () => {
    mockCreateChild
      .mockRejectedValueOnce(new Error('Ce nom d\'utilisateur existe déjà'))
      .mockResolvedValueOnce({ id: 'child-new-3', firstName: 'Marie', lastName: 'Martin' });

    const result = await pronoteConnectService.activate('user-001', 'cred-abc-123', [
      {
        resourceId: 0,
        firstName: 'Lucas',
        lastName: 'Dupont',
        schoolLevel: 'cinquieme',
        username: 'taken-username',
        password: 'password123',
      },
      {
        resourceId: 1,
        firstName: 'Marie',
        lastName: 'Martin',
        schoolLevel: 'seconde',
        username: 'mariemartin',
        password: 'password456',
      },
    ]);

    expect(result.activated).toHaveLength(1);
    expect(result.activated[0]).toEqual({ resourceId: 1, childId: 'child-new-3' });
    // I1: failed array must report the failed item
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]!.resourceId).toBe(0);
    expect(typeof result.failed[0]!.reason).toBe('string');
    expect(mockUpsertMapping).toHaveBeenCalledTimes(1);
  });

  // C2 — IDOR guard
  it('(f) rejects linkToChildId that does not belong to the parent — no upsertMapping called', async () => {
    mockIsParentOf.mockResolvedValueOnce(false);

    const result = await pronoteConnectService.activate('user-001', 'cred-abc-123', [
      {
        resourceId: 0,
        firstName: 'Emma',
        lastName: 'Dupont',
        schoolLevel: 'troisieme',
        username: 'ignored',
        password: 'ignored123',
        linkToChildId: 'child-from-other-family',
      },
    ]);

    expect(mockUpsertMapping).not.toHaveBeenCalled();
    expect(result.activated).toHaveLength(0);
    // Item ends in failed with reason
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]!.resourceId).toBe(0);
    // PronoteChildNotOwnedError should be exposed as reason
    expect(result.failed[0]!.reason).toContain('child-from-other-family');
  });

  // I2 — orphan compensation
  it('(g) deletes the created child when upsertMapping fails after createChild', async () => {
    mockCreateChild.mockResolvedValueOnce({ id: 'child-orphan', firstName: 'Orphan', lastName: 'Child' });
    mockUpsertMapping.mockRejectedValueOnce(new Error('DB constraint'));

    const result = await pronoteConnectService.activate('user-001', 'cred-abc-123', [
      {
        resourceId: 0,
        firstName: 'Orphan',
        lastName: 'Child',
        schoolLevel: 'seconde',
        username: 'orphan',
        password: 'password123',
      },
    ]);

    expect(result.activated).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
    // I2: deleteById must be called with the created child's id to compensate
    expect(mockDeleteById).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const deletedId = (mockDeleteById.mock.calls[0] as any)[0];
    expect(deletedId).toBe('child-orphan');
  });

  it('(g2) passes className and establishmentName from discovered resources to upsertMapping', async () => {
    // mockListResources already returns resources with className/establishmentName (used by discover internally)
    await pronoteConnectService.activate('user-001', 'cred-abc-123', [
      {
        resourceId: 1,
        firstName: 'Lucas',
        lastName: 'Dupont',
        schoolLevel: 'cinquieme',
        username: 'lucasdupont',
        password: 'password123',
      },
    ]);

    expect(mockUpsertMapping).toHaveBeenCalledTimes(1);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const args = mockUpsertMapping.mock.calls[0] as any;
    // args: [parentUserId, childUserId, credentialId, resourceId, className, establishmentName]
    expect(args[4]).toBe('5ème B');
    expect(args[5]).toBe('Collège Jean Moulin');
  });

  // I2 — linkToChildId path: no compensation when mapping fails (child was not created)
  it('(h) does NOT call deleteById when mapping fails for an existing linked child', async () => {
    mockUpsertMapping.mockRejectedValueOnce(new Error('DB constraint'));

    const result = await pronoteConnectService.activate('user-001', 'cred-abc-123', [
      {
        resourceId: 0,
        firstName: 'Emma',
        lastName: 'Dupont',
        schoolLevel: 'troisieme',
        username: 'ignored',
        password: 'ignored123',
        linkToChildId: 'child-existing-1',
      },
    ]);

    expect(result.activated).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
    expect(mockDeleteById).not.toHaveBeenCalled();
  });

  it('(j) link selection without username/password succeeds — activated, createChild not called', async () => {
    const result = await pronoteConnectService.activate('user-001', 'cred-abc-123', [
      {
        resourceId: 0,
        firstName: 'Emma',
        lastName: 'Dupont',
        schoolLevel: 'troisieme',
        // no username, no password — link mode
        linkToChildId: 'child-existing-1',
      },
    ]);

    expect(mockCreateChild).not.toHaveBeenCalled();
    expect(result.activated).toHaveLength(1);
    expect(result.activated[0]).toEqual({ resourceId: 0, childId: 'child-existing-1' });
    expect(result.failed).toHaveLength(0);
  });

  it('(k) create selection without username/password → failed[missing_credentials], createChild not called', async () => {
    const result = await pronoteConnectService.activate('user-001', 'cred-abc-123', [
      {
        resourceId: 1,
        firstName: 'Lucas',
        lastName: 'Dupont',
        schoolLevel: 'cinquieme',
        // no username, no password — missing on create mode
      },
    ]);

    expect(mockCreateChild).not.toHaveBeenCalled();
    expect(result.activated).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]).toEqual({ resourceId: 1, reason: 'missing_credentials' });
  });

  it('(i) linkToChildId already mapped → failed[already_mapped], no overwrite, isParentOf guard ran first', async () => {
    // Pre-condition: child-existing-1 already has a mapping (different credential + resourceId)
    mockGetMapping.mockResolvedValueOnce({
      parentUserId: 'user-001',
      credentialId: 'cred-other-999',
      resourceId: 42,
    });

    const result = await pronoteConnectService.activate('user-001', 'cred-abc-123', [
      {
        resourceId: 0,
        firstName: 'Emma',
        lastName: 'Dupont',
        schoolLevel: 'troisieme',
        username: 'ignored',
        password: 'ignored123',
        linkToChildId: 'child-existing-1',
      },
    ]);

    // isParentOf must have been checked before the already_mapped guard
    expect(mockIsParentOf).toHaveBeenCalledWith('user-001', 'child-existing-1');

    // Result: rejected with 'already_mapped', nothing written
    expect(result.activated).toHaveLength(0);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0]).toEqual({ resourceId: 0, reason: 'already_mapped' });

    // upsertMapping must NOT have been called (no overwrite)
    expect(mockUpsertMapping).not.toHaveBeenCalled();

    // The mock returns the original mapping — verify getMapping was called with the child id
    expect(mockGetMapping).toHaveBeenCalledWith('child-existing-1');
  });
});

// ============================================
// PronoteConnectService.resync
// ============================================

describe('PronoteConnectService.resync', () => {
  beforeEach(() => {
    mockGetCredentialById.mockClear();
    mockListResources.mockClear();
    mockGetParentChildren.mockClear();
    mockGetResourceIdsByCredential.mockClear();
    mockUpsertMapping.mockClear();
  });

  it('(a) new resource → in added (enriched), not in stillMapped', async () => {
    // No existing mappings for this credential
    mockGetResourceIdsByCredential.mockResolvedValueOnce([]);

    const result = await pronoteConnectService.resync('user-001', 'cred-abc-123');

    expect(result.stillMapped).toHaveLength(0);
    expect(result.added).toHaveLength(2);
    // Resources should be enriched
    expect(result.added[0]!.resourceId).toBe(0);
    expect(result.added[0]!.suggested.firstName).toBe('Emma');
    expect(result.added[0]!.existingChildId).toBe('child-existing-1');
    expect(result.added[1]!.resourceId).toBe(1);
    expect(result.added[1]!.suggested.firstName).toBe('Lucas');
    expect(result.added[1]!.existingChildId).toBeNull();
    // Must not write anything
    expect(mockUpsertMapping).not.toHaveBeenCalled();
  });

  it('(b) already-mapped resource → in stillMapped, not in added', async () => {
    // resourceId 0 already mapped, resourceId 1 not
    mockGetResourceIdsByCredential.mockResolvedValueOnce([0]);

    const result = await pronoteConnectService.resync('user-001', 'cred-abc-123');

    expect(result.stillMapped).toContain(0);
    expect(result.stillMapped).not.toContain(1);
    expect(result.added).toHaveLength(1);
    expect(result.added[0]!.resourceId).toBe(1);
    expect(mockUpsertMapping).not.toHaveBeenCalled();
  });

  it('(c) mixed: some mapped, some new', async () => {
    // resourceId 0 already mapped
    mockGetResourceIdsByCredential.mockResolvedValueOnce([0]);

    const result = await pronoteConnectService.resync('user-001', 'cred-abc-123');

    expect(result.stillMapped).toEqual([0]);
    expect(result.added).toHaveLength(1);
    expect(result.added[0]!.resourceId).toBe(1);
    expect(mockUpsertMapping).not.toHaveBeenCalled();
  });

  it('(d) bad ownership → throws before reading resources', async () => {
    mockGetCredentialById.mockResolvedValueOnce({
      id: 'cred-abc-123',
      userId: 'user-other',
      token: 'tok',
      metadata: '{}',
      tokenExpiresAt: new Date().toISOString(),
    });

    try {
      await pronoteConnectService.resync('user-001', 'cred-abc-123');
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(PronoteCredentialForbiddenError);
    }

    expect(mockListResources).not.toHaveBeenCalled();
    expect(mockGetResourceIdsByCredential).not.toHaveBeenCalled();
  });

  it('(e) missing credential → throws PronoteCredentialNotFoundError', async () => {
    mockGetCredentialById.mockResolvedValueOnce(null);

    try {
      await pronoteConnectService.resync('user-001', 'missing-cred');
      expect(true).toBe(false);
    } catch (err) {
      expect(err).toBeInstanceOf(PronoteCredentialNotFoundError);
    }

    expect(mockListResources).not.toHaveBeenCalled();
  });
});
