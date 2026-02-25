# Tom Monorepo

Plateforme de tutorat IA adaptatif pour eleves francais (CP-Terminale). Pedagogie socratique, programmes Eduscol, integration Pronote.

## Quick Start

```bash
# 1. Installation
pnpm install

# 2. Backend (Docker requis pour PostgreSQL)
cd apps/server && docker compose up -d && cd ../..

# 3. Developpement
pnpm dev
# → Landing: http://localhost:3001
# → Server: http://localhost:3000
# → API docs: http://localhost:3000/swagger (dev only)

# Mobile (separement)
pnpm dev:mobile
```

## Prerequisites

- **pnpm** 10.28+
- **Node.js** 22+ (via Bun 1.3 pour le server)
- **Docker** (PostgreSQL 16 + pgvector)

## Structure

```
apps/
├── landing/       # Next.js 16 - Site vitrine SEO (port 3001)
├── server/        # Bun + Elysia.js - Backend API (port 3000)
└── mobile/        # Expo SDK 54 - App iOS/Android (port 8081)

packages/
├── api/           # @repo/api - Client Eden Treaty + TanStack Query
├── shared-types/  # @repo/shared-types - Types partages
└── eslint-config/ # @repo/eslint-config - Configs ESLint
```

## Commands

```bash
# Dev
pnpm dev                # Landing + Server
pnpm dev:landing        # Landing seul
pnpm dev:server         # Server seul
pnpm dev:mobile         # Expo mobile

# Validation
pnpm typecheck          # TypeScript strict
pnpm lint               # ESLint zero warnings
pnpm validate           # typecheck + lint

# Build
pnpm build              # Production (toutes apps)

# Database
pnpm db:push            # Dev: sync schema → DB
pnpm db:generate        # Prod: generer migration SQL
pnpm db:studio          # Drizzle Studio UI
```

## Stack

| Couche | Technologies |
|--------|-------------|
| Monorepo | Turborepo 2.7, pnpm 10.28, TypeScript 5.9 strict |
| Backend | Bun 1.3, Elysia.js 1.4, PostgreSQL 16 pgvector, Drizzle ORM |
| Landing | Next.js 16, TailwindCSS 4, Framer Motion |
| Mobile | Expo SDK 54, React Native 0.81, NativeWind, React Native Reusables |
| Auth | Better Auth + Google OAuth |
| AI | Gemini 2.5 Flash (chat), Mistral (embeddings 1024D), Qdrant Cloud (RAG) |
| Voix | Gladia (STT), ElevenLabs (TTS) |
| Paiements | Stripe (web) + RevenueCat (mobile IAP) |
| Stockage | Scaleway Object Storage (RGPD France, fr-par) |

## Git Workflow

```
staging (push direct OK, CI auto)
    └──► PR (merge commit) ──► main (production)
```

- JAMAIS de push direct sur `main`
- JAMAIS de squash merge (desynchronise les branches)

## CI/CD

| Workflow | Actions |
|----------|---------|
| `ci.yml` | typecheck, lint, test, build, migration sync |
| `security.yml` | Detection secrets (gitleaks) |
| `auto-merge.yml` | Auto-merge Dependabot patch/minor |

| App | Plateforme | Deploiement |
|-----|-----------|-------------|
| Landing | Vercel | Auto sur push |
| Server | Koyeb | Auto sur push main |
| Mobile | EAS Build | Workflows manuels |

## Documentation

- [apps/server/README.md](./apps/server/README.md) - Backend API
- [apps/landing/README.md](./apps/landing/README.md) - Landing page
- [apps/mobile/README.md](./apps/mobile/README.md) - App mobile Expo
- [docs/AGENT-IA-ROADMAP.md](./docs/AGENT-IA-ROADMAP.md) - Roadmap agent IA
