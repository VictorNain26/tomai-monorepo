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
| Auth | Better Auth 1.6 + Google OAuth |
| AI Chat | Mistral (`mistral-medium-latest`, streaming + tools) |
| Embeddings | BGE-M3 (RAG, via ai-service) + `mistral-embed` 1024D (mémoire) |
| RAG | Qdrant Cloud hybrid (BGE-M3 dense+sparse + RRF) + reranker BGE |
| Stockage | Scaleway Object Storage (S3, RGPD France) |
| STT | Gladia |
| TTS | Voxtral (`voxtral-tts-26.03`, EU) |
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
| `MISTRAL_API_KEY` | API Mistral (chat, embeddings, vision, OCR, TTS) |

### Optional

| Variable | Description |
|----------|-------------|
| `AI_SERVICE_URL` | Service embeddings/rerank BGE-M3 (apps/ai-service) |
| `RAG_RERANK_ENABLED` | `true`/`false` — défaut OFF en dev (cross-encoder CPU lent), ON en prod |
| `QDRANT_URL` / `QDRANT_API_KEY` | Qdrant Cloud pour RAG |
| `SCALEWAY_ACCESS_KEY` / `SCALEWAY_SECRET_KEY` | Scaleway Object Storage |
| `SCALEWAY_BUCKET` / `SCALEWAY_REGION` | Bucket et region (fr-par) |
| `PRONOTE_ENCRYPTION_KEY` | AES-256-GCM pour tokens Pronote |
| `GLADIA_API_KEY` | Speech-to-Text |
| `REVENUECAT_WEBHOOK_AUTH` | Webhooks RevenueCat (mobile IAP, required en prod) |

### Dev seed (`pnpm seed`)

Les variables ci-dessous peuplent la DB avec des comptes de test locaux (`pnpm seed`) et sont **refusées en production**. Présentes par défaut dans `.env.example` :

| Variable | Valeur (défaut) | Usage |
|----------|-----------------|-------|
| `SEED_PARENT_PASSWORD` | `DevParent123!` | Login parent Tomia web |
| `SEED_CHILD_USERNAME` | `dev.eleve` | Login enfant Tomia (accès autonome) |
| `SEED_CHILD_PASSWORD` | `DevEleve123!` | Login enfant Tomia (accès autonome) |

### Device → Backend (LAN)

Le backend du monorepo tourne sur l'host (`pnpm dev` :3000). L'app mobile déduit
son URL (`EXPO_PUBLIC_API_URL`) de la résolution DNS du device (même Wi-Fi) et
loggue l'URL résolue au démarrage. Rien à configurer manuellement.

L'**ai-service** (BGE-M3 embeddings/rerank) tourne côté Docker intra-réseau
(`ai-service:8000`) mais est **inutilisable depuis l'host sans translation** : la
variable `AI_SERVICE_URL` doit pointer `http://localhost:8001` (port remappé par
Docker Compose à la `host`). `.env.example` le définit déjà.

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
│   ├── chat/                   # Mistral streaming, summarization, tools
│   ├── storage/                # Scaleway S3
│   ├── rag.service.ts          # RAG unifie (Qdrant hybrid + rerank)
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
