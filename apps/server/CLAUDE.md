# CLAUDE.md - TomAI Server

**Backend Bun + Elysia.js** d'une plateforme de tutorat socratique adaptatif pour étudiants français. Architecture moderne avec orchestration IA et authentification Better Auth.

## Règle absolue

**JAMAIS** inventer de solutions backend. **TOUJOURS** rechercher documentation officielle avant toute modification.

### Processus obligatoire :
1. **WebFetch** documentation officielle
2. **Read/Grep** patterns backend existants
3. **Docker Compose** validation (JAMAIS `bun run dev`)
4. **Implémentation** evidence-based

## Stack

- **Runtime** : Bun 1.3 + Docker Compose (PostgreSQL 16 pgvector + Redis 7)
- **Framework** : Elysia.js 1.4.19 (type-safe API)
- **Database** : PostgreSQL 16 + Drizzle ORM 0.45.1 (Drizzle Kit 0.31.8)
- **Auth** : Better Auth 1.4.7 + Google OAuth
- **AI** : Google Gemini 2.5 Flash (chat), Mistral AI (embeddings 1024D), Gladia (STT), ElevenLabs (TTS)
- **Cache** : Redis 7 (ioredis 5.4.1 + @upstash/redis 1.35.8)
- **Vector Search** : Qdrant Cloud direct + Mistral embeddings 1024D + BM25 reranking
- **Pronote** : Pawnote 1.6.2 + AES-256-GCM encryption (PBKDF2 600K iterations)

## Commandes

```bash
# INTERDIT: bun run dev (JAMAIS)

# OBLIGATOIRE: Docker Compose uniquement
docker compose up -d

# Validation
bun run typecheck    # TypeScript strict
bun run lint         # ESLint zero warnings
bun run build        # Build production
```

## Sources officielles

- **Elysia.js** : https://elysiajs.com/quick-start.html - API patterns type-safe
- **Drizzle ORM** : https://orm.drizzle.team/docs/overview - Schema, queries
- **Better Auth** : https://better-auth.com/docs/installation - Server config
- **Bun Runtime** : https://bun.sh/docs - Performance, Docker
- **Google Gemini** : https://ai.google.dev/gemini-api/docs - API optimisée, adhérence 97%
- **pgvector** : https://github.com/pgvector/pgvector - PostgreSQL vector extension pour RAG

## Règles strictes

### Migrations base de données

**SOURCE OF TRUTH** : `src/db/schema.ts` est la SEULE source de vérité.

```bash
# Workflow standard (dev → prod)
1. vim src/db/schema.ts        # Modifier schema uniquement
2. docker compose up -d         # Stack complète requise
3. bun run db:push             # Test rapid prototyping
4. bun run db:generate         # Génère migration pour prod
5. git add src/db/schema.ts drizzle/
6. git commit -m "feat(db): Description"
7. git push origin main        # Koyeb applique automatiquement
```

**Interdictions absolues:**
- JAMAIS éditer `.sql` ou `.json` manuellement
- JAMAIS supprimer migrations appliquées en prod
- JAMAIS modifier `drizzle.__drizzle_migrations__` directement

**Diagnostic rapide:**
```bash
bun run db:studio              # Interface Drizzle Studio
bun run db:check               # Détecte schema drift
bun run scripts/check-migration-state.ts  # État migrations
```

**Guide complet:** Voir `/docs/DATABASE_MIGRATIONS.md` pour:
- Architecture Runtime Migrator détaillée
- Scénarios de troubleshooting
- Garanties anti-régression
- Workflow avancés (ENUMs, reset, etc.)

### Docker OBLIGATOIRE pour Développement
```bash
# CORRECT : Stack complète (PostgreSQL 16 + Redis 7 + Backend)
docker compose up -d

# ALTERNATIF : Services + dev local
docker compose up -d postgres redis && bun run dev

# INTERDIT : Runtime direct sans services
bun run dev  # ÉCHOUE si PostgreSQL/Redis non accessibles
```

### Architecture Patterns
- **Services** : Business logic séparée des routes
- **Repositories** : Data access layer avec Drizzle
- **Validation** : Zod schemas pour toutes requests
- **Error Handling** : Types erreur + logging structuré
- **Auth Middleware** : Better Auth session validation

### TypeScript Strict
```typescript
// CORRECT : Types explicites, null handling
async function processUser(user: User | null): Promise<ProcessedUser> {
  if (!user) {
    throw new ValidationError('User is required');
  }
  return await processValidUser(user);
}

// INTERDIT : Any types, null non-géré
async function processUser(user: any) {
  return await processValidUser(user);
}
```

## Structure

```
src/
├── index.ts                         # Point d'entrée principal
├── app.ts                           # Configuration Elysia app
├── services/
│   ├── rag.service.ts              # RAG unifié (search + rerank)
│   ├── qdrant.service.ts           # Client Qdrant Cloud direct
│   ├── mistral-embeddings.service.ts # Embeddings Mistral 1024D
│   ├── rerank.service.ts           # BM25 + RRF reranking
│   ├── gemini-simple.service.ts    # Gemini 2.5 Flash direct
│   ├── redis-cache.service.ts      # Gestion cache Redis
│   ├── chat.service.ts             # Orchestration chat socratique
│   ├── education.service.ts        # Matières/niveaux disponibles
│   └── pronote.service.ts          # Pronote QR auth + SSRF protection
├── routes/                          # API endpoints
│   ├── api.routes.ts               # Routes principales
│   ├── chat-message.routes.ts      # Chat streaming
│   ├── establishment.routes.ts     # Établissements scolaires
│   └── pronote.routes.ts           # Intégration Pronote (QR code auth)
├── db/
│   ├── schema.ts                   # Drizzle schema
│   ├── connection.ts               # Configuration DB
│   └── repositories/               # Data access layer
├── lib/
│   ├── auth.ts                     # Better Auth config
│   ├── encryption.ts               # AES-256-GCM + PBKDF2 (Pronote)
│   ├── redis.service.ts            # Client Redis
│   └── observability.ts            # Monitoring
├── middleware/                      # Auth, monitoring, memory
├── config/                          # Configuration app
├── schemas/                         # Validation Zod
└── types/                           # Types partagés
```

## Better Auth

```typescript
// Configuration server
export const auth = betterAuth({
  database: db,
  emailAndPassword: { enabled: true },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
});

// Middleware obligatoire
async function requireAuth({ request: { headers }, set }) {
  const session = await auth.api.getSession({ headers });
  if (!session?.user) {
    set.status = 401;
    return { error: 'Unauthorized' };
  }
  return { user: session.user };
}
```

## Pronote Integration

Intégration sécurisée avec Pronote via QR code (bypass ENT/CAS).

### Architecture Sécurité
- **Encryption** : AES-256-GCM avec PBKDF2 (600K iterations, OWASP 2023)
- **SSRF Protection** : Allowlist domaines Pronote autorisés
- **Rate Limiting** : 5 req/15min par utilisateur sur `/connect`
- **Validation Startup** : Test encrypt/decrypt cycle au démarrage

### Fichiers clés
```
src/
├── lib/encryption.ts           # AES-256-GCM + PBKDF2
├── services/pronote.service.ts # Pawnote wrapper + SSRF protection
├── routes/pronote.routes.ts    # API endpoints (student role only)
└── db/schema.ts               # Table pronote_connections
```

### Endpoints (students only)
| Endpoint | Description |
|----------|-------------|
| `POST /api/pronote/connect` | Connexion QR code + PIN |
| `DELETE /api/pronote/disconnect` | Suppression connexion |
| `GET /api/pronote/status` | Statut connexion |
| `GET /api/pronote/homework` | Devoirs (weekOffset) |
| `GET /api/pronote/grades` | Notes période courante |
| `GET /api/pronote/timetable` | Emploi du temps |

### Variables d'environnement
```bash
# Générer avec: openssl rand -base64 48
PRONOTE_ENCRYPTION_KEY=<64 chars base64>
```

## Seed RAG Data (Optionnel)

**Note** : Le seed RAG (415 documents + 2,271 chunks) doit être recréé via ingestion manuelle.

```bash
# Option 1: Ingestion depuis fichiers source
bun run scripts/ingest-production-data.sh

# Option 2: Si backup SQL disponible
DATABASE_URL="..." bun run scripts/seed-rag.ts
```

**Fichiers requis** :
- Documents programmes officiels (CP → Terminale)
- Embeddings Mistral 1024D générés
- Format : SQL INSERT statements avec ON CONFLICT DO NOTHING

## Extended Thinking - Problèmes complexes

**Niveaux de réflexion pour décisions critiques:**

| Niveau | Usage | Exemple Backend |
|--------|-------|-----------------|
| `"think"` (~4K tokens) | Analyse multi-fichiers | RAG pipeline optimization |
| `"think hard"` (~10K tokens) | Architecture système | Redis vs pgvector caching |
| `"think harder"` (~20K tokens) | Redesign critique | Microservices split |
| `"ultrathink"` (~32K tokens) | Transformation majeure | Self-hosted Ollama migration |

**Prompts recommandés:**
```bash
"think hard about optimizing database queries for dashboard analytics"
"think harder about refactoring Gemini service for multi-provider support"
"ultrathink migrating from Bun to Node.js for ecosystem compatibility"
```

**Guide complet:** Voir `/docs/EXTENDED_THINKING.md` pour:
- Quand utiliser chaque niveau
- Examples TomIA spécifiques (RAG, auth, migrations)
- Best practices et coûts

---

## Documentation locale

**Dossier `docs/`** (non versionné Git, local uniquement) :
- `DATABASE_MIGRATIONS.md` - Guide complet migrations Drizzle ORM
- `REDIS_TROUBLESHOOTING.md` - Résolution problèmes Redis
- `OPTIMIZATIONS_2025.md` - Optimisations performance
- Fichiers existants (audits, workflows, seeding)

**Pratique** : Documentation de référence locale, ne PAS commiter (`.gitignore` exclut `docs/`)

## Validation pré-commit

```bash
docker compose ps       # Services actifs
bun run typecheck       # Zero erreur TypeScript strict
bun run lint            # Zero warnings ESLint
bun run build           # Build production successful
```

Checklist :
- Documentation officielle vérifiée
- Patterns Elysia.js respectés
- Migrations validées: `bun run db:generate` (si schema modifié)

## Mission

Ce backend sert de **VRAIES familles françaises**. Chaque API endpoint impacte l'éducation d'enfants réels.

**Standards** : Bun + Elysia.js + TypeScript strict + Performance <200ms + Better Auth + Docker production-ready