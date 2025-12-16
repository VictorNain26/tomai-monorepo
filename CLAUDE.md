# CLAUDE.md - Tom Monorepo

Monorepo Turborepo unifiant le site vitrine, l'application métier et le serveur backend.

## Architecture

```
tomai-monorepo/
├── apps/
│   ├── landing/          # Site vitrine Next.js 16 (port 3001)
│   ├── app/              # Application métier Vite (port 5173)
│   └── server/           # Backend Elysia.js + Bun (port 3000)
├── packages/
│   ├── shared-types/     # Types partagés frontend/backend
│   ├── eslint-config/    # ESLint config
│   └── typescript-config/ # TypeScript config
├── tsconfig.base.json    # Configuration TypeScript commune
├── turbo.json            # Configuration Turborepo
└── package.json          # Bun workspaces
```

## Stack Technique

| Couche | Technologies |
|--------|--------------|
| Runtime | **Bun** (monorepo unifié) |
| Build | Turborepo |
| Backend | Elysia.js, PostgreSQL 16, Redis, Drizzle ORM |
| Frontend Landing | Next.js 16, TailwindCSS 4 |
| Frontend App | Vite 7, React 19, React Router 7, TanStack Query/Form |
| Auth | Better Auth + Google OAuth |
| AI | Gemini 2.5 Flash, Mistral (embeddings), Qdrant (RAG) |
| API Client | **Eden Treaty** (type-safe) |

## Commandes

```bash
# Installation
bun install

# Développement
bun run dev              # Tous les apps
bun run dev:landing      # Landing seulement (port 3001)
bun run dev:app          # App métier seulement (port 5173)
bun run dev:server       # Backend seulement (port 3000)

# Validation (obligatoire avant commit)
bun run typecheck        # TypeScript strict
bun run lint             # ESLint
bun run validate         # typecheck + lint

# Build
bun run build            # Production tous les apps

# Database (depuis apps/server/)
bun run db:push          # Appliquer schema (dev)
bun run db:generate      # Générer migration (prod)
bun run db:studio        # Interface Drizzle Studio
```

## Eden Treaty - API Type-Safe

Le client et le serveur partagent les types via Eden Treaty :

```typescript
// apps/app/src/lib/eden-client.ts
import { treaty } from '@elysiajs/eden';
import type { App } from 'tomai-server/app';

export const api = treaty<App>(getBackendURL(), {
  fetch: { credentials: 'include', mode: 'cors' }
});

// Usage avec autocomplete complet
const { data, error } = await api.api.subjects.get({ query: { level: 'college-6' } });
```

## Configuration TypeScript

Configuration unifiée au niveau du monorepo (`tsconfig.base.json`) avec :
- `strict: true` et toutes les options de strictness standard
- Compatible avec Drizzle ORM et les bibliothèques modernes
- Pas de `exactOptionalPropertyTypes` (cause friction avec ORMs)

Chaque app étend cette configuration avec ses spécificités :
- **Client** : types Vite + Bun (pour Eden Treaty)
- **Server** : types Bun uniquement
- **Landing** : types Next.js

## Règles de Développement

### Standards de Code
- **TypeScript strict** : Aucun type `any`
- **Zero warnings ESLint** en mode CI
- **400 lignes max** par fichier
- **shadcn/ui uniquement** pour les composants UI

### Pas de Sur-engineering
- Pas d'abstractions prématurées
- Pas de composants génériques pour un seul usage
- Supprimer le code inutilisé (pas le commenter)

### Workflow Git
- Travailler sur `develop` (push direct OK)
- PR `develop → main` pour production
- CI doit passer avant merge

## Documentation Détaillée

- `apps/app/CLAUDE.md` - Spécificités app React
- `apps/server/CLAUDE.md` - Architecture backend et migrations
- `apps/landing/CLAUDE.md` - Site vitrine Next.js

## Validation Pré-Commit

```bash
bun run typecheck  # Zero erreur TypeScript
bun run lint       # Zero warnings ESLint
bun run build      # Build successful
```
