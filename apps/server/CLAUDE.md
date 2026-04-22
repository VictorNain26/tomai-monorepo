# Server Tom

Backend Bun + Elysia.js pour tutorat socratique adaptatif.

## Commandes

```bash
docker compose up -d              # OBLIGATOIRE : PostgreSQL 16 pgvector + Backend
bun run typecheck && bun run lint # Validation
bun run test                      # Tests Bun runner
bun run build                     # Build production
```

JAMAIS `bun run dev` sans PostgreSQL actif. Utiliser `docker compose up -d` ou `docker compose up -d postgres && bun run dev`.

## Stack

- **Runtime** : Bun 1.3 + Docker Compose
- **Framework** : Elysia.js 1.4 (type-safe API, Eden Treaty exposé aux clients via `@repo/api`)
- **Database** : PostgreSQL 16 pgvector + Drizzle ORM 0.45
- **Cache** : MemoryCacheService (LRU in-memory avec TTL) — PAS de Redis
- **Auth** : Better Auth 1.5 + Google OAuth + account linking + cookieCache
- **AI** : Gemini 2.5 Flash (chat), Mistral (embeddings 1024D), Gladia (STT), ElevenLabs (TTS)
- **RAG** : Qdrant Cloud + Mistral embeddings + BM25 reranking + pre-generation intent classifier + Cohere Rerank stage 2
- **Paiement** : Stripe (webhooks HMAC signés) + RevenueCat (à migrer vers signature JWT — voir SP4)
- **Storage** : Scaleway S3 (presigned URLs, RGPD fr-par)
- **Pronote** : Pawnote 1.6 + AES-256-GCM (PBKDF2 600K iterations — salt aléatoire par enregistrement à implémenter SP1)
- **Observabilité** : à installer (Sentry + structured logging avec `requestId`)

## Architecture

- **Routes** (`src/routes/`) : endpoints fins — parse + validation + délégation service
- **Services** (`src/services/`) : logique métier. Un service par domaine : chat, billing, learning, pronote, quota, subscription, storage
- **Repositories** (`src/db/repositories/`) : data access Drizzle — une méthode = une requête typée
- **Middleware** (`src/middleware/`) : auth, rate-limit, memory-monitor
- **Schemas** (`src/schemas/`) : validation Zod pour toutes les requests entrantes
- **Config** (`src/config/`) : configuration app (feature flags, limites, validation env au boot)

### Modules principaux

- **Chat** (`src/services/chat/`) : orchestration Gemini, summarization, tool execution, token budget, SSE streaming, intent classifier + Cohere Rerank, mémoire épisodique pgvector
- **Billing** : Stripe + RevenueCat. Logique à extraire en `BillingService` unique (voir SP5) — aujourd'hui dupliquée entre webhook handlers
- **Learning** : FSRS (spaced repetition), decks, cards, generations. Logique à extraire en `LearningService` + repositories (voir SP5)
- **Subscription** : checkout, lifecycle, gestion enfants (role parent), usage quotas
- **Quota** : token quota windowed (5h rolling + daily cap) derrière flag `QUOTA_ENFORCEMENT_ENABLED`
- **RAG** : recherche unifiée Qdrant + BM25 + Cohere Rerank optionnel
- **Pronote** : auth QR code, devoirs, notes, emploi du temps (SSRF protection)
- **Storage** : upload presigned Scaleway, confirmation, sync Gemini Files API

## Patterns

- **JAMAIS de logique métier dans les route handlers** → toujours déléguer au service
- **JAMAIS d'accès DB direct depuis une route** → passer par le repository correspondant
- **TOUJOURS valider les inputs** avec Zod schemas (`src/schemas/`)
- **Auth** : `handleAuthWithCookies` middleware, JAMAIS de vérification manuelle
- **Webhooks** : signature cryptographique obligatoire (HMAC Stripe, JWT RevenueCat), jamais Bearer statique seul
- **Transactions** : `db.transaction(...)` pour toute opération multi-table (ex: créer deck + cards)
- **Presigned URLs** pour uploads (frontend → Scaleway direct, bypass backend)
- **Feature flags** via `app.config.ts` (ex: `quotaEnforcementEnabled`) pour déploiements progressifs
- **Observabilité `requestId`** : à propager middleware → service (AsyncLocalStorage ou param explicite)

## Sécurité

- **Secrets** : fail-fast au boot si variables prod manquantes (`environment.config.ts`)
- **PBKDF2 Pronote** : 600K iterations, salt **aléatoire 16 bytes par enregistrement** préfixé au ciphertext (SP1)
- **CORS** : origines whitelist en prod, `credentials: true`, `maxAge: 86400`
- **Headers** : HSTS (prod), X-Frame-Options DENY, X-Content-Type-Options nosniff, Permissions-Policy restrictive
- **Rate limiting** : `RateLimitPresets.api` global, `RateLimitPresets.pronote` renforcé sur credentials

## Migrations Drizzle

Source de vérité : `src/db/schema.ts`. Règles détaillées : @../../.claude/rules/database-migrations.md
- **Dev local** : `db:push` après modif schema
- **Prod/staging** : `db:generate` → commit SQL → `docker-entrypoint.sh migrate.ts` auto

## Tests

- **Runner** : Bun test (`bun run test`)
- **Localisation** : `src/tests/<service>.test.ts`
- **Couverture critique** : webhooks (signatures, idempotence, replay), services de billing, quota enforcement, encryption round-trip, transactions multi-table

## Sources officielles

[Elysia.js](https://elysiajs.com) | [Drizzle ORM](https://orm.drizzle.team) | [Better Auth](https://better-auth.com) | [Gemini API](https://ai.google.dev) | [Stripe Webhooks](https://docs.stripe.com/webhooks) | [RevenueCat Webhooks v2](https://www.revenuecat.com/docs/integrations/webhooks/webhooks-v2)
