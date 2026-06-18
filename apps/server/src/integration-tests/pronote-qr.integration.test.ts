/**
 * Integration test — Pronote QR connect (gated)
 *
 * Requires real environment variables:
 *   PRONOTE_TEST_QR   — JSON string {jeton, login, url}
 *   PRONOTE_TEST_QR_PIN — 4-digit PIN string
 *
 * Skipped automatically when these vars are absent.
 * Never logs QR payload, PIN, or tokens — only counters and host.
 */

import { describe, it, expect } from 'bun:test';
import { pronoteConnectService } from '../services/pronote/pronote-connect.service';

const rawQr = process.env['PRONOTE_TEST_QR'];
const rawPin = process.env['PRONOTE_TEST_QR_PIN'];

const hasQrEnv = typeof rawQr === 'string' && rawQr.length > 0 && typeof rawPin === 'string';

describe.skipIf(!hasQrEnv)('Pronote QR connect (integration)', () => {
  it('connects via QR payload, persists credentials, returns ≥1 resource', async () => {
    const qr = JSON.parse(rawQr!) as { jeton: string; login: string; url: string };
    const pin = rawPin!;

    const result = await pronoteConnectService.connectQr('integration-test-user', {
      qr,
      pin,
    });

    const host = new URL(qr.url).hostname;
    console.info('[pronote-qr integration]', {
      host,
      credentialId: result.credentialId,
      resourceCount: result.resources.length,
    });

    expect(typeof result.credentialId).toBe('string');
    expect(result.credentialId.length).toBeGreaterThan(0);
    expect(result.resources.length).toBeGreaterThanOrEqual(1);

    // Each resource must have the required shape
    for (const resource of result.resources) {
      expect(typeof resource.resourceId).toBe('number');
      expect(typeof resource.name).toBe('string');
      expect(resource.name.length).toBeGreaterThan(0);
      expect(typeof resource.establishmentName).toBe('string');
    }
  });
});
