/**
 * Pronote Onboarding — end-to-end integration test
 *
 * Exercises the full onboarding chain against the public Pronote demo:
 *   https://demo.index-education.net/pronote/
 *   credentials: demonstration / pronotevs / AccountKind STUDENT (6)
 *
 * Chain proven:
 *   loginWithCredentials(demo) → upsertCredentials → primeSession
 *   → discover(parentUserId, credentialId)   [≥1 real resource from demo]
 *   → activate(parentUserId, credentialId, [1 selection])  [create + mapping]
 *   → pronoteDataService.getGrades(childId)  [full read via mapping]
 *
 * The demo accepts loginCredentials but rejects loginToken.
 * primeSession bypasses the loginToken path (same as pronote-data.integration.test.ts).
 *
 * Mock scope — encryption only (infrastructure, not data path):
 *   PRONOTE_ENCRYPTION_KEY is absent in the dev env (same situation as the
 *   companion pronote-data.integration.test.ts, which explicitly notes it).
 *   We stub encrypt/decrypt with a trivial pass-through so discover() can verify
 *   credential ownership without the real AES key. The pawnote session, adapter
 *   and all Pronote API calls remain fully real (zero mock on the data path).
 *
 * Skip behaviour: if the demo is unreachable (offline CI), all tests skip cleanly.
 * Cleanup: afterAll removes all probe-onboarding-* and probe-child-* users.
 *
 * Security: only counts/booleans/lengths are logged — never tokens, passwords or
 * credentials.
 */

// ============================================================
// mock.module declarations — MUST come before any static import
// that transitively loads the mocked modules.
// ============================================================

import { mock } from 'bun:test';

// Stub encryption so discover() can read back credentials without a real key.
// This affects only the test-inserted credential rows; the pawnote data path is real.
mock.module('../lib/encryption.ts', () => ({
  encrypt: async (plaintext: string) => Buffer.from(plaintext).toString('base64'),
  decrypt: async (ciphertext: string) => Buffer.from(ciphertext, 'base64').toString('utf-8'),
  validateEncryptionKey: async () => true,
}));

// ============================================================
// Imports — after mock declarations
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { randomUUID } from 'crypto';

import { loginWithCredentials } from './helpers/pronote-credentials-login.js';
import { type AdapterSession } from '../services/pronote/pawnote-server.adapter.js';
import { pronoteDataService } from '../services/pronote/pronote-data.service.js';
import { pronoteConnectService } from '../services/pronote/pronote-connect.service.js';
import { pronoteSyncService } from '../services/pronote-sync.service.js';
import { db } from '../db/connection.js';
import { user as userTable } from '../db/schema.js';
import { like } from 'drizzle-orm';

// ============================================================
// Demo constants
// ============================================================

const DEMO_URL = 'https://demo.index-education.net/pronote/';
const DEMO_USERNAME = 'demonstration';
const DEMO_PASSWORD = 'pronotevs';
const DEMO_KIND = 6; // AccountKind.STUDENT

// ============================================================
// Reachability check — top-level await so describe.skipIf
// evaluates the correct value at registration time.
// ============================================================

function checkDemoReachable(): Promise<boolean> {
  return fetch(DEMO_URL, { method: 'HEAD', signal: AbortSignal.timeout(8_000) })
    .then((r) => r.status < 500)
    .catch(() => false);
}

const demoReachable = await checkDemoReachable();

if (!demoReachable) {
  console.warn('[pronote-onboarding.integration] Demo unreachable — all tests will be skipped');
}

// ============================================================
// Test state
// ============================================================

const PROBE_PREFIX = `probe-onboarding-${Date.now()}`;
const PROBE_CHILD_PREFIX = `probe-child-${Date.now()}`;

let session: AdapterSession;
let parentId: string;
let credentialId: string;
let activatedChildId: string | null = null;

// ============================================================
// Setup & teardown
// ============================================================

beforeAll(async () => {
  if (!demoReachable) return;

  // 1. Login against the demo (loginCredentials path — token-based auth is not tested here)
  session = await loginWithCredentials({
    url: DEMO_URL,
    kind: DEMO_KIND,
    username: DEMO_USERNAME,
    password: DEMO_PASSWORD,
    deviceUuid: 'tom-onboarding-e2e',
  });

  // 2. Seed: parent user in DB
  const parentEmail = `${PROBE_PREFIX}-parent@example.test`;
  const [parent] = await db
    .insert(userTable)
    .values({
      id: randomUUID(),
      email: parentEmail,
      name: 'Probe Onboarding Parent',
      role: 'parent',
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();
  if (!parent) throw new Error('Failed to insert probe parent');
  parentId = parent.id;

  // 3. Insert credential via pronoteSyncService (encrypts token+metadata correctly).
  //    encryption is stubbed above so this works without PRONOTE_ENCRYPTION_KEY.
  //    The metadata must satisfy parseMetadata() in pronote-data.service.ts.
  const metadata = JSON.stringify({
    instanceUrl: DEMO_URL,
    username: DEMO_USERNAME,
    deviceUuid: 'tom-onboarding-e2e',
    accountKind: DEMO_KIND,
  });

  const upsertResult = await pronoteSyncService.upsertCredentials(parentId, {
    token: 'integration-test-token-placeholder',
    metadata,
    tokenExpiresAt: '2099-01-01T00:00:00.000Z',
  });

  if (!upsertResult.success || !upsertResult.credentialId) {
    throw new Error(`Failed to upsert credential: ${upsertResult.error ?? 'unknown'}`);
  }
  credentialId = upsertResult.credentialId;

  // 4. Prime the session cache so discover/activate use the live session and skip loginToken
  //    (the demo rejects loginToken — same pattern as pronote-data.integration.test.ts).
  pronoteDataService.primeSession(credentialId, session);
}, 60_000);

afterAll(async () => {
  // Delete probe parent (and credential via FK cascade) by email pattern
  await db
    .delete(userTable)
    .where(like(userTable.email, `${PROBE_PREFIX}%@example.test`));

  // Delete child users created by activate() — their email is generated as
  // <username>@tomai.internal by parentService.createChild (Better Auth internal email).
  // We match on the username prefix embedded in the email.
  await db
    .delete(userTable)
    .where(like(userTable.email, `${PROBE_CHILD_PREFIX}%`));
});

// ============================================================
// Chain: discover → activate → read
// ============================================================

describe.skipIf(!demoReachable)('Pronote onboarding e2e — discover → activate → read', () => {

  let discoveredResourceId: number;

  it('discover — returns ≥1 real resource from the demo', async () => {
    const children = await pronoteConnectService.discover(parentId, credentialId);

    console.log(`[pronote-onboarding.integration] discover: ${children.length} resource(s)`);

    expect(Array.isArray(children)).toBe(true);
    expect(children.length).toBeGreaterThanOrEqual(1);

    const first = children[0]!;
    expect(typeof first.resourceId).toBe('number');
    expect(typeof first.name).toBe('string');
    expect(first.name.length).toBeGreaterThan(0);

    discoveredResourceId = first.resourceId;
  }, 30_000);

  it('activate — creates 1 child profile + Pronote mapping', async () => {
    const childUsername = `${PROBE_CHILD_PREFIX}-u`;
    const childPassword = `ProbePass${Date.now().toString().slice(-4)}!`; // ≥8 chars

    const result = await pronoteConnectService.activate(parentId, credentialId, [
      {
        resourceId: discoveredResourceId,
        firstName: 'ProbeFirst',
        lastName: 'ProbeLast',
        schoolLevel: 'troisieme',
        username: childUsername,
        password: childPassword,
        // no linkToChildId — create path
      },
    ]);

    console.log(`[pronote-onboarding.integration] activate: ${result.activated.length} activated`);

    expect(result.activated).toHaveLength(1);
    expect(typeof result.activated[0]!.childId).toBe('string');
    expect(result.activated[0]!.resourceId).toBe(discoveredResourceId);

    activatedChildId = result.activated[0]!.childId;
  }, 30_000);

  it('getGrades — reads real grades via the activated childId mapping', async () => {
    if (!activatedChildId) {
      throw new Error('activatedChildId not set — activate step must have run first');
    }

    const grades = await pronoteDataService.getGrades(activatedChildId);

    console.log(`[pronote-onboarding.integration] getGrades: ${grades.length} grade(s)`);

    // Proves the full chain: credential → mapping → resolveSession → adapter → pawnote → demo
    expect(Array.isArray(grades)).toBe(true);
  }, 30_000);
});
