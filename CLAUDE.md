# CLAUDE.md - Monorepo Tom

Monorepo Turborepo pour la plateforme de tutorat Tom.

## Commandes

```bash
# Installation
pnpm install

# Développement (toutes les apps en parallèle)
pnpm dev                 # Landing:3001 + App:5173 + Server:3000
pnpm dev:mobile          # Expo mobile (port 8081)

# Développement app individuelle
pnpm dev:landing         # Next.js landing (port 3001)
pnpm dev:app             # React Vite app (port 5173)
pnpm dev:server          # Backend Elysia (port 3000)

# Validation (obligatoire avant commit)
pnpm typecheck           # TypeScript strict
pnpm lint                # ESLint
pnpm validate            # typecheck + lint

# Build production
pnpm build               # Toutes les apps

# Base de données (Docker requis)
pnpm db:push             # Appliquer schema (dev)
pnpm db:generate         # Générer migration (prod)
pnpm db:studio           # Interface Drizzle Studio
```

**Backend nécessite Docker** (PostgreSQL + Redis) :
```bash
cd apps/server && docker compose up -d
```

## Architecture

```
tomai-monorepo/
├── apps/
│   ├── landing/       # Next.js 16 - Landing page SEO
│   ├── app/           # React 19 + Vite 7 - Application tutorat
│   ├── mobile/        # Expo SDK 54 - Application mobile
│   └── server/        # Bun + Elysia.js - Backend API
├── packages/
│   ├── api/           # Client API partagé (Eden Treaty)
│   └── shared-types/  # Types TypeScript partagés
└── tsconfig.base.json # Config TypeScript de base
```

## Stack technique

| Couche | Technologies |
|--------|--------------|
| Backend | Bun, Elysia.js, PostgreSQL 16, Redis 7, Drizzle ORM |
| Landing | Next.js 16, TailwindCSS 4, Framer Motion |
| App | Vite 7, React 19, TanStack Query/Form, shadcn/ui |
| Mobile | Expo SDK 54, React Native 0.81, NativeWind |
| Auth | Better Auth + Google OAuth |
| AI | Gemini 2.5 Flash, Mistral embeddings, Qdrant Cloud |

## Règles de développement

1. **TypeScript strict** : Pas de `any`, gestion explicite des `null`
2. **Zero warnings ESLint** en CI
3. **400 lignes max** par fichier
4. **shadcn/ui uniquement** pour les composants React (pas de CSS custom)
5. **Evidence-based** : Lire les patterns existants avant modification
6. **Pas de sur-engineering** : Supprimer le code inutilisé

## Workflow Git

- **main** → Production (Vercel + Koyeb auto-deploy)
- **develop** → Staging/Preview
- Workflow : `develop (push direct) → PR → main`
- Voir `Tom/CLAUDE.md` pour le workflow détaillé

## Documentation par app

- `apps/landing/CLAUDE.md` - Landing page Next.js
- `apps/app/CLAUDE.md` - Application React
- `apps/mobile/CLAUDE.md` - Application mobile Expo
- `apps/server/CLAUDE.md` - Backend Bun + Elysia
