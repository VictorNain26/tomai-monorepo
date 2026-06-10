#!/usr/bin/env node
// Bootstrap one-time idempotent du dev local :
// .env depuis .env.example, génération du secret, postgres + extension vector +
// migrations, préchauffe des modèles ai-service. Relançable sans effet de bord.
import { spawnSync } from "node:child_process";
import { existsSync, copyFileSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, { stdio: "inherit", ...opts });
  if (r.status !== 0) {
    console.error(`[setup] échec: ${cmd} ${args.join(" ")}`);
    process.exit(r.status ?? 1);
  }
}

// 1. .env depuis .env.example (idempotent)
for (const app of ["apps/server", "apps/curriculum"]) {
  const env = `${app}/.env`;
  const example = `${app}/.env.example`;
  if (!existsSync(env) && existsSync(example)) {
    copyFileSync(example, env);
    console.log(`[setup] créé ${env} depuis .env.example`);
  }
}

// 2. BETTER_AUTH_SECRET dans apps/server/.env (génère si absent/placeholder vide)
const serverEnvPath = "apps/server/.env";
if (existsSync(serverEnvPath)) {
  let content = readFileSync(serverEnvPath, "utf8");
  const isEmpty = /^BETTER_AUTH_SECRET=\s*$/m.test(content);
  const isMissing = !/^BETTER_AUTH_SECRET=/m.test(content);
  if (isEmpty || isMissing) {
    const secret = randomBytes(32).toString("base64");
    content = isMissing
      ? `${content}\nBETTER_AUTH_SECRET=${secret}\n`
      : content.replace(/^BETTER_AUTH_SECRET=.*$/m, `BETTER_AUTH_SECRET=${secret}`);
    writeFileSync(serverEnvPath, content);
    console.log("[setup] BETTER_AUTH_SECRET généré");
  }
}

// 3. Postgres up + extension vector + migrations
console.log("[setup] postgres…");
run("docker", ["compose", "up", "-d", "--wait", "--wait-timeout", "60", "postgres"]);
run("docker", ["exec", "tomai-postgres-dev", "psql", "-U", "tomai_dev", "-d", "tomai_dev",
  "-c", "CREATE EXTENSION IF NOT EXISTS vector;"]);
console.log("[setup] migrations Drizzle…");
run("bun", ["run", "db:migrate"], { cwd: "apps/server" });

// 4. Préchauffe ai-service (download ~3,5 Go la première fois)
console.log("[setup] préchauffe ai-service (download des modèles, plusieurs minutes au 1er run)…");
run("docker", ["compose", "up", "-d", "--wait", "--wait-timeout", "600", "ai-service"]);

console.log("\n[setup] terminé. Lance `pnpm dev`.");
