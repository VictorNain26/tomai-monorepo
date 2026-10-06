#!/usr/bin/env bun
// Orchestration dev : infra Docker (détaché) -> attente des services critiques
// healthy -> apps host (Turbo). Le backend tourne sur l'host (turbo),
// pas en conteneur : pas de clash :3000.
import { spawnSync, spawn } from "node:child_process";
import { loadConfig, defaultExec, buildChecks, runChecks } from "./doctor-checks.mjs";

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: "inherit" });
  if (r.status !== 0) {
    console.error(`\n[dev] échec: ${cmd} ${args.join(" ")}`);
    process.exit(r.status ?? 1);
  }
}

console.log("[dev] démarrage de postgres, attente healthy…");
run("docker", ["compose", "up", "-d", "--wait", "--wait-timeout", "120", "postgres"]);

console.log("[dev] vérification infra (fail-fast) avant de lancer les apps…");
const ctx = { config: loadConfig(), exec: defaultExec, fetchFn: fetch };
const infra = await runChecks(buildChecks(ctx, { full: false }));
if (infra.exitCode !== 0) {
  console.error("[dev] infra incomplète — apps non lancées. Lance `bun run doctor` pour le détail, puis `bun run setup`/`docker compose up -d`.");
  process.exit(1);
}

console.log("[dev] lancement des apps (server, landing, web)…");
const turbo = spawn("bunx", ["--no-install", "turbo", "run", "dev"], {
  stdio: "inherit",
});
turbo.on("exit", (code) => process.exit(code ?? 0));
