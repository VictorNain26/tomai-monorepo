# TomAI Server

Backend Bun + Elysia.js pour la plateforme de tutorat IA francaise.

## Quick Start

```bash
# 1. Copier les variables d'environnement
cp .env.example .env

# 2. Configurer les cles requises dans .env
# - BETTER_AUTH_SECRET (generer: openssl rand -base64 32)
# - GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
# - MISTRAL_API_KEY

# 3. Demarrer depuis la racine du monorepo (PostgreSQL Docker + backend :3000 sur l'host)
pnpm dev

# 4. Verifier
curl http://localhost:3000/health
```

## API Documentation

Documentation interactive auto-generee disponible en dev :

**http://localhost:3000/swagger**

> Swagger est desactive en production.

## Stack

| Composant | Technologie |
|-----------|-------------|
| Runtime | Bun 1.4 |
| Framework | Elysia.js 1.4 |
| Database | PostgreSQL 18 + pgvector |
| ORM | Drizzle ORM 0.45 |
| Cache | MemoryCacheService (LRU in-memory avec TTL) |
| Auth | Better Auth 1.7 + Google OAuth |
| AI Chat | Mistral (`mistral-medium-latest`, streaming + tools) |
| Embeddings | `mistral-embed` 1024D (mémoire épisodique, pgvector) |
| Stockage | Scaleway Object Storage (S3, RGPD France) |
| STT | Voxtral (`voxtral-mini-latest`, EU) |
| TTS | Voxtral (`voxtral-tts-latest`, EU) |
| Paiements | Aucun branché (paiement web au lot 3) |
| Pronote | Pawnote 1.6 + AES-256-GCM |

## Commands

```bash
# Dev (depuis la racine du monorepo)
pnpm dev                          # PostgreSQL Docker + backend avec hot-reload
docker compose --profile backend up -d  # Backend conteneurise (image iso-prod, opt-in)

# Validation
bun run typecheck                 # TypeScript strict
bun run lint                      # ESLint zero warnings

# Database
bun run db:push                   # Dev: sync schema → DB
bun run db:generate               # Prod: generer migration SQL
bun run db:migrate                # Prod: appliquer migrations
bun run db:check                  # Verifier sync schema ↔ DB
bun run db:studio                 # Drizzle Studio UI

# Outils Docker (optionnel)
docker compose --profile tools up -d  # Adminer (8080) + Drizzle Studio (4983)
```

## Docker Services

| Service | Port | Description |
|---------|------|-------------|
| backend | 3000 | API Elysia.js conteneurisee (profile: backend) |
| postgres | 5432 | PostgreSQL 18 + pgvector |
| drizzle-studio | 4983 | UI Database (profile: tools) |
| adminer | 8080 | Client SQL (profile: tools) |

## Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `BETTER_AUTH_SECRET` | Secret JWT (min 32 chars) |
| `BETTER_AUTH_URL` | URL backend (http://localhost:3000) |
| `GOOGLE_CLIENT_ID` | OAuth Google |
| `GOOGLE_CLIENT_SECRET` | OAuth Google |
| `MISTRAL_API_KEY` | API Mistral (chat, embeddings, vision, OCR, STT, TTS) |

### Optional

| Variable | Description |
|----------|-------------|
| `SCALEWAY_ACCESS_KEY` / `SCALEWAY_SECRET_KEY` | Scaleway Object Storage |
| `SCALEWAY_BUCKET` / `SCALEWAY_REGION` | Bucket et region (fr-par) |
| `PRONOTE_ENCRYPTION_KEY` | AES-256-GCM pour tokens Pronote |

### Dev seed (`pnpm seed`)

Les variables ci-dessous peuplent la DB avec des comptes de test locaux (`pnpm seed`) et sont **refusées en production**. Présentes par défaut dans `.env.example` :

| Variable | Valeur (défaut) | Usage |
|----------|-----------------|-------|
| `SEED_PARENT_EMAIL` | `dev.parent@tomai.local` | Login parent Tomia web |
| `SEED_PARENT_PASSWORD` | `DevParent123!` | Login parent Tomia web |
| `SEED_CHILD_USERNAME` | `dev.eleve` | Login enfant Tomia (accès autonome) |
| `SEED_CHILD_PASSWORD` | `DevEleve123!` | Login enfant Tomia (accès autonome) |

## Architecture

```
src/
├── index.ts                    # Point d'entree, graceful shutdown
├── app.ts                      # Factory Elysia, routes, Swagger
├── config/                     # Configuration IA, education, prompts
├── db/
│   ├── schema.ts               # Source of truth (Drizzle)
│   ├── connection.ts           # Pool PostgreSQL
│   ├── migrate.ts              # Runtime migrator
│   └── repositories/           # Data access layer
├── lib/                        # Auth, encryption, plan cache, observability
├── middleware/                  # Auth, rate-limit, memory monitor
├── routes/                     # API endpoints
│   ├── chat-message.routes.ts  # SSE streaming
│   ├── file-upload.routes.ts   # Upload Scaleway
│   ├── pronote-*.routes.ts     # Integration Pronote (connexion, donnees, sync)
│   ├── tts.routes.ts           # Text-to-Speech
│   ├── learning/               # Decks, cartes, FSRS
│   └── subscription/           # Status lecture seule (DB)
├── services/                   # Business logic
│   ├── chat/                   # Mistral streaming, summarization, tools
│   ├── storage/                # Scaleway S3
│   ├── pronote/                # Pawnote adapter, connexion, donnees
│   ├── quota/                  # Quotas tokens IA
│   ├── voxtral-*.service.ts    # STT / TTS Mistral
│   └── fsrs.service.ts         # Spaced repetition
└── types/                      # Types TypeScript
```

## Docker Build (Production)

Multi-stage : base (Bun + Node + pnpm) → deps → build (typecheck + lint + bundle) → production.

```bash
# Entrypoint : migrations auto avant demarrage
docker-entrypoint.sh → bun dist/migrate.js → bun --smol dist/index.js
```
