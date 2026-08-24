# Tom Monorepo

Assistant scolaire IA socratique pour élèves français, avec supervision parentale
et intégration Pronote. Pré-lancement : aucun utilisateur en production.

## Démarrage

```bash
pnpm install                 # Node 22+, pnpm 11+
docker login ghcr.io         # 1× — image ai-service privée sur GHCR, password = PAT read:packages
pnpm setup                   # .env, BETTER_AUTH_SECRET, postgres, migrations Drizzle, pull ai-service + modèles
pnpm dev                     # infra Docker + server :3000 + landing :3001
pnpm dev:mobile              # Expo (8081), terminal séparé
```

Arrêt de l'infra : `pnpm dev:down`. Documentation d'API en dev :
http://localhost:3000/swagger

`pnpm dev` démarre l'infra puis **attend que postgres et qdrant soient `healthy`**
avant de lancer les apps ; si l'infra est incomplète, rien ne démarre. `pnpm doctor`
donne le détail, `pnpm doctor:e2e` la version stricte où un `SKIP` ou un `degraded`
compte comme un échec.

### RAG et Qdrant

Deux chemins coexistent, et la confusion entre les deux est la source d'erreur
habituelle :

- `docker-compose.yml` embarque un **Qdrant local** (`:6333`), démarré par défaut et
  attendu par `pnpm dev`.
- Le serveur, lui, ne pointe nulle part tant que `QDRANT_URL` est vide dans
  `apps/server/.env` — c'est le défaut de `.env.example`. Renseigner `QDRANT_URL`,
  `QDRANT_API_KEY` et `QDRANT_COLLECTION` (les trois seules vides ; `QDRANT_ENABLED`
  est déjà à `true` dans le gabarit) pour viser **Qdrant Cloud**, l'index de référence
  partagé dev/prod, déjà ingéré.

Sans ces variables, `/health` rapporte le check qdrant en `not_configured` : le
serveur reste `healthy`, mais le RAG est simplement absent. Pour viser le Qdrant
local à la place, `apps/server/.env.example` en donne les valeurs en commentaire.
Pour (re)peupler un index : `apps/curriculum/README.md`.

## Structure

```
apps/
├── server/       # Bun + Elysia — API backend (3000)
├── landing/      # Next.js — vitrine SEO (3001)
├── mobile/       # Expo — app parents et élèves (8081)
├── ai-service/   # FastAPI (uv) — embeddings BGE-M3 pour le RAG (8001)
└── curriculum/   # Python uv — indexation des programmes officiels

(ai-service et curriculum sont des apps Python : hors workspace pnpm, exclues de turbo)

packages/
├── api/             # Client Eden Treaty typé — le contrat serveur → clients
├── ui/              # Primitives shadcn (DOM) — landing uniquement, jamais l'app Expo
├── tokens/          # Design tokens Tailwind v4 partagés
└── eslint-config/   # Config ESLint partagée
```

## Stack

| Couche | Technologies |
|--------|-------------|
| Backend | Bun 1.3, Elysia 1.4, PostgreSQL 16 + pgvector, Drizzle ORM 0.45 |
| Landing | Next.js 16, TailwindCSS 4, Framer Motion, `@repo/ui` (shadcn) |
| Mobile | Expo SDK 56, React Native 0.85, NativeWind 5 (preview) |
| Auth | Better Auth 1.6 + Google OAuth, comptes élèves par username |
| Chat | Vercel AI SDK 7 (`streamText` + `useChat`), un seul protocole client/serveur |
| IA | Mistral — chat, vision Pixtral, OCR, TTS et STT Voxtral. Stack 100 % EU |
| RAG | Qdrant (Cloud en référence) + BGE-M3 dense/sparse via `apps/ai-service`, fusion RRF |
| Vie scolaire | Pronote via `pawnote`, **serveur uniquement** (lib GPL, tokens rotatifs) |
| Paiements | RevenueCat — IAP natif, source unique de facturation |
| Stockage | Scaleway S3 (fr-par), uploads par URL présignée |
| Observabilité | Sentry initialisé sur server, landing et mobile. La région dépend du DSN, absent du dépôt. Pas d'analytics installée |
| Monorepo | Turborepo, pnpm workspaces |
| Déploiement | Cibles : Vercel (landing), Koyeb (server, ai-service), EAS (mobile). Aucune config d'infra n'est versionnée ici, et rien n'est déployé aujourd'hui |

## Commandes

```bash
pnpm typecheck && pnpm lint   # validation, obligatoire avant commit
pnpm test                     # server (Bun), mobile (Jest), tokens (Bun)
pnpm build                    # build production
pnpm seed                     # comptes parent + élève, dev uniquement
pnpm db:generate              # migrations Drizzle, pour la prod
pnpm db:push                  # sync direct du schéma, dev local uniquement
```

## Git

`main` est la seule branche permanente : jamais de push direct, toujours une PR,
et merge commit — jamais de squash.

## Documentation

`README.md` (ici) décrit la stack et le démarrage ; `CLAUDE.md` porte les
instructions destinées aux agents. L'architecture, les décisions et les chantiers
ouverts vivent dans [`docs/`](./docs/README.md).

Chaque app a sa propre doc : [server](./apps/server/CLAUDE.md) ·
[mobile](./apps/mobile/CLAUDE.md) · [landing](./apps/landing/CLAUDE.md) ·
[ai-service](./apps/ai-service/README.md) · [curriculum](./apps/curriculum/README.md)
