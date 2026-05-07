# Server Tom

Backend Bun + Elysia.js — tutorat socratique adaptatif, RAG Qdrant, intégration Pronote, billing RevenueCat.

## Commandes

```bash
docker compose up -d              # OBLIGATOIRE : PostgreSQL 16 + Backend
bun run typecheck && bun run lint # Validation
bun run test
bun run build
```

Ne jamais lancer `bun run dev` sans PostgreSQL actif.

## Stack

- **Runtime** : Bun + Docker Compose
- **Framework** : Elysia.js (type-safe API, Eden Treaty exposé via `@repo/api`)
- **DB** : PostgreSQL 16 + pgvector + Drizzle ORM
- **Cache** : LRU in-memory (pas de Redis)
- **Auth** : Better Auth + Google OAuth
- **AI** : Mistral 100% — chat, embeddings, STT/TTS Voxtral, OCR (souveraineté EU)
- **RAG** : Qdrant Cloud + mistral-embed + BM25 reranking + Cohere Rerank stage 2
- **Paiement** : RevenueCat (mobile IAP, source unique)
- **Storage** : Scaleway S3 (RGPD fr-par)
- **Pronote** : Pawnote + AES-256-GCM
- **Observabilité** : Sentry + structured logs avec `requestId` (à installer)

## Architecture

Layers strictes — chaque appel descend `route → service → repository` :
- **Routes** (`src/routes/`) : parse + validation + délégation. Aucune logique métier.
- **Services** (`src/services/`) : un service par domaine (chat, billing, learning, pronote, quota, storage…).
- **Repositories** (`src/db/repositories/`) : data access Drizzle. Une méthode = une requête typée.
- **Middleware** (`src/middleware/`) : auth, rate-limit, memory-monitor.
- **Schemas** (`src/schemas/`) : validation Zod pour toute requête entrante.
- **Config** (`src/config/`) : env validée au boot, fail-fast en prod si secret manquant.

Pour ajouter une feature : crée la route, délègue au service, qui appelle le repository. Si le service touche Mistral, importe depuis `src/lib/mistral-client.ts`. Si tu hésites, lis un module existant similaire avant d'écrire.

## Patterns à respecter

- **Logique métier** : dans le service, jamais dans la route.
- **Accès DB** : via repository, jamais en direct depuis une route ou un service d'un autre domaine.
- **Validation** : Zod systématique sur toute entrée externe.
- **Auth** : middleware `handleAuthWithCookies`, jamais de check manuel.
- **Webhooks** : signature timing-safe + idempotence via `webhook_events`.
- **Multi-table writes** : `db.transaction(...)` obligatoire.
- **Uploads** : presigned URLs Scaleway, pas de proxy par le backend.
- **Feature flags** : via `app.config.ts` pour rollouts progressifs.
- **Logs** : propage `requestId` du middleware au service (AsyncLocalStorage ou param).

## Sécurité

- Secrets : fail-fast au boot, jamais committés.
- Pronote : AES-256-GCM, PBKDF2 600K iter, salt aléatoire par enregistrement.
- CORS, HSTS, X-Frame-Options, rate limiting : configurés par défaut.

## Migrations Drizzle

Source de vérité : `src/db/schema.ts`. Règles : @../../.claude/rules/database-migrations.md
- Dev local : `bun run db:push`
- Prod/staging : `bun run db:generate` → commit SQL → `docker-entrypoint.sh migrate.ts` (auto)

## Tests

- Runner Bun (`bun run test`), localisation `src/tests/<service>.test.ts`.
- Couverture critique : webhooks (signatures, idempotence, replay), billing, quota, encryption round-trip, transactions.

## Sources officielles

[Elysia](https://elysiajs.com) | [Drizzle](https://orm.drizzle.team) | [Better Auth](https://better-auth.com) | [Mistral AI](https://docs.mistral.ai) | [RevenueCat](https://www.revenuecat.com/docs)
