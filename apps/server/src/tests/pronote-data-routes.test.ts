/**
 * Tests — Pronote Data Routes (routes/pronote-data.routes.ts)
 *
 * Covers authorization (GET: self or parent; PUT: parent only),
 * typed error → HTTP status mapping, and happy paths.
 */

import { describe, it, expect, beforeEach, mock, type Mock } from 'bun:test';
import { Elysia } from 'elysia';
import { createMockLogger } from './_helpers/mock-logger';
import type { PronoteChildStatus } from '../services/pronote/provider.types';

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

// pronoteDataService mocks
let mockGetGrades = mock(async (_childId: string) => [{ subject: 'Maths', value: 18 }]);
let mockGetHomework = mock(async (_childId: string) => [{ description: 'Exercice 3' }]);
let mockGetTimetable = mock(async (_childId: string, _day: string) => [{ start: '08:00', subject: 'Français' }]);
let mockConfigureResource = mock(async (_parentId: string, _childId: string, _credentialId: string, _resourceId: number) => {});

mock.module('../services/pronote/pronote-data.service', () => {
  class PronoteResourceNotMappedError extends Error {
    readonly childId: string;
    constructor(childId: string) {
      super(`No Pronote resource mapping found for child ${childId}`);
      this.name = 'PronoteResourceNotMappedError';
      this.childId = childId;
    }
  }
  class PronoteNotConnectedError extends Error {
    constructor(parentUserId: string) {
      super(`No Pronote credentials found for parent ${parentUserId}`);
      this.name = 'PronoteNotConnectedError';
    }
  }
  class PronoteMetadataError extends Error {
    constructor(field: string) {
      super(`Pronote metadata is missing required field: ${field}`);
      this.name = 'PronoteMetadataError';
    }
  }
  return {
    pronoteDataService: {
      get getGrades() { return mockGetGrades; },
      get getHomework() { return mockGetHomework; },
      get getTimetable() { return mockGetTimetable; },
      get configureResource() { return mockConfigureResource; },
    },
    PronoteResourceNotMappedError,
    PronoteNotConnectedError,
    PronoteMetadataError,
  };
});

// pawnote-server.adapter — PronoteReauthRequired
mock.module('../services/pronote/pawnote-server.adapter', () => {
  class PronoteReauthRequired extends Error {
    constructor(cause?: unknown) {
      super(`Pronote session expired: ${cause}`);
      this.name = 'PronoteReauthRequired';
    }
  }
  return { PronoteReauthRequired, pawnoteServerAdapter: {} };
});

// pronoteChildResourcesRepository
let mockUpsertMapping = mock(async (_parentId: string, _childId: string, _credentialId: string, _resourceId: number) => {});
let mockGetStatusByChild: Mock<(_childUserId: string) => Promise<PronoteChildStatus>> = mock(
  async (_childUserId: string): Promise<PronoteChildStatus> => ({
    hasPronote: false,
    establishmentName: null,
    className: null,
  }),
);
mock.module('../db/repositories/pronote-child-resources.repository', () => ({
  pronoteChildResourcesRepository: {
    get upsertMapping() { return mockUpsertMapping; },
    get getStatusByChild() { return mockGetStatusByChild; },
  },
}));

// parentService — mutable: controls isParentOf result
let isParentOfResult = false;
mock.module('../services/parent.service', () => ({
  parentService: {
    isParentOf: mock(async (_parentId: string, _studentId: string) => isParentOfResult),
  },
}));

// Import real route AFTER all mocks are registered
const { pronoteDataRoutes } = await import('../routes/pronote-data.routes');

// ============================================
// Test app
// ============================================

const app = new Elysia().use(pronoteDataRoutes);

// ============================================
// Helpers
// ============================================

const PARENT_ID = 'parent-001';
const CHILD_ID = 'child-001';
const OTHER_USER_ID = 'other-999';

function makeRequest(method: string, path: string, body?: unknown) {
  return new Request(`http://localhost${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

// ============================================
// TESTS
// ============================================

describe('pronote-data routes', () => {
  beforeEach(() => {
    currentUser = null;
    isParentOfResult = false;
    mockGetGrades = mock(async (_childId: string) => [{ subject: 'Maths', value: 18 }]);
    mockGetHomework = mock(async (_childId: string) => [{ description: 'Exercice 3' }]);
    mockGetTimetable = mock(async (_childId: string, _day: string) => [{ start: '08:00', subject: 'Français' }]);
    mockConfigureResource = mock(async (_parentId: string, _childId: string, _credentialId: string, _resourceId: number) => {});
    mockUpsertMapping = mock(async () => {});
    mockGetStatusByChild = mock(
      async (_childUserId: string): Promise<PronoteChildStatus> => ({
        hasPronote: false,
        establishmentName: null,
        className: null,
      }),
    );
  });

  // ------------------------------------
  // Authentication guard
  // ------------------------------------

  it('returns 401 when unauthenticated (grades)', async () => {
    currentUser = null;
    const res = await app.handle(makeRequest('GET', `/api/pronote/children/${CHILD_ID}/grades`));
    expect(res.status).toBe(401);
  });

  // ------------------------------------
  // GET grades — authorization
  // ------------------------------------

  it('parent accessing child grades → 200 + data', async () => {
    currentUser = { id: PARENT_ID, role: 'parent' };
    isParentOfResult = true;

    const res = await app.handle(makeRequest('GET', `/api/pronote/children/${CHILD_ID}/grades`));
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: unknown[] };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
  });

  it('child accessing own grades (user.id === childId) → 200', async () => {
    currentUser = { id: CHILD_ID, role: 'student' };
    isParentOfResult = false; // isParentOf not even needed when self

    const res = await app.handle(makeRequest('GET', `/api/pronote/children/${CHILD_ID}/grades`));
    expect(res.status).toBe(200);
  });

  it('unrelated user (not self, not parent) → 403', async () => {
    currentUser = { id: OTHER_USER_ID, role: 'parent' };
    isParentOfResult = false;

    const res = await app.handle(makeRequest('GET', `/api/pronote/children/${CHILD_ID}/grades`));
    expect(res.status).toBe(403);
  });

  // ------------------------------------
  // GET homework / timetable — same auth rules
  // ------------------------------------

  it('parent accessing child homework → 200', async () => {
    currentUser = { id: PARENT_ID, role: 'parent' };
    isParentOfResult = true;

    const res = await app.handle(makeRequest('GET', `/api/pronote/children/${CHILD_ID}/homework`));
    expect(res.status).toBe(200);
  });

  it('unrelated user (not self, not parent) accessing homework → 403', async () => {
    currentUser = { id: OTHER_USER_ID, role: 'parent' };
    isParentOfResult = false;

    const res = await app.handle(makeRequest('GET', `/api/pronote/children/${CHILD_ID}/homework`));
    expect(res.status).toBe(403);
  });

  it('parent accessing child timetable → 200', async () => {
    currentUser = { id: PARENT_ID, role: 'parent' };
    isParentOfResult = true;

    const res = await app.handle(makeRequest('GET', `/api/pronote/children/${CHILD_ID}/timetable?day=2026-06-16`));
    expect(res.status).toBe(200);
  });

  it('unrelated user (not self, not parent) accessing timetable → 403', async () => {
    currentUser = { id: OTHER_USER_ID, role: 'parent' };
    isParentOfResult = false;

    const res = await app.handle(makeRequest('GET', `/api/pronote/children/${CHILD_ID}/timetable?day=2026-06-16`));
    expect(res.status).toBe(403);
  });

  it('timetable without ?day param → 422 (TypeBox validation)', async () => {
    currentUser = { id: PARENT_ID, role: 'parent' };
    isParentOfResult = true;

    const res = await app.handle(makeRequest('GET', `/api/pronote/children/${CHILD_ID}/timetable`));
    expect(res.status).toBe(422);
  });

  it('timetable with malformed ?day param → 422 (TypeBox pattern validation)', async () => {
    currentUser = { id: PARENT_ID, role: 'parent' };
    isParentOfResult = true;

    const res = await app.handle(makeRequest('GET', `/api/pronote/children/${CHILD_ID}/timetable?day=not-a-date`));
    expect(res.status).toBe(422);
  });

  // ------------------------------------
  // PUT resource — parent only
  // ------------------------------------

  it('parent calling PUT resource → 200, delegates to configureResource (not upsertMapping directly)', async () => {
    currentUser = { id: PARENT_ID, role: 'parent' };
    isParentOfResult = true;
    const CRED_ID = '00000000-0000-0000-0000-000000000042';

    const res = await app.handle(makeRequest('PUT', `/api/pronote/children/${CHILD_ID}/resource`, { credentialId: CRED_ID, resourceId: 42 }));
    expect(res.status).toBe(200);
    // Route must delegate to pronoteDataService.configureResource — never call upsertMapping directly
    expect(mockUpsertMapping.mock.calls.length).toBe(0);
    expect(mockConfigureResource.mock.calls.length).toBe(1);
    const [calledParentId, calledChildId, calledCredentialId, calledResourceId] = mockConfigureResource.mock.calls[0] as [string, string, string, number];
    expect(calledParentId).toBe(PARENT_ID);
    expect(calledChildId).toBe(CHILD_ID);
    expect(calledCredentialId).toBe(CRED_ID);
    expect(calledResourceId).toBe(42);
  });

  it('child calling PUT resource → 403 (only parent maps)', async () => {
    currentUser = { id: CHILD_ID, role: 'student' };
    isParentOfResult = false;

    const res = await app.handle(makeRequest('PUT', `/api/pronote/children/${CHILD_ID}/resource`, { credentialId: '00000000-0000-0000-0000-000000000042', resourceId: 42 }));
    expect(res.status).toBe(403);
  });

  // ------------------------------------
  // Error mapping
  // ------------------------------------

  it('PronoteResourceNotMappedError → 404 with code pronote_resource_not_mapped (static message, no childId leak)', async () => {
    currentUser = { id: CHILD_ID, role: 'student' };
    const { PronoteResourceNotMappedError } = await import('../services/pronote/pronote-data.service');
    mockGetGrades = mock(async () => { throw new PronoteResourceNotMappedError(CHILD_ID); });

    const res = await app.handle(makeRequest('GET', `/api/pronote/children/${CHILD_ID}/grades`));
    expect(res.status).toBe(404);
    const body = await res.json() as { code: string; error: string };
    expect(body.code).toBe('pronote_resource_not_mapped');
    expect(body.error).toBe('Resource not found');
    expect(JSON.stringify(body)).not.toContain(CHILD_ID);
  });

  it('PronoteNotConnectedError → 409 with code pronote_not_connected', async () => {
    currentUser = { id: CHILD_ID, role: 'student' };
    const { PronoteNotConnectedError } = await import('../services/pronote/pronote-data.service');
    mockGetGrades = mock(async () => { throw new PronoteNotConnectedError('parent-x'); });

    const res = await app.handle(makeRequest('GET', `/api/pronote/children/${CHILD_ID}/grades`));
    expect(res.status).toBe(409);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('pronote_not_connected');
  });

  it('PronoteReauthRequired → 409 with code pronote_reauth_required', async () => {
    currentUser = { id: CHILD_ID, role: 'student' };
    const { PronoteReauthRequired } = await import('../services/pronote/pawnote-server.adapter');
    mockGetGrades = mock(async () => { throw new PronoteReauthRequired('token expired'); });

    const res = await app.handle(makeRequest('GET', `/api/pronote/children/${CHILD_ID}/grades`));
    expect(res.status).toBe(409);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('pronote_reauth_required');
  });

  it('PronoteMetadataError → 500 with code pronote_metadata_invalid', async () => {
    currentUser = { id: CHILD_ID, role: 'student' };
    const { PronoteMetadataError } = await import('../services/pronote/pronote-data.service');
    mockGetGrades = mock(async () => { throw new PronoteMetadataError('instanceUrl'); });

    const res = await app.handle(makeRequest('GET', `/api/pronote/children/${CHILD_ID}/grades`));
    expect(res.status).toBe(500);
    const body = await res.json() as { code: string };
    expect(body.code).toBe('pronote_metadata_invalid');
  });

  // ------------------------------------
  // GET /status — Task 4: read-model
  // ------------------------------------

  it('status: parent with mapped child → 200 + hasPronote:true + names', async () => {
    currentUser = { id: PARENT_ID, role: 'parent' };
    isParentOfResult = true;
    mockGetStatusByChild = mock(
      async (_childUserId: string): Promise<PronoteChildStatus> => ({
        hasPronote: true,
        establishmentName: 'Lycée Victor Hugo',
        className: 'Terminale S',
      }),
    );

    const res = await app.handle(makeRequest('GET', `/api/pronote/children/${CHILD_ID}/status`));
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: { hasPronote: boolean; establishmentName: string | null; className: string | null } };
    expect(body.success).toBe(true);
    expect(body.data.hasPronote).toBe(true);
    expect(body.data.establishmentName).toBe('Lycée Victor Hugo');
    expect(body.data.className).toBe('Terminale S');
  });

  it('status: parent with unmapped child → 200 + hasPronote:false + null names', async () => {
    currentUser = { id: PARENT_ID, role: 'parent' };
    isParentOfResult = true;
    // mockGetStatusByChild already returns hasPronote:false by default in beforeEach

    const res = await app.handle(makeRequest('GET', `/api/pronote/children/${CHILD_ID}/status`));
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: { hasPronote: boolean; establishmentName: string | null; className: string | null } };
    expect(body.success).toBe(true);
    expect(body.data.hasPronote).toBe(false);
    expect(body.data.establishmentName).toBeNull();
    expect(body.data.className).toBeNull();
  });

  it('status: child accessing own status (self) → 200', async () => {
    currentUser = { id: CHILD_ID, role: 'student' };
    isParentOfResult = false;
    mockGetStatusByChild = mock(
      async (_childUserId: string): Promise<PronoteChildStatus> => ({
        hasPronote: true,
        establishmentName: 'Collège Jean Moulin',
        className: '4ème B',
      }),
    );

    const res = await app.handle(makeRequest('GET', `/api/pronote/children/${CHILD_ID}/status`));
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: { hasPronote: boolean } };
    expect(body.success).toBe(true);
    expect(body.data.hasPronote).toBe(true);
  });

  it('status: third-party (other parent, not self) → 403', async () => {
    currentUser = { id: OTHER_USER_ID, role: 'parent' };
    isParentOfResult = false;

    const res = await app.handle(makeRequest('GET', `/api/pronote/children/${CHILD_ID}/status`));
    expect(res.status).toBe(403);
  });
});
