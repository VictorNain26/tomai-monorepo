#!/usr/bin/env node
// pnpm e2e:local — strict-proof → seed → Maestro on local backend
// Aborts with non-zero exit if any stage fails (no silent fallback).
import { spawnSync } from 'node:child_process';

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (result.error) {
    console.error(`[e2e:local] failed to spawn ${cmd}: ${result.error.message}`);
    return 1;
  }
  return result.status ?? 1;
}

// Stage 1/3 — strict-proof every real dependency
console.log('\n[e2e:local] 1/3 — strict-proof (doctor:e2e)…');
const doctorCode = run('pnpm', ['doctor:e2e']);
if (doctorCode !== 0) {
  console.error('[e2e:local] ABORT — doctor:e2e failed. Fix the stack before running e2e.');
  process.exit(doctorCode);
}

// Stage 2/3 — seed the local DB with e2e fixtures
console.log('\n[e2e:local] 2/3 — seed…');
const seedCode = run('pnpm', ['seed']);
if (seedCode !== 0) {
  console.error('[e2e:local] ABORT — seed failed. Check DB connection and migrations.');
  process.exit(seedCode);
}

// Stage 3/3 — run Maestro with seeded credentials injected as env vars
const seedEnv = {
  E2E_STUDENT_USERNAME: process.env.SEED_CHILD_USERNAME ?? 'dev.eleve',
  E2E_STUDENT_PASSWORD: process.env.SEED_CHILD_PASSWORD ?? 'DevEleve123!',
  E2E_PARENT_EMAIL: process.env.SEED_PARENT_EMAIL ?? 'dev.parent@tomai.local',
  E2E_PARENT_PASSWORD: process.env.SEED_PARENT_PASSWORD ?? 'DevParent123!',
};

console.log('\n[e2e:local] 3/3 — Maestro…');
const maestroCode = run('maestro', ['test', 'apps/mobile/e2e/'], {
  env: { ...process.env, ...seedEnv },
});
if (maestroCode !== 0) {
  console.error('[e2e:local] ABORT — Maestro run failed.');
  process.exit(maestroCode);
}

console.log('\n[e2e:local] OK — all stages passed.');
