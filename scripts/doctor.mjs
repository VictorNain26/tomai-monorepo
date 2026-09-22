#!/usr/bin/env node
// pnpm doctor — preuve end-to-end de l'environnement de dev. Exit 0 si tout PASS, 1 sinon.
// pnpm doctor:e2e (--e2e) — mode strict : SKIP = FAIL, ajoute le check MISTRAL_API_KEY.
import { loadConfig, defaultExec, buildChecks, runChecks } from './doctor-checks.mjs';

const e2e = process.argv.includes('--e2e');
const config = loadConfig();
const ctx = { config, exec: defaultExec, fetchFn: fetch };

const mode = e2e ? ' [mode e2e strict — SKIP = FAIL]' : '';
console.log(`[doctor] vérification de la stack de dev…${mode}\n`);
const summary = await runChecks(buildChecks(ctx, { full: true, e2e }), { strict: e2e });
if (summary.exitCode !== 0) {
  const hint = e2e
    ? '\n[doctor:e2e] des checks ont échoué. Lance `pnpm dev` et vérifie que toutes les dépendances sont up avant un run e2e.'
    : '\n[doctor] des checks ont échoué. Corrige-les avant de reprendre le dev (souvent : `pnpm run setup` puis `pnpm dev`).';
  console.error(hint);
}
process.exit(summary.exitCode);
