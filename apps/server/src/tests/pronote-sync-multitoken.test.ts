/**
 * Tests — PronoteSyncService multi-token extensions
 * Covers:
 *   - upsertCredentials returns credentialId
 *   - upsertCredentials rejects metadata without instanceUrl
 *   - getCredentialById returns decrypted credential with id
 *   - updateTokenById re-encrypts and updates token only
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { createMockLogger } from './_helpers/mock-logger';

const mockLogger = createMockLogger();
mock.module('../lib/observability', () => ({ logger: mockLogger }));

const mockEncrypt = mock(async (val: string) => `encrypted:${val}`);
const mockDecrypt = mock(async (val: string) => val.replace('encrypted:', ''));

mock.module('../lib/encryption', () => ({
  encrypt: mockEncrypt,
  decrypt: mockDecrypt,
}));

// DB mock state
type Row = {
  id: string;
  userId: string;
  establishmentUrl: string;
  encryptedToken: string;
  encryptedMetadata: string;
  tokenExpiresAt: Date;
};

const rows: Row[] = [];

const mockReturning = mock(() => Promise.resolve([{ id: rows[rows.length - 1]?.id ?? 'new-id' }]));
const mockOnConflictDoUpdate = mock(() => ({ returning: mockReturning }));
const mockInsertValues = mock((vals: { userId: string; establishmentUrl: string; encryptedToken: string; encryptedMetadata: string; tokenExpiresAt: Date }) => {
  const existing = rows.find(r => r.userId === vals.userId && r.establishmentUrl === vals.establishmentUrl);
  if (existing) {
    existing.encryptedToken = vals.encryptedToken;
    existing.encryptedMetadata = vals.encryptedMetadata;
    existing.tokenExpiresAt = vals.tokenExpiresAt;
    mockReturning.mockImplementation(() => Promise.resolve([{ id: existing.id }]));
  } else {
    const newRow: Row = { id: `id-${rows.length + 1}`, ...vals };
    rows.push(newRow);
    mockReturning.mockImplementation(() => Promise.resolve([{ id: newRow.id }]));
  }
  return { onConflictDoUpdate: mockOnConflictDoUpdate };
});

let mockSetResult: Row | undefined;
const mockUpdateReturning = mock(() => Promise.resolve(mockSetResult ? [{ id: mockSetResult.id }] : []));
const mockWhereUpdate = mock(() => ({ returning: mockUpdateReturning }));
const mockSet = mock((vals: Partial<Row>) => {
  if (mockSetResult) Object.assign(mockSetResult, vals);
  return { where: mockWhereUpdate };
});

const mockLimitSelect = mock((): Promise<Row[]> => {
  if (mockSetResult) return Promise.resolve([mockSetResult]);
  return Promise.resolve([]);
});

const mockOrderBySelect = mock(() => ({ limit: mockLimitSelect }));

// Dual-purpose: supports `.orderBy().limit()` (getCredentials) and direct await (getCredentialById)
const mockWhereSelect = mock((): Promise<Row[]> & { orderBy: typeof mockOrderBySelect } => {
  const result: Row[] = mockSetResult ? [mockSetResult] : [];
  const promise = Promise.resolve(result) as Promise<Row[]> & { orderBy: typeof mockOrderBySelect };
  promise.orderBy = mockOrderBySelect;
  return promise;
});

mock.module('../db/connection', () => ({
  db: {
    insert: mock(() => ({ values: mockInsertValues })),
    select: mock(() => ({ from: mock(() => ({ where: mockWhereSelect })) })),
    update: mock(() => ({ set: mockSet })),
  },
}));

mock.module('../db/schema', () => ({
  pronoteCredentials: {
    id: 'id',
    userId: 'userId',
    establishmentUrl: 'establishmentUrl',
    encryptedToken: 'encryptedToken',
    encryptedMetadata: 'encryptedMetadata',
    tokenExpiresAt: 'tokenExpiresAt',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt',
  },
}));

mock.module('drizzle-orm', () => ({
  eq: mock((col: unknown, val: unknown) => ({ col, val })),
  asc: mock((col: unknown) => ({ type: 'asc', col })),
  and: mock((...args: unknown[]) => args),
}));

// Import AFTER mocks
const { pronoteSyncService, normalizeEstablishmentUrl } = await import('../services/pronote-sync.service');

const VALID_USER_ID = 'user-123';
const VALID_TOKEN = 'valid-token-abc';
const VALID_METADATA_WITH_URL = JSON.stringify({
  instanceUrl: 'https://pronote.example.fr/pronote/',
  username: 'jean.dupont',
  deviceUuid: 'device-uuid-123',
  accountKind: 2,
});
const VALID_EXPIRES = new Date(Date.now() + 3600_000).toISOString();

beforeEach(() => {
  rows.length = 0;
  mockSetResult = undefined;
  mockEncrypt.mockClear();
  mockDecrypt.mockClear();
  mockLogger.info.mockClear();
  mockLogger.error.mockClear();
  mockLogger.warn.mockClear();
  mockInsertValues.mockClear();
  mockOnConflictDoUpdate.mockClear();
  mockReturning.mockClear();
  mockSet.mockClear();
  mockWhereUpdate.mockClear();
  mockUpdateReturning.mockClear();
  mockWhereSelect.mockClear();
});

describe('normalizeEstablishmentUrl', () => {
  it('strips trailing slash', () => {
    expect(normalizeEstablishmentUrl('https://pronote.example.fr/pronote/')).toBe(
      'https://pronote.example.fr/pronote'
    );
  });

  it('strips multiple trailing slashes', () => {
    expect(normalizeEstablishmentUrl('https://pronote.example.fr/pronote///')).toBe(
      'https://pronote.example.fr/pronote'
    );
  });

  it('lowercases the host', () => {
    expect(normalizeEstablishmentUrl('https://PRONOTE.Example.FR/pronote')).toBe(
      'https://pronote.example.fr/pronote'
    );
  });

  it('produces identical key for trailing-slash and non-trailing-slash variants', () => {
    const withSlash = normalizeEstablishmentUrl('https://pronote.example.fr/pronote/');
    const withoutSlash = normalizeEstablishmentUrl('https://pronote.example.fr/pronote');
    expect(withSlash).toBe(withoutSlash);
  });

  it('produces identical key for host-case variants', () => {
    const lower = normalizeEstablishmentUrl('https://pronote.example.fr/pronote');
    const upper = normalizeEstablishmentUrl('https://PRONOTE.EXAMPLE.FR/pronote');
    expect(lower).toBe(upper);
  });
});

describe('upsertCredentials — establishment_url deduplication', () => {
  const BASE_TOKEN = 'dedup-token';
  const BASE_EXPIRES = new Date(Date.now() + 3600_000).toISOString();

  function metaWithUrl(instanceUrl: string): string {
    return JSON.stringify({ instanceUrl, username: 'user', deviceUuid: 'dev', accountKind: 2 });
  }

  it('two upserts with same establishment but trailing-slash diff produce same establishmentUrl', async () => {
    const capturedUrls: string[] = [];
    mockInsertValues.mockImplementation((vals: { establishmentUrl: string }) => {
      capturedUrls.push(vals.establishmentUrl);
      return { onConflictDoUpdate: mockOnConflictDoUpdate };
    });

    await pronoteSyncService.upsertCredentials(VALID_USER_ID, {
      token: BASE_TOKEN,
      metadata: metaWithUrl('https://school.net/pronote/'),
      tokenExpiresAt: BASE_EXPIRES,
    });
    await pronoteSyncService.upsertCredentials(VALID_USER_ID, {
      token: BASE_TOKEN,
      metadata: metaWithUrl('https://school.net/pronote'),
      tokenExpiresAt: BASE_EXPIRES,
    });

    expect(capturedUrls).toHaveLength(2);
    expect(capturedUrls[0]).toBe(capturedUrls[1]);
    expect(capturedUrls[0]).toBe('https://school.net/pronote');
  });

  it('two upserts with same establishment but host-case diff produce same establishmentUrl', async () => {
    const capturedUrls: string[] = [];
    mockInsertValues.mockImplementation((vals: { establishmentUrl: string }) => {
      capturedUrls.push(vals.establishmentUrl);
      return { onConflictDoUpdate: mockOnConflictDoUpdate };
    });

    await pronoteSyncService.upsertCredentials(VALID_USER_ID, {
      token: BASE_TOKEN,
      metadata: metaWithUrl('https://SCHOOL.NET/pronote'),
      tokenExpiresAt: BASE_EXPIRES,
    });
    await pronoteSyncService.upsertCredentials(VALID_USER_ID, {
      token: BASE_TOKEN,
      metadata: metaWithUrl('https://school.net/pronote'),
      tokenExpiresAt: BASE_EXPIRES,
    });

    expect(capturedUrls).toHaveLength(2);
    expect(capturedUrls[0]).toBe(capturedUrls[1]);
    expect(capturedUrls[0]).toBe('https://school.net/pronote');
  });
});

describe('upsertCredentials — multi-token extensions', () => {
  it('returns credentialId on successful upsert', async () => {
    const result = await pronoteSyncService.upsertCredentials(VALID_USER_ID, {
      token: VALID_TOKEN,
      metadata: VALID_METADATA_WITH_URL,
      tokenExpiresAt: VALID_EXPIRES,
    });

    expect(result.success).toBe(true);
    expect(typeof result.credentialId).toBe('string');
    expect(result.credentialId!.length).toBeGreaterThan(0);
  });

  it('rejects metadata missing instanceUrl', async () => {
    const metaWithoutUrl = JSON.stringify({
      username: 'jean.dupont',
      deviceUuid: 'device-uuid-123',
      accountKind: 2,
    });

    const result = await pronoteSyncService.upsertCredentials(VALID_USER_ID, {
      token: VALID_TOKEN,
      metadata: metaWithoutUrl,
      tokenExpiresAt: VALID_EXPIRES,
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/instanceUrl/i);
  });

  it('uses (userId, establishmentUrl) composite target for conflict', async () => {
    await pronoteSyncService.upsertCredentials(VALID_USER_ID, {
      token: VALID_TOKEN,
      metadata: VALID_METADATA_WITH_URL,
      tokenExpiresAt: VALID_EXPIRES,
    });

    const conflictArg = (mockOnConflictDoUpdate.mock.calls as unknown as Array<[{ target: unknown[] }]>)[0]?.[0];
    // target must be an array (composite), not a single column
    expect(Array.isArray(conflictArg?.target)).toBe(true);
    expect((conflictArg?.target as unknown[]).length).toBe(2);
  });
});

describe('getCredentialById', () => {
  it('returns decrypted credential with id', async () => {
    // Seed a row
    const seededRow: Row = {
      id: 'cred-id-1',
      userId: VALID_USER_ID,
      establishmentUrl: 'https://pronote.example.fr/pronote/',
      encryptedToken: `encrypted:${VALID_TOKEN}`,
      encryptedMetadata: `encrypted:${VALID_METADATA_WITH_URL}`,
      tokenExpiresAt: new Date(VALID_EXPIRES),
    };
    mockSetResult = seededRow;

    const result = await pronoteSyncService.getCredentialById('cred-id-1');

    expect(result).not.toBeNull();
    expect(result!.id).toBe('cred-id-1');
    expect(result!.userId).toBe(VALID_USER_ID);
    expect(result!.token).toBe(VALID_TOKEN);
    expect(result!.metadata).toBe(VALID_METADATA_WITH_URL);
  });

  it('returns null when id not found', async () => {
    mockSetResult = undefined;

    const result = await pronoteSyncService.getCredentialById('nonexistent-id');

    expect(result).toBeNull();
  });
});

describe('updateTokenById', () => {
  it('re-encrypts token and updates only the token field', async () => {
    const seededRow: Row = {
      id: 'cred-id-2',
      userId: VALID_USER_ID,
      establishmentUrl: 'https://pronote.example.fr/pronote/',
      encryptedToken: `encrypted:old-token`,
      encryptedMetadata: `encrypted:${VALID_METADATA_WITH_URL}`,
      tokenExpiresAt: new Date(VALID_EXPIRES),
    };
    mockSetResult = seededRow;

    const persisted = await pronoteSyncService.updateTokenById('cred-id-2', 'new-rotated-token');

    expect(persisted).toBe(true);
    expect(mockEncrypt).toHaveBeenCalledWith('new-rotated-token');
    expect(mockSet).toHaveBeenCalledTimes(1);
    const setArg = mockSet.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(setArg).toHaveProperty('encryptedToken');
    expect(setArg.encryptedToken).toBe('encrypted:new-rotated-token');
    // Must NOT change metadata
    expect(setArg).not.toHaveProperty('encryptedMetadata');
  });

  it('returns false when id does not exist', async () => {
    mockSetResult = undefined;

    const persisted = await pronoteSyncService.updateTokenById('nonexistent-id', 'some-token');

    expect(persisted).toBe(false);
  });
});
