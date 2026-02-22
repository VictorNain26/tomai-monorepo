# Tom Monorepo

**Plateforme de tutorat IA adaptatif** pour eleves francais du CP a la Terminale. Pedagogie socratique, programmes Eduscol, integration Pronote.

## Demarrage Rapide

```bash
# Installation
pnpm install

# Developpement (lance toutes les apps)
pnpm dev
# → Landing: http://localhost:3001
# → App: http://localhost:5173
# → Server: http://localhost:3000

# Mobile
pnpm dev:mobile

# Validation
pnpm validate
```

**Backend** : Docker requis pour PostgreSQL
```bash
cd apps/server && docker compose up -d
```

## Structure

```
tomai-monorepo/
├── apps/
│   ├── landing/       # Next.js 16 - Landing page SEO (port 3001)
│   ├── app/           # React 19 + Vite 7 - App tutorat (port 5173)
│   ├── server/        # Bun + Elysia.js - Backend API (port 3000)
│   └── mobile/        # Expo SDK 54 - App mobile (port 8081)
├── packages/
│   ├── api/           # @repo/api - Eden Treaty + TanStack Query
│   ├── shared-types/  # @repo/shared-types - Types partages
│   └── eslint-config/ # @repo/eslint-config - Configs ESLint
└── turbo.json         # Configuration Turborepo
```

## Apps

| App | Port | Tech | Description |
|-----|------|------|-------------|
| **landing** | 3001 | Next.js 16 | Site vitrine SEO |
| **app** | 5173 | React 19 + Vite 7 | Application de tutorat |
| **server** | 3000 | Bun + Elysia.js 1.4 | API backend |
| **mobile** | 8081 | Expo SDK 54 | Application mobile iOS/Android |

## Commandes

```bash
# Developpement
pnpm dev                # Toutes les apps (sauf mobile)
pnpm dev:landing        # Landing seulement
pnpm dev:app            # App seulement
pnpm dev:server         # Server seulement
pnpm dev:mobile         # Mobile Expo

# Validation
pnpm typecheck          # TypeScript strict
pnpm lint               # ESLint zero warnings
pnpm validate           # typecheck + lint

# Build
pnpm build              # Build production

# Database
pnpm db:push            # Dev: sync schema → DB locale
pnpm db:generate        # Prod: generer migration SQL
pnpm db:studio          # Interface Drizzle Studio
```

## Stack

| Couche | Technologies |
|--------|--------------|
| Monorepo | Turborepo 2.7, pnpm 10.28, TypeScript 5.9 strict |
| Backend | Bun 1.3, Elysia.js 1.4, PostgreSQL 16 + pgvector, Drizzle ORM |
| Frontend | React 19, Vite 7, TailwindCSS 4, shadcn/ui |
| Mobile | Expo SDK 54, React Native 0.81, NativeWind, React Native Reusables |
| Auth | Better Auth + Google OAuth |
| AI | Gemini 2.5 Flash (chat), Mistral (embeddings 1024D), Qdrant Cloud (RAG) |
| Voix | Gladia (STT), ElevenLabs (TTS) |
| Paiements | Stripe (web), RevenueCat (mobile IAP) |
| Stockage | Scaleway Object Storage (RGPD France) |

## Git Workflow

| Branche | Environnement | Deploiement |
|---------|---------------|-------------|
| `staging` | Preview/Dev | Vercel preview + Koyeb staging (auto) |
| `main` | Production | Vercel + Koyeb (auto) |

```
staging (push direct OK)
    └──► PR (merge commit) ──► main (production)
```

- **JAMAIS** de push direct sur `main`
- **JAMAIS** de squash merge (desynchronise les branches)

## CI/CD

| Workflow | Declencheur | Actions |
|----------|------------|---------|
| `ci.yml` | Push staging/main, PR main | typecheck, lint, test, build, migration sync |
| `security.yml` | Push staging/main, PR main | Detection de secrets (gitleaks) |
| `auto-merge.yml` | PR Dependabot | Auto-merge patch/minor |

## Documentation

- **[apps/server/README.md](./apps/server/README.md)** - Backend API
- **[apps/mobile/README.md](./apps/mobile/README.md)** - App mobile Expo
- **[apps/app/CLAUDE.md](./apps/app/CLAUDE.md)** - App React
