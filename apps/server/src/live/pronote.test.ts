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
 * Only logs counts, booleans, token lengths, the account `kind`, and URL host.
 */

import { describe, it, expect, beforeAll } from 'bun:test';
import { loginWithCredentials } from '../integration-tests/helpers/pronote-credentials-login.js';
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
// pawnote/Papillon use a real UUID v4 as the device identifier, not a literal
// string. Keep one stable UUID for the whole run (login + token rotation).
const DEVICE_UUID = crypto.randomUUID();

function urlHost(raw: string): string {
  try {
    return new URL(raw).host;
  } catch {
    return '(invalid url)';
  }
}

// ============================================================
// Suite — skips entirely when env vars are absent
// ============================================================

describe.skipIf(!envsPresent)('Pronote real-account de-risk (zero mocks, real network)', () => {
  let session: AdapterSession;

  // Login once for the whole suite. A failure here aborts the suite with a
  // clear diagnostic instead of cascading TypeErrors through the read steps.
  beforeAll(async () => {
    const kind = Number(PRONOTE_TEST_KIND);
    // Diagnostic (no secrets): the account kind is not a secret, and the host
    // identifies the school instance — both are needed to debug auth failures.
    console.log(
      `[pronote-real-account] login attempt — kind=${kind} (expected 6=student, 7=parent, 8=teacher), host=${urlHost(PRONOTE_TEST_URL)}, username length=${PRONOTE_TEST_USERNAME.length}`,
    );
    try {
      session = await loginWithCredentials({
        url: PRONOTE_TEST_URL,
        kind,
        username: PRONOTE_TEST_USERNAME,
        password: PRONOTE_TEST_PASSWORD,
        deviceUuid: DEVICE_UUID,
      });
    } catch (error) {
      const name = error instanceof Error ? error.name : String(error);
      console.error(
        `[pronote-real-account] LOGIN FAILED: ${name}.\n` +
          'If BadCredentialsError, check in this order:\n' +
          '  1. PRONOTE_TEST_KIND matches the account type (6=student, 7=parent, 8=teacher)\n' +
          '  2. PRONOTE_TEST_URL is the instance URL, e.g. https://XXXXXXXX.index-education.net/pronote\n' +
          '  3. If 1 & 2 are correct, the school is likely ENT/EduConnect-only — direct credentials\n' +
          '     login is not supported by pawnote (the WebView channel is required for ENT schools).',
      );
      throw error;
    }
    console.log(
      `[pronote-real-account] login OK — token length: ${session.token.length}, resources: ${session.handle.user.resources?.length ?? 0}`,
    );
  }, 60_000);

  it('step 1 — credentials login produced a non-empty token', () => {
    expect(typeof session.token).toBe('string');
    expect(session.token.length).toBeGreaterThan(0);
  });

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

  // THE key de-risk: connect() calls pawnote loginToken internally with the
  // rotated token — the production read path the demo account cannot exercise.
  it('step 3 — loginToken rotation cycle: connect() with rotated token then one read', async () => {
    const rotatedSession = await pawnoteServerAdapter.connect({
      url: PRONOTE_TEST_URL,
      kind: Number(PRONOTE_TEST_KIND),
      username: session.username,
      token: session.token,
      deviceUuid: DEVICE_UUID,
    });

    expect(typeof rotatedSession.token).toBe('string');
    expect(rotatedSession.token.length).toBeGreaterThan(0);
    console.log(`[pronote-real-account] loginToken OK — rotated token length: ${rotatedSession.token.length}`);

    const grades = await pawnoteServerAdapter.getGrades(rotatedSession, 0);
    expect(Array.isArray(grades)).toBe(true);
    console.log(`[pronote-real-account] post-rotation getGrades: ${grades.length} item(s) — cycle PROVEN`);
  }, 60_000);
});
