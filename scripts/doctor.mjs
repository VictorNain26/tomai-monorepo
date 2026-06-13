#!/usr/bin/env node
// pnpm doctor — preuve end-to-end de l'environnement de dev. Exit 0 si tout PASS, 1 sinon.
import { loadConfig, defaultExec, buildChecks, runChecks } from './doctor-checks.mjs';

const config = loadConfig();
const ctx = { config, exec: defaultExec, fetchFn: fetch };

console.log('[doctor] vérification de la stack de dev…\n');
const summary = await runChecks(buildChecks(ctx, { full: true }));
if (summary.exitCode !== 0) {
  console.error('\n[doctor] des checks ont échoué. Corrige-les avant de reprendre le dev (souvent : `pnpm setup` puis `pnpm dev`).');
}
process.exit(summary.exitCode);
