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
- **AI** : **Stack 100 % Mistral souveraine EU** — modèle par tâche (voir ADR-0001) :
  - Embeddings : `mistral-embed` (1024D)
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
- **RAG** : Qdrant Cloud + Mistral embeddings + sparse BM25 IDF natif (hybrid RRF côté server).
  Curriculum index dans repo séparé `tomai-curriculum/` (voir son CLAUDE.md).
- **Paiement** : Stripe (webhooks HMAC signés) + RevenueCat (à migrer vers signature JWT — voir SP4)
- **Storage** : Scaleway S3 (presigned URLs, RGPD fr-par)
- **Pronote** : Pawnote 1.6 + AES-256-GCM (PBKDF2 600K iterations — salt aléatoire par enregistrement à implémenter SP1)
- **Observabilité** : à installer (Sentry + structured logging avec `requestId` + OTel GenAI semconv envisagé)

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
- **Billing** : Stripe + RevenueCat. Logique à extraire en `BillingService` unique (voir SP5) — aujourd'hui dupliquée entre webhook handlers
- **Learning** : FSRS (spaced repetition), decks, cards (génération `mistral-small` + JSON Schema), generations. Logique à extraire en `LearningService` + repositories (voir SP5)
- **Subscription** : checkout, lifecycle, gestion enfants (role parent), usage quotas
- **Quota** : token quota windowed (5h rolling + daily cap) derrière flag `QUOTA_ENFORCEMENT_ENABLED`
- **RAG** : recherche unifiée Qdrant hybrid native (dense Mistral + sparse BM25 IDF + fusion RRF). Pas de Cohere (souveraineté EU).
- **Pronote** : auth QR code, devoirs, notes, emploi du temps (SSRF protection)
- **Storage** : upload presigned Scaleway, confirmation. Multimodal chat consomme directement le blob Scaleway (base64 inline pour photos, `extractedText` côté record pour PDFs). Pas de cache fichier externe (Mistral n'a pas d'équivalent à Gemini Files API).

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

[Elysia.js](https://elysiajs.com) | [Drizzle ORM](https://orm.drizzle.team) | [Better Auth](https://better-auth.com) | [Mistral API](https://docs.mistral.ai/api/) | [Mistral Models](https://docs.mistral.ai/getting-started/models/models_overview/) | [Stripe Webhooks](https://docs.stripe.com/webhooks) | [RevenueCat Webhooks v2](https://www.revenuecat.com/docs/integrations/webhooks/webhooks-v2)
