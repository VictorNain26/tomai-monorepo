# TomAI Server

Backend Bun + Elysia.js pour la plateforme de tutorat IA francaise.

## Quick Start

```bash
# 1. Copier les variables d'environnement
cp .env.example .env

# 2. Configurer les cles API requises dans .env
# - BETTER_AUTH_SECRET (generer: openssl rand -base64 32)
# - GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
# - GEMINI_API_KEY

# 3. Demarrer la stack Docker (PostgreSQL + Backend)
docker compose up -d

# 4. Verifier
docker compose ps
curl http://localhost:3000/health
```

## Stack

| Composant | Technologie |
|-----------|-------------|
| Runtime | Bun 1.3 |
| Framework | Elysia.js 1.4.19 |
| Database | PostgreSQL 16 + pgvector |
| ORM | Drizzle ORM 0.45 |
| Auth | Better Auth 1.4 + Google OAuth |
| AI Chat | Gemini 2.5 Flash (@google/genai) |
| Embeddings | Mistral AI 1024D |
| RAG | Qdrant Cloud + BM25 reranking |
| Stockage | Scaleway Object Storage (S3, RGPD France) |
| STT | Gladia |
| TTS | ElevenLabs |
| Paiements | Stripe + RevenueCat |
| Pronote | Pawnote 1.6 + AES-256-GCM |

## Commandes

```bash
# Developpement
docker compose up -d              # Stack complete avec hot-reload
docker compose logs -f backend    # Logs backend

# Validation (CI)
bun run typecheck                 # TypeScript strict
bun run lint                      # ESLint zero warnings

# Database
bun run db:push                   # Dev: sync schema → DB
bun run db:generate               # Prod: generer migration SQL
bun run db:migrate                # Prod: appliquer migrations
bun run db:check                  # Verifier sync schema ↔ DB
bun run db:studio                 # Drizzle Studio UI

# Outils
docker compose --profile tools up -d  # Adminer + Drizzle Studio
```

## Services Docker

| Service | Port | Description |
|---------|------|-------------|
| backend | 3000 | API Elysia.js avec hot-reload |
| postgres | 5432 | PostgreSQL 16 + pgvector |

### Outils (profile: tools)

| Service | Port | Description |
|---------|------|-------------|
| drizzle-studio | 4983 | UI Database |
| adminer | 8080 | Client SQL |

## Variables d'environnement

### Requises

| Variable | Description |
|----------|-------------|
| `BETTER_AUTH_SECRET` | Secret JWT (min 32 chars) |
| `BETTER_AUTH_URL` | URL backend (http://localhost:3000) |
| `GOOGLE_CLIENT_ID` | OAuth Google |
| `GOOGLE_CLIENT_SECRET` | OAuth Google |
| `GEMINI_API_KEY` | API Gemini pour chat IA |

### Optionnelles

| Variable | Description |
|----------|-------------|
| `MISTRAL_API_KEY` | Embeddings 1024D pour RAG |
| `QDRANT_URL` / `QDRANT_API_KEY` | Qdrant Cloud pour RAG |
| `SCALEWAY_ACCESS_KEY` / `SCALEWAY_SECRET_KEY` | Scaleway Object Storage |
| `SCALEWAY_BUCKET` / `SCALEWAY_REGION` | Bucket et region (fr-par) |
| `PRONOTE_ENCRYPTION_KEY` | AES-256-GCM pour tokens Pronote |
| `GLADIA_API_KEY` | Speech-to-Text |
| `ELEVENLABS_API_KEY` | Text-to-Speech |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Paiements Stripe |
| `REVENUECAT_WEBHOOK_AUTH` | Webhooks RevenueCat (mobile IAP) |

## API Endpoints

### Health

| Methode | Path | Description |
|---------|------|-------------|
| GET | `/health` | Health check (DB, AI) |
| GET | `/curriculum-health` | RAG health (Qdrant + Mistral) |

### Auth (Better Auth)

| Methode | Path | Description |
|---------|------|-------------|
| POST | `/api/auth/sign-in` | Connexion |
| POST | `/api/auth/sign-up` | Inscription |
| GET | `/api/auth/session` | Session courante |
| POST | `/api/auth/sign-out` | Deconnexion |

### Chat IA (students)

| Methode | Path | Description |
|---------|------|-------------|
| POST | `/api/chat/stream` | SSE streaming (Gemini + RAG) |
| POST | `/api/chat/session` | Creer/obtenir session active |
| GET | `/api/chat/sessions/latest` | Derniere session |
| GET | `/api/chat/session/:id/history` | Historique messages |
| POST | `/api/chat/session/:id/reset` | Archiver et creer nouvelle session |
| DELETE | `/api/chat/session/:id` | Supprimer session |

### Classeur & Fichiers (students)

| Methode | Path | Description |
|---------|------|-------------|
| GET | `/api/files` | Liste fichiers du classeur |
| GET | `/api/chat/session/:id/files` | Fichiers attaches a la session |
| POST | `/api/chat/session/:id/files` | Attacher un fichier du classeur |
| DELETE | `/api/chat/session/:id/files/:fileId` | Detacher un fichier |

### Upload (Scaleway presigned)

| Methode | Path | Description |
|---------|------|-------------|
| GET | `/api/upload/status` | Statut stockage |
| POST | `/api/upload/presign` | Generer URL presignee |
| POST | `/api/upload/confirm/:fileId` | Confirmer upload |
| GET | `/api/upload/file/:fileId` | URL de telechargement |
| DELETE | `/api/upload/file/:fileId` | Supprimer fichier |

### Pronote

**Parents :**

| Methode | Path | Description |
|---------|------|-------------|
| POST | `/api/pronote/connect` | Connexion QR code + PIN |
| DELETE | `/api/pronote/disconnect` | Deconnexion |
| GET | `/api/pronote/status` | Statut connexion |
| POST | `/api/pronote/mappings` | Mapper enfants Pronote → TomAI |
| GET | `/api/pronote/child/:id/homework` | Devoirs enfant |
| GET | `/api/pronote/child/:id/grades` | Notes enfant |
| GET | `/api/pronote/child/:id/timetable` | Emploi du temps enfant |

**Eleves :**

| Methode | Path | Description |
|---------|------|-------------|
| GET | `/api/pronote/student/status` | Statut Pronote |
| GET | `/api/pronote/student/homework` | Devoirs |
| GET | `/api/pronote/student/grades` | Notes |
| GET | `/api/pronote/student/timetable` | Emploi du temps |

**Public :**

| Methode | Path | Description |
|---------|------|-------------|
| POST | `/api/pronote/schools/search` | Recherche etablissements par GPS |

### Revision (FSRS spaced repetition)

| Methode | Path | Description |
|---------|------|-------------|
| GET | `/api/learning/decks` | Liste des decks |
| POST | `/api/learning/decks` | Creer un deck |
| GET | `/api/learning/decks/:id` | Deck avec cartes |
| PATCH | `/api/learning/decks/:id` | Modifier deck |
| DELETE | `/api/learning/decks/:id` | Supprimer deck |
| POST | `/api/learning/decks/:id/cards` | Ajouter des cartes |
| POST | `/api/learning/generate` | Generation IA de deck (premium) |
| GET | `/api/learning/due-summary` | Total cartes a reviser |
| GET | `/api/learning/decks/:id/due` | Cartes a reviser (deck) |
| POST | `/api/learning/review` | Soumettre revision (FSRS) |
| GET | `/api/learning/decks/:id/stats` | Stats FSRS du deck |

### TTS (Text-to-Speech)

| Methode | Path | Description |
|---------|------|-------------|
| POST | `/api/tts/synthesize` | Synthese vocale (max 5000 chars) |
| GET | `/api/tts/voices` | Voix disponibles par niveau |

### Abonnements (Stripe)

| Methode | Path | Description |
|---------|------|-------------|
| POST | `/api/subscriptions/checkout` | Creer session Stripe Checkout |
| GET | `/api/subscriptions/status` | Statut abonnement |
| GET | `/api/subscriptions/portal` | Portail client Stripe |
| POST | `/api/subscriptions/cancel` | Annuler abonnement |
| POST | `/api/subscriptions/resume` | Reprendre abonnement |
| GET | `/api/subscriptions/usage` | Utilisation tokens IA |

### Webhooks

| Methode | Path | Description |
|---------|------|-------------|
| POST | `/webhooks/stripe` | Evenements Stripe |
| POST | `/webhooks/revenuecat` | Evenements RevenueCat |

### Parent (dashboard)

| Methode | Path | Description |
|---------|------|-------------|
| GET | `/api/parent/dashboard` | Dashboard parent |
| GET | `/api/parent/children` | Liste enfants |
| POST | `/api/parent/children` | Creer compte enfant |
| PATCH | `/api/parent/children/:id` | Modifier enfant |
| DELETE | `/api/parent/children/:id` | Supprimer enfant |

## Architecture

```
src/
├── index.ts                    # Point d'entree, graceful shutdown
├── app.ts                      # Factory Elysia, registration routes
├── config/
│   ├── ai/                     # Configuration modeles IA
│   ├── education/              # Niveaux scolaires
│   └── prompts/                # Templates prompts systeme
├── db/
│   ├── schema.ts               # Source of truth (Drizzle)
│   ├── connection.ts           # Pool PostgreSQL
│   ├── migrate.ts              # Runtime migrator
│   └── repositories/           # Data access layer
├── lib/
│   ├── auth.ts                 # Better Auth config
│   ├── encryption.ts           # AES-256-GCM (Pronote)
│   ├── stripe/                 # Client Stripe
│   └── observability.ts        # Logger structure
├── middleware/                  # Auth, rate-limit, memory
├── routes/
│   ├── api.routes.ts           # Routes REST principales
│   ├── chat-message.routes.ts  # SSE streaming
│   ├── file-upload.routes.ts   # Upload Scaleway
│   ├── pronote.routes.ts       # Integration Pronote
│   ├── tts.routes.ts           # Text-to-Speech
│   ├── learning/               # Decks, cartes, FSRS
│   └── subscription/           # Stripe checkout, lifecycle
├── services/
│   ├── chat/                   # Streaming, summarization, file context
│   ├── document/               # Parsing PDF/DOCX
│   ├── learning/               # Generation IA de cartes
│   ├── storage/                # Scaleway S3
│   ├── rag.service.ts          # RAG unifie (semantic + BM25)
│   ├── qdrant.service.ts       # Client Qdrant Cloud
│   ├── pronote.service.ts      # Pawnote wrapper
│   ├── fsrs.service.ts         # Algorithme FSRS
│   └── token-quota.service.ts  # Quotas tokens IA
└── types/                      # Types TypeScript
```

## Docker Build (Production)

Multi-stage Dockerfile :

1. **base** : Bun 1.3 + Node.js 22 + pnpm
2. **deps** : `pnpm install --frozen-lockfile --prod`
3. **build** : typecheck → lint → `bun build` → verification `dist/index.js`
4. **production** : Copie minimale (dist + node_modules + drizzle migrations)

```bash
# Entrypoint: migrations auto avant demarrage
docker-entrypoint.sh → bun run src/db/migrate.ts → bun --smol dist/index.js
```

## Troubleshooting

### Database connexion failed

```bash
docker compose ps postgres
docker compose logs postgres

# Reset complet
docker compose down -v && docker compose up -d
```

### Hot-reload ne fonctionne pas

```bash
docker compose logs -f backend
# Volumes montes en read-only, bun --watch detecte les changements
```
