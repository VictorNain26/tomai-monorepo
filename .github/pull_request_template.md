## What

<!-- Brief description of the changes -->

## Why

<!-- Motivation and context -->

## How to test

<!-- Steps to verify the changes work -->

## Checklist

- [ ] `pnpm typecheck && pnpm lint` passes locally
- [ ] No secrets committed (`git diff --cached`)
- [ ] Migrations generated if schema changed (`cd apps/server && bun run db:generate`)
- [ ] Tested on mobile if UI change
