---
name: verify
description: Use when about to claim a change works — proves it by actually driving the real surface (running server/app, hitting real endpoints, real device/bundle), not just green tests. Use before saying "done", "fixed", or "should work".
---

# Verify

Tests passing is not proof a feature works end to end. This skill drives the
real surface — server, landing, scripts — and pastes the actual
output as evidence. Never write "should work", "this should fix it", or
report success without having run the commands below and read their output.

## Rule

Proof = a real command you ran, with its real pasted output (exit code,
curl body, log lines). If you have not run it in this session, you have not
verified it — say so explicitly instead of asserting success.

## Server (apps/server)

```bash
docker compose up -d postgres
cd apps/server && bun run dev &   # host, :3000 — NOT the `backend` compose profile
curl -sS http://localhost:3000/health | python3 -m json.tool
```

Assert the top-level `status` field is `"healthy"`; `"unhealthy"` (HTTP 503)
is a failure, full stop. `/health` only probes the database: it proves nothing
about Mistral. For an AI change, also hit `/health/ai` (503 when
`MISTRAL_API_KEY` is absent or the call fails).

Then run the strict end-to-end doctor from the repo root — it fails loud
(no SKIP silently accepted) on every real dependency:

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

## Scripts (root `scripts/*.mjs`)

```bash
pnpm run test:scripts
```

(Node test runner over `scripts/*.test.mjs` — covers `doctor-checks.mjs` and the
`.claude/hooks` scripts; `dev.mjs`/`doctor.mjs`/`setup.mjs` have no dedicated
tests — their proof is the real execution paths above.)

## Before writing down a command

If a command in this skill turns out stale (script renamed, port changed,
route moved), verify against the actual repo (`package.json` scripts,
`docker-compose.yml`, the route file) before using or documenting it — do not
guess from memory of what it used to be.
