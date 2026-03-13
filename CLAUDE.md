# Monorepo Tom

## Commandes

```bash
pnpm install                      # Installation
pnpm dev                          # Landing:3001 + Server:3000
pnpm dev:mobile                   # Expo mobile (8081)
pnpm typecheck && pnpm lint       # Validation (obligatoire avant commit)
pnpm build                        # Build production
```

Backend necessite Docker : `cd apps/server && docker compose up -d`

## Stack

@apps/server/CLAUDE.md pour le detail backend.

| Couche | Technologies |
|--------|-------------|
| Backend | Bun, Elysia.js 1.4, PostgreSQL 16 pgvector, Drizzle ORM |
| Landing | Next.js 16, TailwindCSS 4, Framer Motion |
| Mobile | Expo SDK 55, React Native 0.83, NativeWind, React Native Reusables |
| Auth | Better Auth + Google OAuth |
| AI | Gemini 2.5 Flash (chat), Mistral (embeddings), Gladia (STT), ElevenLabs (TTS) |
| Monorepo | Turborepo, pnpm workspaces |
| Deploy | Vercel (landing), Koyeb (server), EAS (mobile) |

## Git workflow

- **`staging`** : travail quotidien, push direct OK
- **`main`** : production, JAMAIS de push direct, toujours PR depuis staging
- **Merge commit uniquement** : JAMAIS squash merge (desynchronise les branches)

## Enforcement

Le workflow (TDD, review, validation) est geré par **superpowers skills** (auto-invoqués). Les conventions monorepo sont dans @.claude/rules/testing-and-commits.md et @.claude/rules/database-migrations.md.

Garde-fous déterministes :
- **Stop hook** (exit 2) : force validation + commit avant de quitter
- **PreToolUse hook** : bloque commandes destructives (`rm -rf /`, `DROP DATABASE`, `db:push` en prod)
- **Permission deny** : interdit la lecture de `.env` et secrets
- **lefthook** : lint + typecheck (pre-commit), tests + build (pre-push)

## Review IA

- PR staging→main : CodeRabbit Free (automatique)
- `/review` localement avant push
