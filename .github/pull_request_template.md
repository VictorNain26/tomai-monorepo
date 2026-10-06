## What

<!-- Brief description of the changes -->

## Why

<!-- Motivation and context -->

## How to test

<!-- Steps to verify the changes work -->

## Checklist

- [ ] `bun run typecheck && bun run lint` passes locally (+ `bun run test` if tested code changed; the server's tests need the docker compose Postgres)
- [ ] No secrets committed (`git diff --cached`)
- [ ] Migrations generated if schema changed (`cd apps/server && bun run db:generate`)
