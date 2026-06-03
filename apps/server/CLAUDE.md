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

### Premier démarrage dev local (vérifié)

Sur une base **neuve**, `db:push` seul ne suffit pas : le serveur vérifie au boot la table de suivi `drizzle.__drizzle_migrations` (cf. `server-lifecycle.ts`), que `db:push` ne crée pas. Séquence qui marche (auth-only, aucun secret de prod) :

```bash
# 1. apps/server/.env minimal (secrets JETABLES) :
#    NODE_ENV=development
#    BETTER_AUTH_SECRET=<openssl rand -base64 32>
#    BETTER_AUTH_URL=http://localhost:3000
#    CORS_ORIGINS=http://localhost:3001,http://localhost:3002
#    DATABASE_URL=postgresql://tomai_dev:tomai_dev_password@localhost:5432/tomai_dev
#    DATABASE_URL_EXTERNAL=postgresql://tomai_dev:tomai_dev_password@localhost:5432/tomai_dev
docker compose up -d postgres
docker exec tomai-postgres-dev psql -U tomai_dev -d tomai_dev -c "CREATE EXTENSION IF NOT EXISTS vector;"
bun run db:migrate   # crée __drizzle_migrations + applique le SQL (PAS db:push sur une base neuve)
bun run dev          # serveur sur :3000 (status "degraded" si MISTRAL_API_KEY absent = normal)
```

`db:push` reste OK pour **itérer le schéma ensuite** (la table de suivi existe déjà). Les features AI/RAG/billing échouent à l'usage tant que leur var n'est pas définie (env incrémental) — l'auth, elle, ne requiert que `BETTER_AUTH_SECRET` + `DATABASE_URL`.

## Stack

- **Runtime** : Bun 1.3 + Docker Compose
- **Framework** : Elysia.js 1.4 (type-safe API, Eden Treaty exposé aux clients via `@repo/api`)
- **Database** : PostgreSQL 16 pgvector + Drizzle ORM 0.45
- **Cache** : MemoryCacheService (LRU in-memory avec TTL) — PAS de Redis
- **Auth** : Better Auth 1.5 + Google OAuth + account linking + cookieCache
- **AI** : **Stack 100 % Mistral souveraine EU** — modèle par tâche (voir ADR-0001) :
  - Embeddings (RAG) : `BAAI/bge-m3` dense+sparse via `apps/ai-service/` (Python, Koyeb fra)
  - Reranker (RAG) : `BAAI/bge-reranker-v2-m3` co-hosté dans `apps/ai-service/`
  - Embeddings (mémoire épisodique) : `mistral-embed` (1024D)
  - Chat tutorat principal : `mistral-medium-latest` (streaming + tools)
  - Reasoning math complexe : `magistral-small-latest` (router conditionnel)
  - Tâches simples (titre, classif, génération templatée) : `ministral-3b/8b` ou `mistral-small`
  - Extraction structurée nuancée (épisodes, analyses) : `mistral-medium-latest`
  - Vision (photos d'exercices) : `mistral-medium-latest` (multimodal natif depuis Pixtral fusion)
  - OCR documents : `mistral-ocr-25.12`
  - TTS : `voxtral-tts-26.03` (FR, voice cloning, EU)
  - STT : Gladia (Paris, EU OK)
  - **Migration Gemini → Mistral terminée** : `@google/genai` retiré du
    `package.json`, aucun appel sortant Google côté runtime.
- **RAG** : Qdrant Cloud + BGE-M3 dense+sparse (via `apps/ai-service/`) + hybrid RRF natif Qdrant + rerank cross-encoder.
  Curriculum index dans repo séparé `tomai-curriculum/` (voir son CLAUDE.md).
- **Paiement** : RevenueCat uniquement (mobile IAP, source unique de facturation). Webhooks protégés par secret partagé `REVENUECAT_WEBHOOK_AUTH` (≥32 chars, comparaison timing-safe)
- **Storage** : Scaleway S3 (presigned URLs, RGPD fr-par)
- **Pronote** : Pawnote 1.6 + AES-256-GCM (PBKDF2 600K iterations — salt aléatoire par enregistrement à implémenter SP1)
- **Observabilité** : OpenTelemetry (GenAI semconv pour les appels Mistral, `db.*` pour Qdrant). Init dans `src/index.ts` via `setupOtel()` avant tout import applicatif. Console exporter en dev, OTLP HTTP en prod (`OTEL_EXPORTER_OTLP_ENDPOINT`). Sentry à ajouter quand on en aura le besoin métier.

## Couche AI — pattern centralisé

**Accès Mistral via `src/lib/ai/mistral-client.ts`** (jamais via SDK direct dans les services) :

- `generateText({ messages, model, temperature, maxTokens, promptCacheKey, timeoutMs })` — completion non-streaming
- `generateStructured<T>({ ..., schema })` — JSON Schema strict (élimine retry parsing)
- `chatStream({ messages, tools, ... })` — streaming SSE pour le chat

Best practices token (cf ADR-0001 D4) :
- `prompt_cache_key` versionné sur tout service à system prompt stable (-90 % cached tokens)
- `max_tokens` strict par tâche (titre 64, classif 80, résumé 2048, chat 1024)
- JSON Schema strict pour toute sortie structurée
- Batch API pour jobs offline (-50 %)
- Choix modèle par tâche (jamais `mistral-large` par défaut — réserver aux cas où medium échoue)

## Architecture

- **Routes** (`src/routes/`) : endpoints fins — parse + validation + délégation service
- **Services** (`src/services/`) : logique métier. Un service par domaine : chat, billing, learning, pronote, quota, subscription, storage
- **Repositories** (`src/db/repositories/`) : data access Drizzle — une méthode = une requête typée
- **Middleware** (`src/middleware/`) : auth, rate-limit, memory-monitor
- **Schemas** (`src/schemas/`) : validation Zod pour toutes les requests entrantes
- **Config** (`src/config/`) : configuration app (feature flags, limites, validation env au boot)

### Modules principaux

- **Chat** (`src/services/chat/`) : orchestration Mistral, summarization, tool execution, token budget, SSE streaming, intent classifier (ministral-8b), mémoire épisodique pgvector (mistral-medium extraction).
- **Billing** (`src/services/billing/`) : `BillingService` unique, piloté par les webhooks RevenueCat (`src/routes/revenuecat-webhook-*.ts`). Mutations idempotentes sur `family_billing` + `user_subscriptions`. Idempotence stockée dans `webhook_events` (TTL 7 jours).
- **Learning** : FSRS (spaced repetition), decks, cards (génération `mistral-small` + JSON Schema), generations. Logique à extraire en `LearningService` + repositories (voir SP5)
- **Subscription** (`src/routes/subscription/`) : routes lecture seule — `GET /api/subscriptions/status` (état famille + enfants) et `GET /api/subscriptions/usage` (tokens). Les achats/annulations passent par RevenueCat côté mobile ; le backend ne fait AUCUN appel provider sortant.
- **Quota** : token quota windowed (5h rolling + daily cap) derrière flag `QUOTA_ENFORCEMENT_ENABLED`
- **RAG** : recherche unifiée Qdrant hybrid native (dense BGE-M3 + sparse BGE-M3 + fusion RRF) + reranker `bge-reranker-v2-m3` cross-encoder. Embeddings + rerank servis par `apps/ai-service/` (Python FastAPI, Koyeb fra). Pas de Cohere (souveraineté EU). Déploiement : `apps/ai-service/README.md`.
- **Pronote** : auth QR code, devoirs, notes, emploi du temps (SSRF protection)
- **Storage** : upload presigned Scaleway, confirmation. Multimodal chat consomme directement le blob Scaleway (base64 inline pour photos, `extractedText` côté record pour PDFs). Pas de cache fichier externe (Mistral n'a pas d'équivalent à Gemini Files API).

## Patterns

- **JAMAIS de logique métier dans les route handlers** → toujours déléguer au service
- **JAMAIS d'accès DB direct depuis une route** → passer par le repository correspondant
- **TOUJOURS valider les inputs** avec Zod schemas (`src/schemas/`)
- **Auth** : `handleAuthWithCookies` middleware, JAMAIS de vérification manuelle
- **Webhooks** : RevenueCat utilise un secret partagé (`REVENUECAT_WEBHOOK_AUTH`) comparé en timing-safe ; fail-fast au boot si absent ou trop court (<32 chars) en prod. Idempotence via `webhook_events` (dédup sur event id).
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

[Elysia.js](https://elysiajs.com) | [Drizzle ORM](https://orm.drizzle.team) | [Better Auth](https://better-auth.com) | [Mistral API](https://docs.mistral.ai/api/) | [Mistral Models](https://docs.mistral.ai/getting-started/models/models_overview/) | [BGE-M3](https://huggingface.co/BAAI/bge-m3) | [RevenueCat Webhooks v2](https://www.revenuecat.com/docs/integrations/webhooks/webhooks-v2)
