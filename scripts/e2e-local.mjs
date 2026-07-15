#!/usr/bin/env node
// pnpm e2e:local — strict-proof → seed → Maestro on local backend
// Aborts with non-zero exit if any stage fails (no silent fallback).
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runChecks, defaultExec as sharedDefaultExec } from './doctor-checks.mjs';

// android.package réel — apps/mobile/app.config.ts:42 (ne pas deviner).
const ANDROID_PACKAGE = 'fr.tomia.mobile';

/**
 * Stage 0/4 — préconditions device explicites (pas de silent assumption) :
 * un device/émulateur connecté, l'app dev-client installée, Metro joignable.
 * exec injectable — voir scripts/e2e-local.test.mjs pour les tests sans device réel.
 */
export function buildDevicePreconditions({ exec = sharedDefaultExec } = {}) {
  return [
    {
      name: 'device/émulateur adb connecté',
      run: async () => {
        const r = exec('adb', ['devices']);
        if (!r.ok) {
          throw new Error(
            'commande adb introuvable ou en échec — vérifie que les Android platform-tools sont sur le PATH',
          );
        }
        if (!/^\S+\tdevice$/m.test(r.stdout)) {
          throw new Error(
            'aucun device en état "device" — lance l\'émulateur ou branche un téléphone (adb devices)',
          );
        }
      },
    },
    {
      name: `app dev-client installée (${ANDROID_PACKAGE})`,
      run: async () => {
        const r = exec('adb', ['shell', 'pm', 'list', 'packages', ANDROID_PACKAGE]);
        if (!r.ok || !r.stdout.includes(ANDROID_PACKAGE)) {
          throw new Error(
            `app absente du device — build/installe le dev client : cd apps/mobile && pnpm build:dev`,
          );
        }
      },
    },
    {
      name: 'Metro joignable sur :8081',
      run: async () => {
        const r = exec('curl', ['-sf', '--max-time', '3', '-o', '/dev/null', 'http://localhost:8081/status']);
        if (!r.ok) {
          throw new Error('Metro injoignable sur http://localhost:8081/status — lance `pnpm dev:mobile`');
        }
      },
    },
  ];
}

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (result.error) {
    console.error(`[e2e:local] failed to spawn ${cmd}: ${result.error.message}`);
    return 1;
  }
  return result.status ?? 1;
}

async function main() {
  // Stage 0/4 — préconditions device/app/Metro
  console.log('\n[e2e:local] 0/4 — préconditions device…');
  const preconditionsSummary = await runChecks(buildDevicePreconditions());
  if (preconditionsSummary.exitCode !== 0) {
    console.error('[e2e:local] ABORT — préconditions device non satisfaites. Corrige avant de relancer.');
    process.exit(preconditionsSummary.exitCode);
  }

  // Stage 1/4 — strict-proof every real dependency
  console.log('\n[e2e:local] 1/4 — strict-proof (doctor:e2e)…');
  const doctorCode = run('pnpm', ['doctor:e2e']);
  if (doctorCode !== 0) {
    console.error('[e2e:local] ABORT — doctor:e2e failed. Fix the stack before running e2e.');
    process.exit(doctorCode);
  }

  // Stage 2/4 — seed the local DB with e2e fixtures
  console.log('\n[e2e:local] 2/4 — seed…');
  const seedCode = run('pnpm', ['seed']);
  if (seedCode !== 0) {
    console.error('[e2e:local] ABORT — seed failed. Check DB connection and migrations.');
    process.exit(seedCode);
  }

  // Stage 3/4 — run Maestro with seeded credentials injected as env vars
  const seedEnv = {
    E2E_STUDENT_USERNAME: process.env.SEED_CHILD_USERNAME ?? 'dev.eleve',
    E2E_STUDENT_PASSWORD: process.env.SEED_CHILD_PASSWORD ?? 'DevEleve123!',
    E2E_PARENT_EMAIL: process.env.SEED_PARENT_EMAIL ?? 'dev.parent@tomai.local',
    E2E_PARENT_PASSWORD: process.env.SEED_PARENT_PASSWORD ?? 'DevParent123!',
  };

  console.log('\n[e2e:local] 3/4 — Maestro…');
  const maestroCode = run('maestro', ['test', 'apps/mobile/e2e/'], {
    env: { ...process.env, ...seedEnv },
  });
  if (maestroCode !== 0) {
    console.error('[e2e:local] ABORT — Maestro run failed.');
    process.exit(maestroCode);
  }

  console.log('\n[e2e:local] OK — all stages passed.');
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  await main();
}
