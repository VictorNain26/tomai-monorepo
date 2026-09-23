## What

<!-- Brief description of the changes -->

## Why

<!-- Motivation and context -->

## How to test

<!-- Steps to verify the changes work -->

## Checklist

- [ ] `pnpm typecheck && pnpm lint` passes locally (+ `pnpm test`, and `bun run test:integration` in `apps/server`, if the server changed)
- [ ] No secrets committed (`git diff --cached`)
- [ ] Migrations generated if schema changed (`cd apps/server && bun run db:generate`)
