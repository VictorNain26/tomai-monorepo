# Server Tom

Backend Bun + Elysia.js pour tutorat socratique adaptatif.

## Commandes

```bash
docker compose up -d              # OBLIGATOIRE : PostgreSQL 16 pgvector + Backend
bun run typecheck && bun run lint # Validation
bun run build                     # Build production
```

JAMAIS `bun run dev` sans PostgreSQL actif. Utiliser `docker compose up -d` ou `docker compose up -d postgres && bun run dev`.

## Stack

- **Runtime** : Bun 1.3 + Docker Compose
- **Framework** : Elysia.js 1.4 (type-safe API)
- **Database** : PostgreSQL 16 pgvector + Drizzle ORM 0.45
- **Cache** : MemoryCacheService (LRU in-memory avec TTL) - PAS de Redis
- **Auth** : Better Auth 1.5 + Google OAuth + account linking
- **AI** : Gemini 2.5 Flash (chat), Mistral (embeddings 1024D), Gladia (STT), ElevenLabs (TTS)
- **RAG** : Qdrant Cloud + Mistral embeddings + BM25 reranking
- **Paiement** : Stripe (webhooks) + RevenueCat (mobile webhooks)
- **Storage** : Scaleway S3 (presigned URLs, RGPD fr-par)
- **Pronote** : Pawnote 1.6 + AES-256-GCM (PBKDF2 600K iterations)

## Architecture

- **Services** (`src/services/`) : logique metier separee des routes
- **Routes** (`src/routes/`) : endpoints API (chat, upload, pronote, learning, subscription, tts, webhooks)
- **Repositories** (`src/db/repositories/`) : data access layer Drizzle
- **Middleware** (`src/middleware/`) : auth, rate-limit, memory-monitor
- **Schemas** (`src/schemas/`) : validation Zod pour toutes les requests
- **Config** (`src/config/`) : configuration app

### Modules principaux

- **Chat** (`src/services/chat/`) : orchestration Gemini, summarization, tool execution, token budget
- **Learning** : flashcards FSRS (spaced repetition), decks, progression, profil cognitif
- **Subscription** : checkout Stripe, lifecycle, gestion enfants (role parent)
- **RAG** : recherche unifiee Qdrant + BM25 reranking
- **Pronote** : auth QR code, devoirs, notes, emploi du temps (SSRF protection)
- **Storage** : upload presigned Scaleway, confirmation, sync Gemini

## Patterns

- JAMAIS de logique metier dans les route handlers → utiliser les services
- TOUJOURS valider les inputs avec Zod schemas
- Auth : `Better Auth session` via middleware, JAMAIS de verification manuelle
- Presigned URLs pour uploads (frontend → Scaleway direct, bypass backend)

## Sources officielles

Consulter avant toute modification : [Elysia.js](https://elysiajs.com), [Drizzle ORM](https://orm.drizzle.team), [Better Auth](https://better-auth.com), [Gemini API](https://ai.google.dev)
