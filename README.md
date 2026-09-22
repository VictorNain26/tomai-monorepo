# Tom Monorepo

Assistant scolaire IA socratique pour élèves français, avec supervision parentale
et intégration Pronote. Pré-lancement : aucun utilisateur en production.

## Démarrage

```bash
pnpm install                 # Node 24+, pnpm 12+
pnpm setup                   # .env, BETTER_AUTH_SECRET, postgres, migrations Drizzle
pnpm dev                     # infra Docker + server :3000 + landing :3001
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
└── landing/      # Next.js — vitrine SEO (3001)

packages/
├── api/             # Client Eden Treaty typé — le contrat serveur → clients
├── ui/              # Primitives shadcn (DOM)
├── tokens/          # Design tokens CSS (Tailwind v4) partagés
└── eslint-config/   # Config ESLint partagée
```

## Stack

| Couche | Technologies |
|--------|-------------|
| Backend | Bun 1.4, Elysia 1.4, PostgreSQL 18 + pgvector, Drizzle ORM 0.45 |
| Landing | Next.js 16, TailwindCSS 4, Motion 13, `@repo/ui` (shadcn) |
| Auth | Better Auth 1.7 + Google OAuth, comptes élèves par username |
| Chat | Vercel AI SDK 7 (`streamText` + `useChat`), un seul protocole client/serveur |
| IA | Mistral Small 4 — chat, vision multimodale, OCR, TTS et STT Voxtral. Stack 100 % EU |
| Vie scolaire | Pronote via `pawnote`, **serveur uniquement** (lib GPL, tokens rotatifs) |
| Paiements | Aucun branché. Paiement web prévu au lot 3 |
| Stockage | Scaleway S3 (fr-par), uploads par URL présignée |
| Observabilité | Sentry initialisé sur server et landing. La région dépend du DSN, absent du dépôt. Pas d'analytics installée |
| Monorepo | Turborepo, pnpm workspaces |
| Déploiement | Cibles : Vercel (landing), Koyeb (server). Aucune config d'infra n'est versionnée ici, et rien n'est déployé aujourd'hui |

## Commandes

```bash
pnpm typecheck && pnpm lint   # validation, obligatoire avant commit
pnpm test                     # server (Bun)
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
[landing](./apps/landing/CLAUDE.md)
