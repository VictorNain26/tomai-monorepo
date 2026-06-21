/**
 * Tests — DELETE /api/pronote/credentials/:id
 *
 * Covers:
 *   - happy path: credential deleted, mapping cascaded, child user preserved
 *   - ownership: another user's credential → 403, credential NOT deleted
 *   - unknown id → 404
 *   - unauthenticated → 401
 */

import { describe, it, expect, beforeEach, mock, type Mock } from 'bun:test';
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

// Typed error classes (mirrored from pronote-connect.service)
class PronoteCredentialNotFoundError extends Error {
  constructor(credentialId: string) {
    super(`Pronote credential not found: ${credentialId}`);
    this.name = 'PronoteCredentialNotFoundError';
  }
}
class PronoteCredentialForbiddenError extends Error {
  constructor() {
    super('This Pronote credential does not belong to the requesting user');
    this.name = 'PronoteCredentialForbiddenError';
  }
}
class PronoteChildNotOwnedError extends Error {
  constructor(childId: string) {
    super(`Child ${childId} does not belong to the requesting parent`);
    this.name = 'PronoteChildNotOwnedError';
  }
}

mock.module('../services/pronote/pronote-connect.service', () => ({
  PronoteCredentialNotFoundError,
  PronoteCredentialForbiddenError,
  PronoteChildNotOwnedError,
  pronoteConnectService: {
    connectQr: mock(async () => ({ resources: [] })),
    discover: mock(async () => []),
    activate: mock(async () => ({ activated: [], failed: [] })),
    resync: mock(async () => ({ added: [], stillMapped: [] })),
  },
}));

// pronoteSyncService mock — mutable per test
let mockDeleteCredentialById: Mock<(userId: string, credentialId: string) => Promise<boolean>>;

mockDeleteCredentialById = mock(async (_userId: string, _credentialId: string): Promise<boolean> => true);

mock.module('../services/pronote-sync.service', () => ({
  PronoteCredentialForbiddenError,
  pronoteSyncService: {
    get deleteCredentialById() { return mockDeleteCredentialById; },
    // stubs for other route handlers
    listCredentialSummaries: mock(async () => []),
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

const PARENT_USER_ID = 'parent-user-001';
const OTHER_USER_ID = 'other-user-002';
const CRED_ID = 'cred-abc-123';

function del(path: string) {
  return new Request(`http://localhost${path}`, { method: 'DELETE' });
}

// ============================================
// TESTS
// ============================================

describe('DELETE /api/pronote/credentials/:id', () => {
  beforeEach(() => {
    currentUser = null;
    // Default: happy path — owned credential found and deleted
    mockDeleteCredentialById = mock(async (_userId: string, _credentialId: string): Promise<boolean> => true);
    mockLogger.info.mockClear();
    mockLogger.error.mockClear();
  });

  // ------------------------------------
  // Auth guard
  // ------------------------------------

  it('returns 401 when unauthenticated', async () => {
    currentUser = null;
    const res = await app.handle(del(`/api/pronote/credentials/${CRED_ID}`));
    expect(res.status).toBe(401);
  });

  // ------------------------------------
  // Happy path: credential deleted, child user preserved
  // ------------------------------------

  it('owned credential → 200 { success: true }, deleteCredentialById called with correct args', async () => {
    currentUser = { id: PARENT_USER_ID };
    let capturedUserId: string | undefined;
    let capturedCredentialId: string | undefined;
    mockDeleteCredentialById = mock(async (userId: string, credentialId: string): Promise<boolean> => {
      capturedUserId = userId;
      capturedCredentialId = credentialId;
      return true;
    });

    const res = await app.handle(del(`/api/pronote/credentials/${CRED_ID}`));

    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(true);
    expect(capturedUserId).toBe(PARENT_USER_ID);
    expect(capturedCredentialId).toBe(CRED_ID);
  });

  // Cascade + child kept: the service is responsible for DB; here we just verify
  // that the service returned true (credential gone) and the route reports success.
  // The unit test for deleteCredentialById service method covers cascade + child kept.
  it('service returns true (cascade done, child user kept) → route returns 200', async () => {
    currentUser = { id: PARENT_USER_ID };
    mockDeleteCredentialById = mock(async (): Promise<boolean> => true);

    const res = await app.handle(del(`/api/pronote/credentials/${CRED_ID}`));
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean };
    expect(body.success).toBe(true);
  });

  // ------------------------------------
  // Ownership: another user → 403, credential NOT deleted
  // ------------------------------------

  it('other user tries to delete → 403, deleteCredentialById throws PronoteCredentialForbiddenError', async () => {
    currentUser = { id: OTHER_USER_ID };
    mockDeleteCredentialById = mock(async (_userId: string, _credentialId: string): Promise<boolean> => {
      throw new PronoteCredentialForbiddenError();
    });

    const res = await app.handle(del(`/api/pronote/credentials/${CRED_ID}`));

    expect(res.status).toBe(403);
    const body = await res.json() as { error: string; code: string };
    expect(body.error).toBeDefined();
    expect(body.code).toBe('pronote_credential_forbidden');
  });

  // ------------------------------------
  // Unknown id → 404
  // ------------------------------------

  it('unknown credential id → 404', async () => {
    currentUser = { id: PARENT_USER_ID };
    mockDeleteCredentialById = mock(async (): Promise<boolean> => false);

    const res = await app.handle(del('/api/pronote/credentials/unknown-id-999'));

    expect(res.status).toBe(404);
    const body = await res.json() as { error: string; code: string };
    expect(body.error).toBeDefined();
    expect(body.code).toBe('pronote_credential_not_found');
  });
});
