#!/usr/bin/env node
// Orchestration dev : infra Docker (détaché) -> attente des services critiques
// healthy -> apps host (Turbo, mobile exclu). Le backend tourne sur l'host (turbo),
// pas en conteneur : pas de clash :3000.
import { spawnSync, spawn } from "node:child_process";

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: "inherit" });
  if (r.status !== 0) {
    console.error(`\n[dev] échec: ${cmd} ${args.join(" ")}`);
    process.exit(r.status ?? 1);
  }
}

console.log("[dev] démarrage de l'infra (postgres, qdrant, ai-service)…");
run("docker", ["compose", "up", "-d"]);

console.log("[dev] attente postgres + qdrant (healthy)…");
run("docker", ["compose", "up", "-d", "--wait", "--wait-timeout", "120", "postgres", "qdrant"]);

console.log("[dev] ai-service chauffe en arrière-plan ; lancement des apps (server, web, landing)…");
const turbo = spawn("pnpm", ["exec", "turbo", "run", "dev", "--filter=!tom-mobile"], {
  stdio: "inherit",
});
turbo.on("exit", (code) => process.exit(code ?? 0));
