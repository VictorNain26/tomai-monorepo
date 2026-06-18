/**
 * Tests — PronoteConnectService
 *
 * Covers: connectQr — deviceUuid generated server-side, upsertCredentials called,
 * primeSession called, credentialId + resources returned.
 * Covers: discover — ownership check, suggestion, dedup.
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

mock.module('../services/pronote-sync.service', () => ({
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

mock.module('../services/parent.service', () => ({
  parentService: {
    getParentChildren: mockGetParentChildren,
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
});

// ============================================
// PronoteConnectService.discover
// ============================================

describe('PronoteConnectService.discover', () => {
  beforeEach(() => {
    mockGetCredentialById.mockClear();
    mockListResources.mockClear();
    mockGetParentChildren.mockClear();
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
