---
name: verify
description: Use when about to claim a change works — proves it by actually driving the real surface (running server/app, hitting real endpoints, real device/bundle), not just green tests. Use before saying "done", "fixed", or "should work".
---

# Verify

Tests passing is not proof a feature works end to end. This skill drives the
real surface — server, landing, mobile, scripts — and pastes the actual
output as evidence. Never write "should work", "this should fix it", or
report success without having run the commands below and read their output.

## Rule

Proof = a real command you ran, with its real pasted output (exit code,
curl body, log lines). If you have not run it in this session, you have not
verified it — say so explicitly instead of asserting success.

## Server (apps/server)

```bash
docker compose up -d postgres qdrant ai-service
cd apps/server && bun run dev &   # host, :3000 — NOT the `backend` compose profile
curl -sS http://localhost:3000/health | python3 -m json.tool
```

Assert the top-level `status` field is `"healthy"` (or `"degraded"` only if
you can explain which optional dependency is intentionally unconfigured —
e.g. `MISTRAL_API_KEY` absent in a minimal local `.env`). `"unhealthy"` is a
failure, full stop.

Then run the strict end-to-end doctor from the repo root — it fails loud
(no SKIP/degraded silently accepted) on every real dependency:

```bash
pnpm doctor:e2e
```

## Landing (apps/landing)

```bash
pnpm turbo build --filter=landing
pnpm --filter landing dev &
curl -sS -o /dev/null -w '%{http_code}\n' http://localhost:3001
```

Assert `200`.

## Mobile (apps/mobile)

```bash
pnpm --filter tom-mobile bundle:check
```

This is the Metro bundle-export CI uses to catch bundling/import errors
without a device. For anything that needs a real screen (navigation, gesture,
native module), there is no substitute for a device: point the user at
`pnpm e2e:local` (root script, Maestro flows against the Android emulator/dev
client) rather than claiming visual/interaction behavior works from a bundle
check alone.

## Scripts (root `scripts/*.mjs`)

```bash
pnpm run test:scripts
```

(Bun/Node test runner over `scripts/*.test.mjs` — `dev.mjs`, `doctor.mjs`,
`doctor-checks.mjs`, `e2e-local.mjs`, `setup.mjs`.)

## Before writing down a command

If a command in this skill turns out stale (script renamed, port changed,
route moved), verify against the actual repo (`package.json` scripts,
`docker-compose.yml`, the route file) before using or documenting it — do not
guess from memory of what it used to be.
