/**
 * Tests — GET /api/pronote/credentials/list
 *
 * Covers:
 *   - 0 credentials → empty array
 *   - 1 credential, 0 children → childCount 0
 *   - 2 credentials, with children → correct childCount per credential
 *   - establishmentName comes from DB column (no adapter call)
 *   - ownership: other user's credentials not visible
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { Elysia } from 'elysia';
import { createMockLogger } from './_helpers/mock-logger';

// ============================================
// MOCKS (must be before any import of the real modules)
// ============================================

const mockLogger = createMockLogger();
mock.module('../lib/observability', () => ({ logger: mockLogger }));

// authMacro — inject a mutable user into every guarded request
let currentUser: Record<string, unknown> | null = null;

const authMacroMock = new Elysia({ name: 'auth-macro' }).macro({
  auth: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolve(ctx: any) {
      if (!currentUser) {
        return ctx.status(401) as never;
      }
      return { user: currentUser as Record<string, unknown>, session: { id: 'sess-001' } };
    },
  },
});
mock.module('../lib/auth-macro', () => ({ authMacro: authMacroMock }));

// Rate-limit — no-op in tests
mock.module('../middleware/rate-limit.middleware', () => ({
  createRateLimitMiddleware: mock(() => () => {}),
  RateLimitPresets: { pronote: {} },
}));

// pronoteSyncService mock — mutable per test
type CredSummary = {
  credentialId: string;
  establishmentName: string | null;
  establishmentUrl: string;
  childCount: number;
};

let mockListCredentialSummaries = mock(async (_userId: string): Promise<CredSummary[]> => []);

mock.module('../services/pronote-sync.service', () => ({
  pronoteSyncService: {
    get listCredentialSummaries() { return mockListCredentialSummaries; },
    // stubs for other route handlers
    upsertCredentials: mock(async () => ({ success: true })),
    getCredentials: mock(async () => null),
    deleteCredentials: mock(async () => true),
  },
}));

// encryption — needed for import chain
mock.module('../lib/encryption', () => ({
  encrypt: mock(async (v: string) => `enc:${v}`),
  decrypt: mock(async (v: string) => v.replace('enc:', '')),
}));

// drizzle-orm — minimal stubs (import chain)
mock.module('drizzle-orm', () => ({
  eq: mock((col: unknown, val: unknown) => ({ col, val })),
  asc: mock((col: unknown) => ({ type: 'asc', col })),
  and: mock((...args: unknown[]) => args),
  count: mock((col: unknown) => ({ fn: 'count', col })),
  sql: mock((strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values })),
}));

const mockDbReturningInsert = mock(() => Promise.resolve([{ id: 'stub-id' }]));
const mockDbOnConflict = mock(() => ({ returning: mockDbReturningInsert }));
const mockDbInsertValues = mock(() => ({ onConflictDoUpdate: mockDbOnConflict }));
const mockDbReturningUpdate = mock(() => Promise.resolve([]));
const mockDbWhereUpdate = mock(() => ({ returning: mockDbReturningUpdate }));
const mockDbSet = mock(() => ({ where: mockDbWhereUpdate }));
const mockDbDeleteWhere = mock(() => Promise.resolve());
const mockDbLimit = mock(() => Promise.resolve([]));
const mockDbOrderBy = mock(() => ({ limit: mockDbLimit }));
const mockDbSelectWhere = mock(() => ({ orderBy: mockDbOrderBy }));
const mockDbFrom = mock(() => ({ where: mockDbSelectWhere }));

mock.module('../db/connection', () => ({
  db: {
    select: mock(() => ({ from: mockDbFrom })),
    insert: mock(() => ({ values: mockDbInsertValues })),
    update: mock(() => ({ set: mockDbSet })),
    delete: mock(() => ({ where: mockDbDeleteWhere })),
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

// Import real route AFTER all mocks are registered
const { pronoteSyncRoutes } = await import('../routes/pronote-sync.routes');

// ============================================
// Test app
// ============================================

const app = new Elysia().use(pronoteSyncRoutes);

// ============================================
// Helpers
// ============================================

const USER_A = 'user-a-001';
const USER_B = 'user-b-002';

function get(path: string) {
  return new Request(`http://localhost${path}`, { method: 'GET' });
}

// ============================================
// TESTS
// ============================================

describe('GET /api/pronote/credentials/list', () => {
  beforeEach(() => {
    currentUser = null;
    mockListCredentialSummaries = mock(async (_userId: string): Promise<CredSummary[]> => []);
    mockLogger.info.mockClear();
    mockLogger.error.mockClear();
  });

  // ------------------------------------
  // Auth guard
  // ------------------------------------

  it('returns 401 when unauthenticated', async () => {
    currentUser = null;
    const res = await app.handle(get('/api/pronote/credentials/list'));
    expect(res.status).toBe(401);
  });

  // ------------------------------------
  // 0 credentials
  // ------------------------------------

  it('authenticated user with 0 credentials → 200 + empty array', async () => {
    currentUser = { id: USER_A };
    mockListCredentialSummaries = mock(async (_userId: string): Promise<CredSummary[]> => []);

    const res = await app.handle(get('/api/pronote/credentials/list'));
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: unknown[] };
    expect(body.success).toBe(true);
    expect(body.data).toEqual([]);
  });

  // ------------------------------------
  // 1 credential, 0 children
  // ------------------------------------

  it('1 credential with 0 children → childCount 0', async () => {
    currentUser = { id: USER_A };
    mockListCredentialSummaries = mock(async (_userId: string): Promise<CredSummary[]> => [
      {
        credentialId: 'cred-001',
        establishmentName: 'Lycée Victor Hugo',
        establishmentUrl: 'https://lycee.example.fr/pronote',
        childCount: 0,
      },
    ]);

    const res = await app.handle(get('/api/pronote/credentials/list'));
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: CredSummary[] };
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
    expect(body.data[0]!.credentialId).toBe('cred-001');
    expect(body.data[0]!.childCount).toBe(0);
    expect(body.data[0]!.establishmentName).toBe('Lycée Victor Hugo');
  });

  // ------------------------------------
  // 2 credentials, with children (correct count per credential)
  // ------------------------------------

  it('2 credentials → correct childCount per credential', async () => {
    currentUser = { id: USER_A };
    mockListCredentialSummaries = mock(async (_userId: string): Promise<CredSummary[]> => [
      {
        credentialId: 'cred-school-a',
        establishmentName: 'Collège A',
        establishmentUrl: 'https://college-a.example.fr/pronote',
        childCount: 3,
      },
      {
        credentialId: 'cred-school-b',
        establishmentName: 'Lycée B',
        establishmentUrl: 'https://lycee-b.example.fr/pronote',
        childCount: 1,
      },
    ]);

    const res = await app.handle(get('/api/pronote/credentials/list'));
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: CredSummary[] };
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(2);

    const schoolA = body.data.find(c => c.credentialId === 'cred-school-a');
    const schoolB = body.data.find(c => c.credentialId === 'cred-school-b');

    expect(schoolA).toBeDefined();
    expect(schoolA!.childCount).toBe(3);
    expect(schoolA!.establishmentName).toBe('Collège A');

    expect(schoolB).toBeDefined();
    expect(schoolB!.childCount).toBe(1);
    expect(schoolB!.establishmentName).toBe('Lycée B');
  });

  // ------------------------------------
  // establishmentName from column (service called, not adapter)
  // ------------------------------------

  it('calls listCredentialSummaries with user.id (not any adapter)', async () => {
    currentUser = { id: USER_A };
    let capturedUserId: string | undefined;
    mockListCredentialSummaries = mock(async (userId: string): Promise<CredSummary[]> => {
      capturedUserId = userId;
      return [];
    });

    await app.handle(get('/api/pronote/credentials/list'));

    expect(capturedUserId).toBe(USER_A);
  });

  // ------------------------------------
  // Ownership: different user sees their own (empty) list
  // ------------------------------------

  it('ownership: USER_B gets own (empty) list, not USER_A credentials', async () => {
    // Simulates: USER_A has creds, USER_B has none.
    // The route must pass user.id to the service — service enforces isolation.
    currentUser = { id: USER_B };
    mockListCredentialSummaries = mock(async (userId: string): Promise<CredSummary[]> => {
      // Only return data for USER_A; USER_B sees nothing
      if (userId === USER_A) {
        return [{
          credentialId: 'cred-a',
          establishmentName: 'School A',
          establishmentUrl: 'https://school-a.fr/pronote',
          childCount: 2,
        }];
      }
      return [];
    });

    const res = await app.handle(get('/api/pronote/credentials/list'));
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: CredSummary[] };
    expect(body.data).toEqual([]);
  });
});
