# TomAI Server

Backend Bun + Hono du tuteur IA pour collégiens (produit :
`docs/vision.md`).

## Quick Start

```bash
# 1. Copier les variables d'environnement
cp .env.example .env

# 2. Remplir BETTER_AUTH_SECRET (openssl rand -base64 32) ; `bun run setup`
#    à la racine fait 1 et 2, plus postgres et les migrations

# 3. Démarrer depuis la racine du monorepo (PostgreSQL Docker + backend :3000 sur l'host)
bun run dev

# 4. Verifier
curl http://localhost:3000/health
```

## Stack

| Composant | Technologie |
|-----------|-------------|
| Runtime | Bun 1.4 |
| Framework | Hono 4 |
| Database | PostgreSQL 18 |
| ORM | Drizzle ORM 0.45 |
| Auth | Better Auth 1.7 + Google OAuth |
| AI Chat | Mistral Small 4 (`mistral-small-2603`, streaming + tools + vision), endpoint UE |
| Stockage | Scaleway Object Storage (S3, RGPD France) |
| STT | Voxtral (`voxtral-mini-2602`) |
| TTS | Voxtral (`voxtral-mini-tts-2603`) |
| Paiements | Aucun branché (paiement web au lot 3) |

## Commands

```bash
# Dev (depuis la racine du monorepo)
bun run dev                             # PostgreSQL Docker + backend avec hot-reload
docker compose --profile backend up -d  # Backend conteneurise (image iso-prod, opt-in)

# Validation
bun run typecheck                       # TypeScript strict
bun run lint                            # ESLint zero warnings

# Database
bun run db:push                         # Dev: sync schema → DB
bun run db:generate                     # Prod: generer migration SQL
bun run db:migrate                      # Prod: appliquer migrations
bun run db:check                        # Verifier sync schema ↔ DB
bun run db:studio                       # Drizzle Studio UI

# Outils Docker (optionnel)
docker compose --profile tools up -d    # Adminer (8080) + Drizzle Studio (4983)
```

## Docker Services

| Service | Port | Description |
|---------|------|-------------|
| backend | 3000 | API conteneurisee (profile: backend) |
| postgres | 5432 | PostgreSQL 18 |
| drizzle-studio | 4983 | UI Database (profile: tools) |
| adminer | 8080 | Client SQL (profile: tools) |

## Environment Variables

Requises pour booter : `DATABASE_URL` et `BETTER_AUTH_SECRET` (en production, aussi
`BETTER_AUTH_URL`). Toutes les autres sont optionnelles : la feature concernée échoue à l'usage
tant que sa variable manque (Google OAuth, Mistral, Scaleway). Liste complète,
défauts et contraintes : `src/platform/config/env.ts` ; gabarit commenté : `.env.example`.

### Dev seed (`bun run seed`)

Les variables ci-dessous peuplent la DB avec des comptes de test locaux (`bun run seed`) et sont **refusées en production**. Présentes par défaut dans `.env.example` :

| Variable | Valeur (défaut) | Usage |
|----------|-----------------|-------|
| `SEED_PARENT_EMAIL` | `dev.parent@tomai.local` | Login parent Tomia web |
| `SEED_PARENT_PASSWORD` | `DevParent123!` | Login parent Tomia web |
| `SEED_CHILD_USERNAME` | `dev.eleve` | Login enfant Tomia (accès autonome) |
| `SEED_CHILD_PASSWORD` | `DevEleve123!` | Login enfant Tomia (accès autonome) |

## Architecture

```
src/
├── index.ts                    # Point d'entree, jobs de fond, graceful shutdown
├── app.ts                      # App Hono : middlewares, routes, AppType
├── platform/                   # Socle sans regle metier
│   ├── config/                 # env.ts (variables validees au boot)
│   ├── db/                     # Migrateur runtime
│   ├── auth/                   # better-auth, lecture de session
│   ├── http/                   # Contexte Hono, gardes, validation, erreurs, rate limit
│   ├── observability/          # Logger pino, OpenTelemetry, Sentry
│   ├── ai/                     # Client Mistral
│   └── lifecycle/              # Verification au demarrage, arret
├── modules/                    # Un dossier par module (docs/architecture.md)
│   └── voice/                  # TTS et transcription Voxtral
├── db/                         # Client Drizzle, schema, repositories (composition)
├── config/                     # Configuration IA, education, prompts
├── routes/                     # Routes pas encore rangees dans un module
├── services/                   # Services pas encore ranges dans un module
└── types/                      # Types TypeScript partages
```

## Docker Build (Production)

Multi-stage : base (Bun) → build (install filtré sur le serveur, typecheck, lint, bundle) → production.

```bash
# Entrypoint : migrations auto avant demarrage
docker-entrypoint.sh → bun dist/migrate.js → bun --smol dist/index.js
```
