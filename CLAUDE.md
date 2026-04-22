# Monorepo Tom

## Commandes

```bash
pnpm install                      # Installation
pnpm dev                          # Landing:3001 + Server:3000
pnpm dev:mobile                   # Expo mobile (8081)
pnpm typecheck && pnpm lint       # Validation (obligatoire avant commit)
pnpm build                        # Build production
```

Backend nécessite Docker : `cd apps/server && docker compose up -d`

## Stack

@apps/server/CLAUDE.md pour le détail backend. @apps/mobile/CLAUDE.md pour le mobile.

| Couche | Technologies |
|--------|-------------|
| Backend | Bun 1.3, Elysia.js 1.4, PostgreSQL 16 pgvector, Drizzle ORM |
| Landing | Next.js 16, TailwindCSS 4, Framer Motion |
| Mobile | Expo SDK 55, React Native 0.83, React 19.2, NativeWind v5, React Native Reusables |
| Auth | Better Auth 1.5 + Google OAuth + account linking |
| AI | Gemini 2.5 Flash (chat), Mistral (embeddings 1024D), Gladia (STT), ElevenLabs (TTS) |
| Monorepo | Turborepo, pnpm workspaces, package `@repo/api` (Eden Treaty types) |
| Deploy | Vercel (landing), Koyeb (server), EAS (mobile) |
| Observabilité | Sentry (crash/perf), PostHog (analytics + flags + session replay) — en cours d'install |

## Git workflow

- **`staging`** : travail quotidien, push direct OK
- **`main`** : production, JAMAIS de push direct, toujours PR depuis staging
- **Merge commit uniquement** : JAMAIS squash merge (désynchronise les branches)

## Enforcement

Le workflow (TDD, review, validation) est géré par **superpowers skills** (auto-invoqués). Les conventions monorepo sont dans @.claude/rules/testing-and-commits.md et @.claude/rules/database-migrations.md.

Garde-fous déterministes :
- **Stop hook** (exit 2) : force validation + commit avant de quitter
- **PreToolUse hook** : bloque commandes destructives (`rm -rf /`, `DROP DATABASE`, `db:push` en prod)
- **Permission deny** : interdit la lecture de `.env` et secrets
- **lefthook** : lint + typecheck (pre-commit), tests + build (pre-push)

## Review IA

- PR staging→main : CodeRabbit Free (automatique)
- `/review` localement avant push
- E2E Maestro en preview Android (signal, pas gate)
