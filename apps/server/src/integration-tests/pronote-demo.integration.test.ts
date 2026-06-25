/**
 * Pronote demo-server connectivity smoke (opt-in, DB-free)
 *
 * Verifies that the pawnote library can reach a real Index Education server
 * and authenticate with the public demo account. Requires NO database.
 *
 * Enable: PRONOTE_DEMO_E2E=1 bun run test:integration
 *
 * When enabled but the demo is unreachable, the test FAILS loudly (exit ≠ 0)
 * with a clear message — never a silent pass.
 *
 * What IS proven here:
 *   Step 1 — pawnote geolocation() reaches the Index Education directory API
 *             (unauthenticated, real network, returns real school instances).
 *   Step 2 — loginCredentials() authenticates against the public demo server
 *             (https://demo.index-education.net/pronote/, demonstration/pronotevs)
 *             and returns a valid session token.
 *   Step 3 — pawnoteServerAdapter.getGrades() reads real data from the demo.
 *
 * What is NOT proven here (documented gap):
 *   The loginToken rotation path (production read path) does not work against
 *   the public demo — the demo rejects token re-authentication (BadCredentialsError).
 *   loginQrCode requires a scanned QR from a real mobile device (no public demo path).
 *   Both paths are exercised only with a real school account via PRONOTE_TEST_* vars
 *   (see pronote-real-account.integration.test.ts) or verified manually at release.
 */

import { describe, it, expect, beforeAll } from 'bun:test';
import { geolocation } from 'pawnote';
import { loginWithCredentials } from './helpers/pronote-credentials-login.js';
import {
  pawnoteServerAdapter,
  type AdapterSession,
} from '../services/pronote/pawnote-server.adapter.js';

// ============================================================
// Opt-in guard
// ============================================================

const RUN = process.env['PRONOTE_DEMO_E2E'] === '1';

if (!RUN) {
  console.log(
    '[pronote-demo] Skipped (set PRONOTE_DEMO_E2E=1 to run the real demo smoke)',
  );
}

// ============================================================
// Demo constants — public, no real credentials
// ============================================================

const DEMO_URL = 'https://demo.index-education.net/pronote/';
const DEMO_USERNAME = 'demonstration';
const DEMO_PASSWORD = 'pronotevs';
const DEMO_KIND = 6; // AccountKind.STUDENT

// Paris coordinates — known to return multiple school instances from geoloc API
const PARIS = { latitude: 48.8566, longitude: 2.3522 };

// ============================================================
// Suite
// ============================================================

describe.skipIf(!RUN)('Pronote demo-server connectivity (real, DB-free)', () => {
  let session: AdapterSession;

  beforeAll(async () => {
    // Step 1 happens first so a network outage surfaces with context before
    // the credential login attempt.
    console.log('[pronote-demo] Starting real pawnote smoke against Index Education demo');
  }, 5_000);

  // ----------------------------------------------------------
  // Step 1 — unauthenticated geolocation probe
  // Calls https://www.index-education.com/swie/geoloc.php
  // Returns real school instances from the Index Education directory.
  // This is a pure network reachability probe — no credentials, no session.
  // ----------------------------------------------------------
  it('step 1 — geolocation() reaches Index Education directory and returns school instances', async () => {
    let instances: Awaited<ReturnType<typeof geolocation>>;
    try {
      // Use the default pawnote fetcher for geolocation — the server fetcher's
      // SSRF allowlist blocks www.index-education.com (not a school instance URL).
      // geolocation() hits a different domain (www.index-education.com/swie/geoloc.php)
      // that is not in the school-instance allowlist, by design.
      instances = await geolocation(PARIS);
    } catch (err) {
      console.error('[pronote-demo] Pronote demo unreachable — integration NOT verified:', err);
      // Re-throw so the test fails loudly (not silently green)
      throw err;
    }

    // A location near Paris reliably returns multiple schools
    expect(Array.isArray(instances)).toBe(true);
    expect(instances.length).toBeGreaterThan(0);
    // Each instance must have a real url and name
    const first = instances[0];
    expect(first).toBeDefined();
    expect(typeof first!.url).toBe('string');
    expect(first!.url).toMatch(/^https?:\/\//);
    expect(typeof first!.name).toBe('string');
    expect(first!.name.length).toBeGreaterThan(0);

    console.log(
      `[pronote-demo] geolocation OK — ${instances.length} instances found near Paris; first: "${first!.name}" (${first!.url})`,
    );
  }, 20_000);

  // ----------------------------------------------------------
  // Step 2 — credentials login against the public demo server
  // ----------------------------------------------------------
  it('step 2 — loginCredentials() authenticates against the public demo', async () => {
    try {
      session = await loginWithCredentials({
        url: DEMO_URL,
        kind: DEMO_KIND,
        username: DEMO_USERNAME,
        password: DEMO_PASSWORD,
        deviceUuid: crypto.randomUUID(),
      });
    } catch (err) {
      console.error('[pronote-demo] Demo login FAILED — integration NOT verified:', err);
      throw err;
    }

    expect(typeof session.token).toBe('string');
    expect(session.token.length).toBeGreaterThan(0);
    expect(typeof session.username).toBe('string');
    expect(session.username.length).toBeGreaterThan(0);

    console.log(
      `[pronote-demo] Demo login OK — username="${session.username}", token length=${session.token.length}`,
    );
  }, 30_000);

  // ----------------------------------------------------------
  // Step 3 — read grades from the demo account (real data, no mocks)
  // ----------------------------------------------------------
  it('step 3 — getGrades() reads real data from the demo', async () => {
    // session is set by step 2; if step 2 failed, this test errors clearly
    if (!session) {
      throw new Error('[pronote-demo] No demo session — step 2 must pass before step 3');
    }

    let grades: Awaited<ReturnType<typeof pawnoteServerAdapter.getGrades>>;
    try {
      grades = await pawnoteServerAdapter.getGrades(session, 0);
    } catch (err) {
      console.error('[pronote-demo] getGrades FAILED — integration NOT verified:', err);
      throw err;
    }

    // An empty array is indistinguishable from a stub — it is a false positive.
    // NOTE: this opt-in test may fail during July–August school-holiday window
    // when the demo account has no grades. A loud seasonal failure is acceptable;
    // a silent green (empty array passing) is not.
    expect(Array.isArray(grades)).toBe(true);
    expect(grades.length).toBeGreaterThan(0);
    // Assert the first grade carries a real NormalizedGrade.subject field
    expect(grades[0]?.subject).toBeTruthy();
    console.log(
      `[pronote-demo] getGrades OK — ${grades.length} grade(s), first subject="${grades[0]?.subject}"`,
    );
  }, 30_000);
});
