/**
 * Pronote Data — end-to-end integration test
 *
 * Exercises the full server read path against the public Pronote demo:
 *   https://demo.index-education.net/pronote/
 *   credentials: demonstration / pronotevs / AccountKind STUDENT (6)
 *
 * KNOWN LIMITATION — loginToken path NOT exercised here:
 *   The public demo account rejects token-based re-authentication
 *   (BadCredentialsError). The normal production path in pronoteDataService
 *   calls pawnoteServerAdapter.connect() which uses loginToken. That code
 *   path must be proven against a real school account via the
 *   PRONOTE_TEST_* env variables (see apps/server/.env.example).
 *   Do NOT fake this test: skip explicitly if the demo is unreachable.
 *
 * What IS proven here:
 *   Part A — pawnoteServerAdapter reads real grades/homework/timetable.
 *   Part B — the full HTTP route chain (route → service → adapter → demo),
 *             with authMacro mocked only for identity injection and the entire
 *             data path (DB, service, adapter) remaining real.
 *   Denial — an unrelated user receives 403 from the real authorization check.
 *
 * NOTE on pronoteSyncService.upsertCredentials:
 *   We do NOT call it here because (a) the route hits the in-process cache
 *   (primeSession), so it never falls through to getCredentials/loginToken;
 *   (b) PRONOTE_ENCRYPTION_KEY is absent in the dev env (optional, only
 *   required in production). The credential-persistence path is exercised by
 *   the production flow; it is not part of this demo proof.
 */

import { describe, it, expect, beforeAll, afterAll, mock } from 'bun:test';
import { Elysia } from 'elysia';
import { randomUUID } from 'crypto';

// ============================================================
// Auth middleware mock — MUST be declared before any import
// that transitively loads auth-macro or auth.middleware.
// Only mocks identity injection; every other module is real.
// ============================================================

type MockUser = {
  id: string;
  email: string;
  role: 'parent' | 'student' | 'admin';
  name?: string | null;
};

let _mockUser: MockUser | null = null;

mock.module('../middleware/auth.middleware', () => ({
  requireAuth: async () => {
    if (!_mockUser) {
      return { success: false as const, _error: 'Unauthorized', status: 401 as const };
    }
    return { success: true as const, user: _mockUser, session: { id: 'test-session' } };
  },
  requireParentRole: async () => {
    if (!_mockUser) {
      return { success: false as const, _error: 'Unauthorized', status: 401 as const };
    }
    if (_mockUser.role !== 'parent') {
      return { success: false as const, _error: 'Parent role required', status: 403 as const };
    }
    return { success: true as const, user: _mockUser, session: { id: 'test-session' } };
  },
}));

// ============================================================
// Imports — after mock declarations
// ============================================================

import { loginWithCredentials } from './helpers/pronote-credentials-login.js';
import { pawnoteServerAdapter, type AdapterSession } from '../services/pronote/pawnote-server.adapter.js';
import { pronoteDataService } from '../services/pronote/pronote-data.service.js';
import { pronoteChildResourcesRepository } from '../db/repositories/pronote-child-resources.repository.js';
import { pronoteDataRoutes } from '../routes/pronote-data.routes.js';
import { db } from '../db/connection.js';
import { user as userTable, parentChild as parentChildTable, pronoteCredentials as pronoteCredentialsTable } from '../db/schema.js';
import { like, sql } from 'drizzle-orm';

// ============================================================
// Demo constants
// ============================================================

const DEMO_URL = 'https://demo.index-education.net/pronote/';
const DEMO_USERNAME = 'demonstration';
const DEMO_PASSWORD = 'pronotevs';
const DEMO_KIND = 6; // AccountKind.STUDENT
const DEMO_DEVICE_UUID = 'tom-e2e';

// Today ISO date for timetable query
const TODAY_ISO = new Date().toISOString().slice(0, 10);

// ============================================================
// Reachability checks — top-level awaits so describe.skipIf
// evaluates the correct values at registration time.
// ============================================================

function checkDemoReachable(): Promise<boolean> {
  return fetch(DEMO_URL, { method: 'HEAD', signal: AbortSignal.timeout(8_000) })
    .then((r) => r.status < 500)
    .catch(() => false);
}

async function checkDbReachable(): Promise<boolean> {
  try {
    await db.execute(sql`select 1`);
    return true;
  } catch {
    return false;
  }
}

const [demoReachable, dbReachable] = await Promise.all([
  checkDemoReachable(),
  checkDbReachable(),
]);

if (!demoReachable) {
  console.warn('[pronote-data.integration] Demo unreachable — all tests will be skipped');
}
if (!dbReachable) {
  console.warn('[pronote-data.integration] DB unreachable — all tests will be skipped');
}

// The HEAD probe only proves the host answers — the demo can be up yet broken
// at login (PageUnavailableError observed 2026-07). Probe the real login
// top-level so describe.skipIf reflects actual usability, not mere liveness.
const probedSession =
  demoReachable && dbReachable
    ? await loginWithCredentials({
        url: DEMO_URL,
        kind: DEMO_KIND,
        username: DEMO_USERNAME,
        password: DEMO_PASSWORD,
        deviceUuid: DEMO_DEVICE_UUID,
      }).catch((err: unknown) => {
        console.warn(
          '[pronote-data.integration] Demo login failed — all tests will be skipped',
          err,
        );
        return null;
      })
    : null;

const canRun = demoReachable && dbReachable && probedSession !== null;

// ============================================================
// Test state
// ============================================================

let session: AdapterSession;
let parentId: string;
let childId: string;

// Probe user email prefix — used for cleanup
const PROBE_PREFIX = `probe-pronote-${Date.now()}`;

// ============================================================
// Elysia test app with REAL pronoteDataRoutes
// ============================================================

const testApp = new Elysia().use(pronoteDataRoutes);

// ============================================================
// Suite
// ============================================================

beforeAll(async () => {
  if (!canRun || !probedSession) return;

  // Session already established by the top-level login probe
  session = probedSession;

  // Seed DB: parent user
  const parentEmail = `${PROBE_PREFIX}-parent@example.test`;
  const [parent] = await db
    .insert(userTable)
    .values({
      id: randomUUID(),
      email: parentEmail,
      name: 'Probe Parent',
      role: 'parent',
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();
  if (!parent) throw new Error('Failed to insert probe parent');
  parentId = parent.id;

  // Seed DB: child user
  const childEmail = `${PROBE_PREFIX}-child@example.test`;
  const [child] = await db
    .insert(userTable)
    .values({
      id: randomUUID(),
      email: childEmail,
      name: 'Probe Child',
      role: 'student',
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();
  if (!child) throw new Error('Failed to insert probe child');
  childId = child.id;

  // Seed parent_child junction
  await db.insert(parentChildTable).values({ parentUserId: parentId, childUserId: childId });

  // Insert a minimal credential row so the FK constraint on pronote_child_resources is satisfied.
  // The credential content is irrelevant: the integration test bypasses getCredentials via primeSession.
  const [cred] = await db
    .insert(pronoteCredentialsTable)
    .values({
      id: randomUUID(),
      userId: parentId,
      encryptedToken: 'integration-test-placeholder',
      encryptedMetadata: 'integration-test-placeholder',
      establishmentUrl: DEMO_URL,
      tokenExpiresAt: new Date('2099-01-01'),
    })
    .returning();
  if (!cred) throw new Error('Failed to insert probe credential');

  await pronoteChildResourcesRepository.upsertMapping(parentId, childId, cred.id, 0, null, null);

  // Pre-warm the session cache so the route hits cache, bypassing loginToken
  // (which the demo rejects — see top-of-file comment).
  // Key is credentialId (cred.id) — the cache is now keyed by credential, not by parent user.
  pronoteDataService.primeSession(cred.id, session);
}, 60_000);

afterAll(async () => {
  if (!canRun) return;
  // Delete probe users — CASCADE handles pronote_child_resources,
  // but we delete the mapping explicitly first for clarity.
  if (childId) {
    try {
      await pronoteChildResourcesRepository.deleteByChild(childId);
    } catch { /* non-critical */ }
  }
  // Hard-delete probe users by email pattern (CASCADE handles parent_child rows)
  await db
    .delete(userTable)
    .where(like(userTable.email, `${PROBE_PREFIX}%@example.test`));
});

// ============================================================
// Part A — real adapter reads (no mocks, no route)
// ============================================================

describe.skipIf(!canRun)('Part A — pawnoteServerAdapter real reads (zero mocks)', () => {

  it('getGrades — returns non-empty NormalizedGrade[] with sane fields', async () => {
    const grades = await pawnoteServerAdapter.getGrades(session, 0);
    console.log(`[pronote-data.integration] getGrades: ${grades.length} grade(s)`);

    expect(Array.isArray(grades)).toBe(true);
    expect(grades.length).toBeGreaterThan(0);

    const sample = grades[0]!;
    expect(typeof sample.subject).toBe('string');
    expect(sample.subject.length).toBeGreaterThan(0);
    expect(typeof sample.scale).toBe('number');
    expect(sample.scale).toBeGreaterThan(0);
    // value may be numeric or null (absent/bonus grades)
    if (sample.value !== null) {
      expect(typeof sample.value).toBe('number');
      expect(sample.value).toBeGreaterThanOrEqual(0);
    }
    expect(typeof sample.date).toBe('string');
    expect(sample.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  }, 30_000);

  it('getHomework — returns NormalizedHomework[] with correct shape', async () => {
    const homework = await pawnoteServerAdapter.getHomework(session, 0);
    console.log(`[pronote-data.integration] getHomework: ${homework.length} item(s)`);

    expect(Array.isArray(homework)).toBe(true);
    // The demo may or may not have homework — verify shape when non-empty
    if (homework.length > 0) {
      const sample = homework[0]!;
      expect(typeof sample.subject).toBe('string');
      expect(typeof sample.description).toBe('string');
      expect(typeof sample.dueDate).toBe('string');
      expect(sample.dueDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(typeof sample.done).toBe('boolean');
    }
  }, 30_000);

  it('getTimetable — returns NormalizedLesson[] with correct shape for today', async () => {
    const lessons = await pawnoteServerAdapter.getTimetable(session, 0, TODAY_ISO);
    console.log(`[pronote-data.integration] getTimetable(${TODAY_ISO}): ${lessons.length} lesson(s)`);

    expect(Array.isArray(lessons)).toBe(true);
    if (lessons.length > 0) {
      const sample = lessons[0]!;
      expect(typeof sample.subject).toBe('string');
      expect(typeof sample.start).toBe('string');
      expect(typeof sample.end).toBe('string');
      expect(typeof sample.canceled).toBe('boolean');
    }
  }, 30_000);
});

// ============================================================
// Part B — real HTTP route chain
// ============================================================

describe.skipIf(!canRun)('Part B — real HTTP route (auth mocked, data path real)', () => {

  it('GET /grades — parent user gets 200 with real demo grades', async () => {
    _mockUser = { id: parentId, email: `${PROBE_PREFIX}-parent@example.test`, role: 'parent' };

    const res = await testApp.handle(
      new Request(`http://localhost/api/pronote/children/${childId}/grades`),
    );

    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; data: unknown[] };
    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
    console.log(`[pronote-data.integration] Route grades: ${body.data.length} item(s)`);
  }, 30_000);

  it('GET /grades — unrelated user gets 403', async () => {
    // A completely different user, not parent of childId
    const unrelatedId = randomUUID();
    _mockUser = { id: unrelatedId, email: 'unrelated@example.test', role: 'parent' };

    const res = await testApp.handle(
      new Request(`http://localhost/api/pronote/children/${childId}/grades`),
    );

    expect(res.status).toBe(403);
    const body = await res.json() as { error: string; code: string };
    expect(body.code).toBe('forbidden');
  }, 10_000);
});
