# Monorepo Tom

## Commandes

```bash
pnpm install                      # Installation
pnpm dev                          # Landing:3001 + Web:3002 + Server:3000
pnpm dev:web                      # Web app seule (3002)
pnpm dev:mobile                   # Expo mobile (8081)
pnpm typecheck && pnpm lint       # Validation (obligatoire avant commit)
pnpm build                        # Build production
pnpm seed                         # Seed DB : comptes parent + élève (dev-only)
pnpm doctor:e2e                   # Diagnostic strict : chaque dépendance réelle doit répondre (SKIP/degraded = échec)
```

Backend nécessite Docker : `cd apps/server && docker compose up -d`

## Stack

Détail par app (chargé à la demande via walk-up quand tu travailles dedans) : `apps/server/CLAUDE.md` (backend), `apps/mobile/CLAUDE.md` (mobile), `apps/web/CLAUDE.md` (web), `apps/ai-service/README.md` (service Python RAG), `apps/curriculum/CLAUDE.md` (indexation RAG des programmes officiels — app Python `uv` autonome, hors workspace pnpm/turbo).

| Couche | Technologies |
|--------|-------------|
| Backend | Bun 1.3, Elysia.js 1.4, PostgreSQL 16 pgvector, Drizzle ORM |
| AI service | Python FastAPI (uv) — embeddings BGE-M3 dense+sparse pour le RAG |
| Landing | Next.js 16, TailwindCSS 4, Framer Motion — vitrine marketing/SEO |
| Web | Next.js 16, TailwindCSS 4, shadcn/ui — produit web role-aware (parents/élèves/établissement) |
| Mobile | Expo SDK 56, React Native 0.85, React 19.2, NativeWind v5, React Native Reusables |
| Auth | Better Auth 1.6 + Google OAuth + account linking |
| AI | Mistral (chat `medium-latest`, embeddings 1024D, vision Pixtral, OCR, TTS Voxtral), Gladia (STT) — stack 100 % EU |
| RAG | Qdrant Cloud + BGE-M3 hybrid (via `apps/ai-service`) |
| Monorepo | Turborepo, pnpm workspaces, `@repo/api` (Eden Treaty types), `@repo/tokens` (design system partagé Tailwind v4) |
| Deploy | Vercel (landing + web), Koyeb (server + ai-service), EAS (mobile) |
| Observabilité | Sentry (crash/perf), PostHog (analytics + flags + session replay) — en cours d'install |

## Git workflow

- **`main`** : seule branche permanente. JAMAIS de push direct — branche de travail courte → PR vers `main`
- **Merge commit uniquement** : JAMAIS squash merge

## Enforcement

Le workflow (TDD, review, validation) est géré par **superpowers skills** (auto-invoqués). Les conventions monorepo vivent dans `.claude/rules/` — chargées automatiquement par Claude Code (pas besoin de les importer).

Garde-fous déterministes :
- **Stop hook** (exit 2) : force validation + commit avant de quitter
- **PreToolUse hook** : bloque commandes destructives (`rm -rf /`, `DROP DATABASE`, `db:push` en prod)
- **Permission deny** : interdit la lecture de `.env` et secrets
- **lefthook** : lint + typecheck (pre-commit), tests + build (pre-push)

## Review IA

- PR vers main : CodeRabbit Free (automatique)
- `/review` localement avant push
- E2E Maestro en preview Android sur PR (signal, pas gate)
