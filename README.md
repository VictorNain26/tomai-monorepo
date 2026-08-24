# Tom Monorepo

Assistant scolaire IA socratique pour élèves français, avec supervision parentale
et intégration Pronote. Pré-lancement : aucun utilisateur en production.

## Démarrage

```bash
pnpm install                 # Node 22+, pnpm 11+
pnpm setup                   # .env, BETTER_AUTH_SECRET, postgres, migrations Drizzle
pnpm dev                     # infra Docker + server :3000 + landing :3001
pnpm dev:mobile              # Expo (8081), terminal séparé
```

Arrêt de l'infra : `pnpm dev:down`. Documentation d'API en dev :
http://localhost:3000/swagger

`pnpm dev` démarre l'infra puis **attend que postgres soit `healthy`** avant de
lancer les apps ; si l'infra est incomplète, rien ne démarre. `pnpm doctor` donne
le détail, `pnpm doctor:e2e` la version stricte où un `SKIP` compte comme un échec.

## Structure

```
apps/
├── server/       # Bun + Elysia — API backend (3000)
├── landing/      # Next.js — vitrine SEO (3001)
└── mobile/       # Expo — app parents et élèves (8081)

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
| Vie scolaire | Pronote via `pawnote`, **serveur uniquement** (lib GPL, tokens rotatifs) |
| Paiements | RevenueCat — IAP natif, source unique de facturation |
| Stockage | Scaleway S3 (fr-par), uploads par URL présignée |
| Observabilité | Sentry initialisé sur server, landing et mobile. La région dépend du DSN, absent du dépôt. Pas d'analytics installée |
| Monorepo | Turborepo, pnpm workspaces |
| Déploiement | Cibles : Vercel (landing), Koyeb (server), EAS (mobile). Aucune config d'infra n'est versionnée ici, et rien n'est déployé aujourd'hui |

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
instructions destinées aux agents.

Chaque app a sa propre doc : [server](./apps/server/CLAUDE.md) ·
[mobile](./apps/mobile/CLAUDE.md) · [landing](./apps/landing/CLAUDE.md)
