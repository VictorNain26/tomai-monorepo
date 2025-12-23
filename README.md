# Tom Monorepo

**Plateforme de tutorat IA adaptatif** - Architecture Turborepo unifiée

## Demarrage Rapide

```bash
# Installation
pnpm install

# Developpement (lance toutes les apps)
pnpm dev
# → Landing: http://localhost:3001
# → App: http://localhost:5173
# → Server: http://localhost:3000

# Build production
pnpm build

# Validation complete
pnpm validate
```

**Backend** : Docker requis pour PostgreSQL et Redis
```bash
cd apps/server && docker compose up -d
```

## Structure

```
tomai-monorepo/
├── apps/
│   ├── landing/       # Next.js 16 site vitrine (port 3001)
│   ├── app/           # React 19 + Vite 7 app tutorat (port 5173)
│   ├── server/        # Bun + Elysia.js backend (port 3000)
│   └── mobile/        # Expo SDK 54 app mobile (port 8081)
├── packages/
│   ├── api/           # @repo/api - Eden Treaty clients
│   ├── shared-types/  # @repo/shared-types - Types partages
│   └── eslint-config/ # @repo/eslint-config - Configs ESLint
└── CLAUDE.md          # Documentation developpeur
```

## Apps

| App | Port | Tech | Description |
|-----|------|------|-------------|
| **landing** | 3001 | Next.js 16 | Site vitrine SEO |
| **app** | 5173 | React 19 + Vite 7 | Application de tutorat |
| **server** | 3000 | Bun + Elysia.js | API backend |
| **mobile** | 8081 | Expo SDK 54 | Application mobile |

## Commandes

```bash
# Developpement
pnpm dev              # Toutes les apps
pnpm dev:landing      # Landing seulement
pnpm dev:app          # App seulement
pnpm dev:server       # Server seulement
pnpm dev:mobile       # Mobile seulement

# Build
pnpm build            # Build production

# Validation
pnpm typecheck        # TypeScript strict
pnpm lint             # ESLint
pnpm validate         # typecheck + lint

# Database
pnpm db:push          # Appliquer schema (dev)
pnpm db:generate      # Generer migration (prod)
pnpm db:studio        # Drizzle Studio
```

## Stack

| Couche | Technologies |
|--------|--------------|
| Monorepo | Turborepo 2.7.1, PNPM 10.12.1 |
| Backend | Bun, Elysia.js 1.3, PostgreSQL 16, Redis 7, Drizzle ORM |
| Frontend | React 19, Vite 7, TailwindCSS 4, shadcn/ui |
| Mobile | Expo SDK 54, React Native 0.81, NativeWind |
| Auth | Better Auth + Google OAuth |
| AI | Gemini 2.5 Flash, Mistral embeddings, Qdrant RAG |

## Documentation

- **[CLAUDE.md](./CLAUDE.md)** - Guide developpeur
- **[apps/app/CLAUDE.md](./apps/app/CLAUDE.md)** - App React
- **[apps/server/CLAUDE.md](./apps/server/CLAUDE.md)** - Backend Elysia

## Git Workflow

- **develop** : Branche de travail (push direct OK)
- **main** : Production (PR obligatoire)

```bash
git checkout develop
git pull origin develop
# ... travailler ...
git push origin develop
# PR develop → main pour production
```
