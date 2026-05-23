# TomAI Server

Backend Bun + Elysia.js pour la plateforme de tutorat IA francaise.

## Quick Start

```bash
# 1. Copier les variables d'environnement
cp .env.example .env

# 2. Configurer les cles requises dans .env
# - BETTER_AUTH_SECRET (generer: openssl rand -base64 32)
# - GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
# - GEMINI_API_KEY

# 3. Demarrer (PostgreSQL + Backend avec hot-reload)
docker compose up -d

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
| Runtime | Bun 1.3 |
| Framework | Elysia.js 1.4 |
| Database | PostgreSQL 16 + pgvector |
| ORM | Drizzle ORM 0.45 |
| Cache | MemoryCacheService (LRU in-memory avec TTL) |
| Auth | Better Auth 1.4 + Google OAuth |
| AI Chat | Gemini 2.5 Flash (@google/genai) |
| Embeddings | Mistral AI 1024D |
| RAG | Qdrant Cloud + BM25 reranking |
| Stockage | Scaleway Object Storage (S3, RGPD France) |
| STT | Gladia |
| TTS | ElevenLabs |
| Paiements | RevenueCat (mobile IAP, source unique) |
| Pronote | Pawnote 1.6 + AES-256-GCM |

## Commands

```bash
# Dev
docker compose up -d              # Stack complete avec hot-reload
docker compose logs -f backend    # Logs

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
| backend | 3000 | API Elysia.js avec hot-reload |
| postgres | 5432 | PostgreSQL 16 + pgvector |
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
| `GEMINI_API_KEY` | API Gemini pour chat IA |

### Optional

| Variable | Description |
|----------|-------------|
| `MISTRAL_API_KEY` | Embeddings 1024D pour RAG |
| `QDRANT_URL` / `QDRANT_API_KEY` | Qdrant Cloud pour RAG |
| `SCALEWAY_ACCESS_KEY` / `SCALEWAY_SECRET_KEY` | Scaleway Object Storage |
| `SCALEWAY_BUCKET` / `SCALEWAY_REGION` | Bucket et region (fr-par) |
| `PRONOTE_ENCRYPTION_KEY` | AES-256-GCM pour tokens Pronote |
| `GLADIA_API_KEY` | Speech-to-Text |
| `ELEVENLABS_API_KEY` | Text-to-Speech |
| `REVENUECAT_WEBHOOK_AUTH` | Webhooks RevenueCat (mobile IAP, required en prod) |

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
│   ├── pronote.routes.ts       # Integration Pronote
│   ├── tts.routes.ts           # Text-to-Speech
│   ├── learning/               # Decks, cartes, FSRS
│   ├── revenuecat-webhook.*.ts # Webhooks RevenueCat (source de vérité)
│   └── subscription/           # Status lecture seule (DB + RC)
├── services/                   # Business logic
│   ├── chat/                   # Gemini streaming, summarization, tools
│   ├── storage/                # Scaleway S3
│   ├── rag.service.ts          # RAG unifie (semantic + BM25)
│   ├── pronote.service.ts      # Pawnote wrapper + SSRF protection
│   ├── fsrs.service.ts         # Spaced repetition
│   └── token-quota.service.ts  # Quotas tokens IA
└── types/                      # Types TypeScript
```

## Docker Build (Production)

Multi-stage : base (Bun + Node + pnpm) → deps → build (typecheck + lint + bundle) → production.

```bash
# Entrypoint : migrations auto avant demarrage
docker-entrypoint.sh → bun run src/db/migrate.ts → bun --smol dist/index.js
```
