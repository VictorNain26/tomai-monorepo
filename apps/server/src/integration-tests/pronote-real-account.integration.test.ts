/**
 * Pronote real-account de-risking test
 *
 * Proves two things the public demo CANNOT prove:
 *   (a) real reads against a school account (not the demo)
 *   (b) the loginToken rotation cycle — the core production path
 *
 * Requires PRONOTE_TEST_* env vars in apps/server/.env (gitignored).
 * Skips cleanly when any var is absent or the URL is still a placeholder
 * (CI, fresh clones) — so it is safe to commit.
 *
 * SECURITY: never logs passwords, full tokens, usernames, or raw response data.
 * Only logs counts, booleans, token lengths, and resource counts.
 */

import { describe, it, expect } from 'bun:test';
import { loginWithCredentials } from './helpers/pronote-credentials-login.js';
import {
  pawnoteServerAdapter,
  type AdapterSession,
} from '../services/pronote/pawnote-server.adapter.js';

// ============================================================
// Env var guard
// ============================================================

const PRONOTE_TEST_URL = process.env['PRONOTE_TEST_URL'] ?? '';
const PRONOTE_TEST_USERNAME = process.env['PRONOTE_TEST_USERNAME'] ?? '';
const PRONOTE_TEST_PASSWORD = process.env['PRONOTE_TEST_PASSWORD'] ?? '';
const PRONOTE_TEST_KIND = process.env['PRONOTE_TEST_KIND'] ?? '';

// A real URL, not the .env.example placeholder (which contains angle brackets).
const urlLooksReal =
  PRONOTE_TEST_URL.startsWith('https://') && !PRONOTE_TEST_URL.includes('<');

const envsPresent =
  urlLooksReal &&
  PRONOTE_TEST_USERNAME.length > 0 &&
  PRONOTE_TEST_PASSWORD.length > 0 &&
  PRONOTE_TEST_KIND.length > 0;

if (!envsPresent) {
  console.warn(
    '[pronote-real-account] Set real PRONOTE_TEST_* values in apps/server/.env (a real https://...index-education.net/pronote/ URL) to run the real-account test.',
  );
}

const TODAY_ISO = new Date().toISOString().slice(0, 10);

// ============================================================
// Suite — skips entirely when env vars are absent
// ============================================================

describe.skipIf(!envsPresent)('Pronote real-account de-risk (zero mocks, real network)', () => {
  let session: AdapterSession;

  // Step 1 — credentials login
  it('step 1 — credentials login returns a non-empty token', async () => {
    session = await loginWithCredentials({
      url: PRONOTE_TEST_URL,
      kind: Number(PRONOTE_TEST_KIND),
      username: PRONOTE_TEST_USERNAME,
      password: PRONOTE_TEST_PASSWORD,
      deviceUuid: 'tom-e2e-real',
    });

    expect(typeof session.token).toBe('string');
    expect(session.token.length).toBeGreaterThan(0);

    const resourceCount = session.handle.user.resources?.length ?? 0;
    console.log(`[pronote-real-account] login OK — token length: ${session.token.length}, resources: ${resourceCount}`);
  }, 60_000);

  // Step 2 — real reads
  it('step 2a — getGrades returns an array', async () => {
    const grades = await pawnoteServerAdapter.getGrades(session, 0);
    expect(Array.isArray(grades)).toBe(true);
    console.log(`[pronote-real-account] getGrades: ${grades.length} item(s)`);
  }, 30_000);

  it('step 2b — getHomework returns an array', async () => {
    const homework = await pawnoteServerAdapter.getHomework(session, 0);
    expect(Array.isArray(homework)).toBe(true);
    console.log(`[pronote-real-account] getHomework: ${homework.length} item(s)`);
  }, 30_000);

  it('step 2c — getTimetable returns an array for today', async () => {
    const lessons = await pawnoteServerAdapter.getTimetable(session, 0, TODAY_ISO);
    expect(Array.isArray(lessons)).toBe(true);
    console.log(`[pronote-real-account] getTimetable(${TODAY_ISO}): ${lessons.length} lesson(s)`);
  }, 30_000);

  // Step 3 — loginToken rotation cycle (THE key de-risk)
  it('step 3 — loginToken rotation cycle: connect() with rotated token then one read', async () => {
    // connect() calls pawnote loginToken internally
    const rotatedSession = await pawnoteServerAdapter.connect({
      url: PRONOTE_TEST_URL,
      kind: Number(PRONOTE_TEST_KIND),
      username: session.username,
      token: session.token,
      deviceUuid: 'tom-e2e-real',
    });

    expect(typeof rotatedSession.token).toBe('string');
    expect(rotatedSession.token.length).toBeGreaterThan(0);
    console.log(`[pronote-real-account] loginToken OK — rotated token length: ${rotatedSession.token.length}`);

    // One read on the new session confirms it's live
    const grades = await pawnoteServerAdapter.getGrades(rotatedSession, 0);
    expect(Array.isArray(grades)).toBe(true);
    console.log(`[pronote-real-account] post-rotation getGrades: ${grades.length} item(s) — cycle PROVEN`);
  }, 60_000);
});
