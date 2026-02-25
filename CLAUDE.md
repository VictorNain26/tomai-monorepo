# Monorepo Tom

## Commandes

```bash
pnpm install                      # Installation
pnpm dev                          # Landing:3001 + Server:3000
pnpm dev:mobile                   # Expo mobile (8081)
pnpm typecheck && pnpm lint       # Validation (obligatoire avant commit)
pnpm build                        # Build production
```

**Backend necessite Docker** (PostgreSQL 16 + pgvector) :
```bash
cd apps/server && docker compose up -d
```

## Stack

| Couche | Technologies |
|--------|-------------|
| Backend | Bun, Elysia.js 1.4, PostgreSQL 16 pgvector, MemoryCacheService (LRU in-memory), Drizzle ORM |
| Landing | Next.js 16, TailwindCSS 4, Framer Motion |
| Mobile | Expo SDK 54, React Native 0.81, NativeWind, React Native Reusables |
| Auth | Better Auth + Google OAuth |
| AI | Gemini 2.5 Flash (chat), Mistral (embeddings 1024D), Gladia (STT), ElevenLabs (TTS) |
| RAG | Qdrant Cloud + Mistral embeddings + BM25 reranking |
| Paiement | Stripe (web) + RevenueCat (mobile) |
| Storage | Scaleway Object Storage (S3-compatible, RGPD, fr-par) |
| Monorepo | Turborepo, pnpm workspaces |
| Deploy | Vercel (landing), Koyeb (server), EAS (mobile) |

## Apps

| App | Path | Port | Package name |
|-----|------|------|-------------|
| Landing | `apps/landing/` | 3001 | `landing` |
| Server | `apps/server/` | 3000 | `tomai-server` |
| Mobile | `apps/mobile/` | 8081 | `tom-mobile` |

## Packages partages

- `packages/api/` : Client API (Eden Treaty)
- `packages/shared-types/` : Types TypeScript partages

## Git workflow

- **`staging`** : travail quotidien, push direct OK, CI automatique
- **`main`** : production, JAMAIS de push direct, toujours via PR depuis staging
- **Merge commit uniquement** : JAMAIS squash merge (desynchronise les branches)

## CI/CD

| App | Plateforme | Trigger |
|-----|-----------|---------|
| Landing | Vercel | Auto sur push |
| Server | Koyeb | Auto sur push main |
| Mobile | EAS Build | Manuel via workflows |

## Regles detaillees

Voir `.claude/rules/` pour : migrations DB, securite, workflow Git.
