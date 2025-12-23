# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Tom** - French AI tutoring platform for students from elementary to high school. Uses Gemini AI with RAG on 415 official Éduscol curricula, Socratic pedagogy, and Pronote integration.

## Commands

```bash
# Install dependencies
pnpm install

# Development (all apps in parallel)
pnpm run dev             # Landing:3001 + App:5173 + Server:3000

# Single app development
pnpm run dev:landing     # Next.js landing page (port 3001)
pnpm run dev:app         # React Vite app (port 5173)
pnpm run dev:server      # Elysia backend (port 3000)
pnpm run dev:mobile      # Expo mobile app (port 8081)

# Validation (required before commit)
pnpm run typecheck       # TypeScript strict mode
pnpm run lint            # ESLint
pnpm run validate        # typecheck + lint combined

# Production build
pnpm run build           # All apps

# Database (requires PostgreSQL via Docker)
pnpm run db:push         # Apply schema changes (dev)
pnpm run db:generate     # Generate migration (prod)
pnpm run db:studio       # Drizzle Studio UI
```

**Backend requires Docker** for PostgreSQL and Redis:
```bash
cd apps/server && docker compose up -d
```

## Architecture

```
tomai-monorepo/
├── apps/
│   ├── landing/       # Next.js 16 static landing page
│   ├── app/           # React 19 + Vite 7 main tutoring app
│   ├── mobile/        # Expo SDK 54 + React Native 0.81 mobile app
│   └── server/        # Elysia.js + Bun backend
├── packages/
│   ├── api/           # Shared API client (platform-agnostic)
│   └── shared-types/  # Shared TypeScript types
└── tsconfig.base.json # Base TypeScript config
```

### Key Architecture Decisions

**Eden Treaty**: Type-safe API client connecting React app to Elysia backend
```typescript
import { treaty } from '@elysiajs/eden';
import type { App } from 'tomai-server/app';

export const api = treaty<App>(getBackendURL(), {
  fetch: { credentials: 'include', mode: 'cors' }
});
// Full autocomplete: api.api.subjects.get({ query: { level: 'college-6' } })
```

**State Management**:
- Server state: TanStack Query
- Form state: TanStack Form
- Auth: Better Auth + Google OAuth

**Database**: PostgreSQL 16 + Drizzle ORM
- Schema source of truth: `apps/server/src/db/schema.ts`
- Never edit `.sql` migration files manually

**AI Stack**: Gemini 2.5 Flash (chat), Mistral (embeddings 1024D), Qdrant Cloud (RAG)

## Development Rules

1. **TypeScript strict**: No `any` types, explicit null handling
2. **Zero ESLint warnings** in CI mode
3. **400 lines max** per file
4. **shadcn/ui only** for React components (no custom CSS or inline styles)
5. **Evidence-based changes**: Read existing patterns before modifying
6. **No over-engineering**: No premature abstractions, delete unused code

## Git Workflow (2025)

- **main** → Production (Vercel + Koyeb auto-deploy)
- **develop** → Staging/Preview (Vercel preview + Koyeb staging)
- Workflow: `develop (push direct) → PR → main`
- See root `CLAUDE.md` for detailed workflow and Vercel troubleshooting

## App-Specific Documentation

- `apps/app/CLAUDE.md` - React app specifics
- `apps/mobile/CLAUDE.md` - Mobile app specifics (Expo + React Native)
- `apps/server/CLAUDE.md` - Backend architecture, migrations, AI services
