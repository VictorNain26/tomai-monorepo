/**
 * Tests — PronoteConnectService
 *
 * Covers: connectQr — deviceUuid generated server-side, upsertCredentials called,
 * primeSession called, credentialId + resources returned.
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

mock.module('../services/pronote-sync.service', () => ({
  pronoteSyncService: {
    upsertCredentials: mockUpsertCredentials,
    getCredentialById: mock(async () => null),
  },
}));

mock.module('../services/pronote/pronote-data.service', () => ({
  pronoteDataService: {
    primeSession: mockPrimeSession,
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
const { pronoteConnectService } = await import('../services/pronote/pronote-connect.service');

// ============================================
// Tests
// ============================================

describe('PronoteConnectService.connectQr', () => {
  beforeEach(() => {
    mockUpsertCredentials.mockClear();
    mockPrimeSession.mockClear();
    mockAdapterConnectWithQrPayload.mockClear();
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
