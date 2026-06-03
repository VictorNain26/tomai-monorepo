# Monorepo Tom

## Commandes

```bash
pnpm install                      # Installation
pnpm dev                          # Landing:3001 + Web:3002 + Server:3000
pnpm dev:web                      # Web app seule (3002)
pnpm dev:mobile                   # Expo mobile (8081)
pnpm typecheck && pnpm lint       # Validation (obligatoire avant commit)
pnpm build                        # Build production
```

Backend nécessite Docker : `cd apps/server && docker compose up -d`

## Stack

@apps/server/CLAUDE.md pour le détail backend. @apps/mobile/CLAUDE.md pour le mobile. @apps/web/CLAUDE.md pour le web.

| Couche | Technologies |
|--------|-------------|
| Backend | Bun 1.3, Elysia.js 1.4, PostgreSQL 16 pgvector, Drizzle ORM |
| Landing | Next.js 16, TailwindCSS 4, Framer Motion — vitrine marketing/SEO |
| Web | Next.js 16, TailwindCSS 4, shadcn/ui — produit web role-aware (parents/élèves/établissement) |
| Mobile | Expo SDK 56, React Native 0.85, React 19.2, NativeWind v5, React Native Reusables |
| Auth | Better Auth 1.6 + Google OAuth + account linking |
| AI | Mistral (chat `medium-latest`, embeddings 1024D, vision Pixtral, OCR, TTS Voxtral), Gladia (STT) — stack 100 % EU |
| Monorepo | Turborepo, pnpm workspaces, `@repo/api` (Eden Treaty types), `@repo/tokens` (design system partagé Tailwind v4) |
| Deploy | Vercel (landing + web), Koyeb (server), EAS (mobile) |
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
