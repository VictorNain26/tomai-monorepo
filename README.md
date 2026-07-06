# Tom Monorepo

Plateforme de tutorat IA adaptatif pour élèves français — pédagogie socratique, intégration Pronote.

## Quick Start

```bash
pnpm install                 # Node 22+, pnpm 11+
docker login ghcr.io         # image ai-service privée (GHCR), 1× — password = PAT avec read:packages
pnpm setup                   # one-time : .env, secret, postgres, migrations, pull ai-service + modèles (~3,5 Go)
pnpm dev            # infra Docker (postgres+qdrant+ai-service) + server :3000 + landing :3001
pnpm dev:mobile     # Expo mobile (8081), terminal séparé
pnpm doctor         # vérifie la stack complète end-to-end : docker, conteneurs, qdrant, ai-service, migrations, RAG roundtrip
```

Stop infra : `pnpm dev:down`. API docs (dev) : http://localhost:3000/swagger

> `pnpm dev` effectue un fail-fast sur l'infra Docker avant de lancer les apps : si postgres, qdrant ou ai-service est absent ou unhealthy, les apps ne démarrent pas. Lancer `pnpm doctor` pour le détail complet.

> **RAG (programmes officiels)** : l'index vit sur **Qdrant Cloud — source unique de vérité** (partagée dev + prod, déjà ingérée). Renseigne `QDRANT_URL` + `QDRANT_API_KEY` (+ `QDRANT_ENABLED=true`, `QDRANT_COLLECTION`) dans `apps/server/.env` — valeurs auprès de l'équipe, gabarit dans `.env.example`. Aucune ingestion locale nécessaire. Sans ces vars, l'app tourne en `degraded` (RAG off). Pour (re)peupler l'index ou bosser 100 % offline : voir `apps/curriculum/README.md`.

## Structure

```
apps/
├── server/      # Bun + Elysia.js — API backend (port 3000)
├── landing/     # Next.js 16 — site vitrine SEO (port 3001)
├── mobile/      # Expo SDK 56 — app universelle iOS/Android/web (port 8081)
└── ai-service/  # Python FastAPI — embeddings BGE-M3 (RAG)

packages/
├── api/             # Client Eden Treaty typé (contrat serveur → clients)
├── ui/              # Composants shadcn partagés (landing)
├── tokens/          # Design tokens Tailwind v4 partagés
└── eslint-config/   # Config ESLint partagée
```

## Stack

| Couche | Technologies |
|--------|-------------|
| Backend | Bun 1.3, Elysia.js 1.4, PostgreSQL 16 pgvector, Drizzle ORM |
| Landing | Next.js 16, TailwindCSS 4, shadcn/ui |
| Mobile / Web | Expo SDK 56, React Native 0.85, NativeWind v5 — app universelle (ADR 0001) |
| Auth | Better Auth 1.6 + Google OAuth |
| AI | Mistral (chat, vision, OCR, TTS Voxtral), Gladia (STT) — stack 100 % EU |
| RAG | Qdrant Cloud + BGE-M3 hybrid (via `apps/ai-service`) |
| Paiements | RevenueCat (mobile IAP, source unique de facturation) |
| Stockage | Scaleway S3 (RGPD, fr-par) |
| Deploy | Vercel (landing), Koyeb (server + ai-service), EAS (mobile natif ; web Expo → Vercel ou EAS Hosting, ADR 0001) |

## Commandes

```bash
pnpm typecheck && pnpm lint   # Validation (obligatoire avant commit)
pnpm test                     # Tests (server: Bun, mobile: Jest)
pnpm build                    # Build production
pnpm db:generate              # Migrations Drizzle (prod)
pnpm db:push                  # Sync schéma (dev local uniquement)
```

## Git workflow

- `main` est la seule branche permanente — jamais de push direct, toujours une PR
- Merge commit uniquement (jamais de squash)

## Documentation

Source de vérité : les `CLAUDE.md` de chaque app.
[Racine](./CLAUDE.md) · [Server](./apps/server/CLAUDE.md) · [Mobile](./apps/mobile/CLAUDE.md) · [AI service](./apps/ai-service/README.md) · [Curriculum / index RAG](./apps/curriculum/README.md)
