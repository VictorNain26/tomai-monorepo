# TomAI Server

Backend Bun + Elysia.js pour la plateforme de tutorat IA française.

## Quick Start

```bash
# 1. Copier les variables d'environnement
cp .env.example .env

# 2. Configurer les clés API requises dans .env
# - BETTER_AUTH_SECRET (générer: openssl rand -base64 32)
# - GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
# - GEMINI_API_KEY
# - DATABASE_URL (si différent du défaut Docker)

# 3. Démarrer la stack Docker (PostgreSQL + Redis + Backend)
docker compose up -d

# 4. Vérifier les services
docker compose ps
curl http://localhost:3000/health
```

## Stack

| Composant | Technologie |
|-----------|-------------|
| Runtime | Bun 1.3 (Alpine 3.22) |
| Framework | Elysia.js 1.3 |
| Database | PostgreSQL 16 + pgvector |
| Cache | Redis 7 |
| ORM | Drizzle ORM |
| Auth | Better Auth + Google OAuth |
| AI | Gemini 2.5 Flash, Mistral embeddings |

## Commandes

```bash
# Développement
docker compose up -d              # Stack complète avec hot-reload
docker compose logs -f backend    # Logs backend

# Validation (CI)
bun run typecheck                 # TypeScript strict
bun run lint                      # ESLint zero warnings

# Database
bun run db:push                   # Appliquer schema (dev)
bun run db:generate               # Générer migration (prod)
bun run db:studio                 # Interface Drizzle Studio

# Outils optionnels
docker compose --profile tools up -d  # Adminer + Redis Commander + Drizzle Studio
```

## Services Docker

| Service | Port | Description |
|---------|------|-------------|
| backend | 3000 | API Elysia.js avec hot-reload |
| postgres | 5432 | PostgreSQL 16 + pgvector |
| redis | 6379 | Cache et sessions |

### Outils (profile: tools)

| Service | Port | Description |
|---------|------|-------------|
| drizzle-studio | 4983 | UI Database Drizzle |
| adminer | 8080 | Client SQL léger |
| redis-commander | 8081 | UI Redis |

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
| `QDRANT_URL` | Qdrant Cloud pour RAG |
| `QDRANT_API_KEY` | API key Qdrant |
| `PRONOTE_ENCRYPTION_KEY` | AES-256-GCM pour tokens Pronote |
| `STRIPE_SECRET_KEY` | Paiements Stripe |
| `GLADIA_API_KEY` | Speech-to-Text |
| `ELEVENLABS_API_KEY` | Text-to-Speech |

## API Endpoints

### Health & Info

- `GET /` - Info serveur
- `GET /health` - Health check (database, redis, AI)

### Auth (Better Auth)

- `POST /api/auth/sign-in` - Connexion
- `POST /api/auth/sign-up` - Inscription
- `GET /api/auth/session` - Session courante
- `POST /api/auth/sign-out` - Déconnexion

### Chat IA

- `POST /api/chat/message` - Envoi message (streaming)
- `GET /api/chat/session/:id/history` - Historique session

### Pronote (students only)

- `POST /api/pronote/connect` - Connexion QR code
- `DELETE /api/pronote/disconnect` - Déconnexion
- `GET /api/pronote/status` - Statut connexion
- `GET /api/pronote/homework` - Devoirs
- `GET /api/pronote/grades` - Notes
- `GET /api/pronote/timetable` - Emploi du temps

### Learning (révisions FSRS)

- `GET /api/learning/decks` - Liste decks
- `POST /api/learning/decks` - Créer deck
- `GET /api/learning/cards/review` - Cartes à réviser
- `POST /api/learning/cards/:id/review` - Soumettre réponse

## Architecture

```
src/
├── app.ts                  # Configuration Elysia
├── index.ts                # Point d'entrée
├── config/                 # Configuration app
├── db/
│   ├── schema.ts           # Drizzle schema (source of truth)
│   ├── connection.ts       # Pool PostgreSQL
│   └── migrate.ts          # Runtime migrations
├── lib/
│   ├── auth.ts             # Better Auth config
│   ├── encryption.ts       # AES-256-GCM Pronote
│   └── redis.service.ts    # Client Redis
├── middleware/             # Auth, rate-limit, memory
├── routes/                 # Endpoints API
├── services/               # Business logic
│   ├── gemini-simple.service.ts
│   ├── rag.service.ts
│   ├── pronote.service.ts
│   └── ...
└── types/                  # TypeScript types
```

## Troubleshooting

### Database connexion failed

```bash
# Vérifier que PostgreSQL est démarré
docker compose ps postgres
docker compose logs postgres

# Reset complet si nécessaire
docker compose down -v
docker compose up -d
```

### Redis connexion failed

```bash
# Vérifier Redis
docker compose ps redis
docker compose logs redis

# Test manuel
docker compose exec redis redis-cli ping
```

### Hot-reload ne fonctionne pas

Les volumes sont montés en read-only (`:ro`). Modifier les fichiers locaux et le container détectera les changements via `bun --watch`.

```bash
# Vérifier les logs
docker compose logs -f backend
```
