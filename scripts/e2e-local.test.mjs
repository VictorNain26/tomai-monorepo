import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runChecks } from './doctor-checks.mjs';
import { buildDevicePreconditions } from './e2e-local.mjs';

function byName(checks, name) {
  return checks.find((c) => c.name.includes(name));
}

test('device adb: FAIL si adb introuvable/en échec', async () => {
  const checks = buildDevicePreconditions({ exec: () => ({ ok: false, stdout: '', stderr: '' }) });
  await assert.rejects(byName(checks, 'device/émulateur').run(), /adb introuvable ou en échec/);
});

test('device adb: FAIL si aucun device en état "device"', async () => {
  const checks = buildDevicePreconditions({
    exec: (cmd) => (cmd === 'adb' ? { ok: true, stdout: 'List of devices attached\n\n', stderr: '' } : { ok: true, stdout: '' }),
  });
  await assert.rejects(byName(checks, 'device/émulateur').run(), /aucun device en état "device"/);
});

test('device adb: PASS si un device est connecté', async () => {
  const checks = buildDevicePreconditions({
    exec: (cmd, args) => {
      if (cmd === 'adb' && args[0] === 'devices') return { ok: true, stdout: 'List of devices attached\nemulator-5554\tdevice\n', stderr: '' };
      return { ok: true, stdout: '' };
    },
  });
  await assert.doesNotReject(byName(checks, 'device/émulateur').run());
});

test('app dev-client: FAIL si le package est absent de pm list packages', async () => {
  const checks = buildDevicePreconditions({
    exec: (cmd, args) => {
      if (args?.includes('devices')) return { ok: true, stdout: 'List of devices attached\nemulator-5554\tdevice\n', stderr: '' };
      if (args?.includes('pm')) return { ok: true, stdout: '', stderr: '' };
      return { ok: true, stdout: '' };
    },
  });
  await assert.rejects(byName(checks, 'app dev-client').run(), /pnpm build:dev/);
});

test('app dev-client: PASS si le package apparaît dans pm list packages', async () => {
  const checks = buildDevicePreconditions({
    exec: (cmd, args) => {
      if (args?.includes('pm')) return { ok: true, stdout: 'package:fr.tomia.mobile\n', stderr: '' };
      return { ok: true, stdout: '' };
    },
  });
  await assert.doesNotReject(byName(checks, 'app dev-client').run());
});

test('Metro: FAIL si :8081/status injoignable', async () => {
  const checks = buildDevicePreconditions({ exec: () => ({ ok: false, stdout: '', stderr: '' }) });
  await assert.rejects(byName(checks, 'Metro').run(), /pnpm dev:mobile/);
});

test('Metro: PASS si :8081/status répond', async () => {
  const checks = buildDevicePreconditions({ exec: () => ({ ok: true, stdout: '', stderr: '' }) });
  await assert.doesNotReject(byName(checks, 'Metro').run());
});

test('runChecks: toutes les préconditions FAIL -> exitCode 1 (chemin ABORT stage 0)', async () => {
  const checks = buildDevicePreconditions({ exec: () => ({ ok: false, stdout: '', stderr: '' }) });
  const lines = [];
  const summary = await runChecks(checks, { log: (l) => lines.push(l) });
  assert.equal(summary.exitCode, 1);
  assert.ok(lines.some((l) => l.includes('FAIL') && l.includes('device/émulateur')));
});
