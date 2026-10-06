# Tom Monorepo

Tuteur IA pour les devoirs des collégiens (6e à 3e) : il aide l'élève à trouver sans
faire l'exercice à sa place, et le parent reçoit un résumé de la semaine, jamais les
conversations. Pré-lancement : aucun utilisateur en production.

## Démarrage

```bash
bun install    # Bun 1.4.2+ ; Node 24+ pour la landing
bun run setup  # .env, BETTER_AUTH_SECRET, postgres, migrations Drizzle
bun run dev    # infra Docker + server :3000 + landing :3001 + web :3002
```

Arrêt de l'infra : `bun run dev:down`.

`bun run dev` démarre l'infra puis **attend que postgres soit `healthy`** avant de
lancer les apps ; si l'infra est incomplète, rien ne démarre. `bun run doctor` donne
le détail, `bun run doctor:e2e` la version stricte où un `SKIP` compte comme un échec.

## Structure

```
apps/
├── server/       # Bun + Hono — API backend (3000)
├── landing/      # Next.js — vitrine SEO (3001)
└── web/          # Vite + React + TanStack Router — application, téléphone d'abord (3002)

packages/
├── api/             # Client typé (hono/client) — le contrat serveur → clients
├── ui/              # Primitives shadcn (DOM)
├── tokens/          # Design tokens CSS (Tailwind v4) partagés
└── eslint-config/   # Config ESLint partagée
```

## Stack

| Couche | Technologies |
|--------|-------------|
| Backend | Bun 1.4, Hono 4, PostgreSQL 18, Drizzle ORM 0.45 |
| Landing | Next.js 16, TailwindCSS 4, Motion 13, `@repo/ui` (shadcn) |
| Web | Vite 8, React 19, TanStack Router, TailwindCSS 4 ; tests Playwright à largeur de téléphone (`docs/etudes/2026-10-06/client-web.md`) |
| Auth | Better Auth 1.7 + Google OAuth, comptes élèves par username |
| Chat | Vercel AI SDK 7 (`streamText` + `useChat`), un seul protocole client/serveur |
| IA | Mistral Small 4 — chat, vision multimodale, OCR, TTS et STT Voxtral. Stack 100 % EU |
| Paiements | Aucun branché. Paiement web prévu au lot 3 |
| Stockage | Scaleway S3 (fr-par), uploads par URL présignée |
| Observabilité | Sentry initialisé sur server et landing. La région dépend du DSN, absent du dépôt. Pas d'analytics installée |
| Monorepo | Turborepo, workspaces Bun |
| Déploiement | Landing : Vercel (`apps/landing/vercel.json`), previews de branche déployées. Server : image `apps/server/Dockerfile`, rien de déployé ; hébergeur tranché au lot 3 |

## Commandes

```bash
bun run typecheck && bun run lint  # validation, obligatoire avant commit
bun run test                       # tests server (Bun) ; scripts et hooks : bun run test:scripts
bun run build                      # build production
bun run seed                       # comptes parent + élève, dev uniquement
bun run db:generate                # migrations Drizzle, pour la prod
bun run db:push                    # sync direct du schéma, dev local uniquement
```

## Git

`main` est la seule branche permanente : jamais de push direct, toujours une PR,
et merge commit — jamais de squash.

## Documentation

`README.md` (ici) décrit la stack et le démarrage ; `CLAUDE.md` porte les
instructions destinées aux agents, et `.claude/rules/` celles qui ne valent que pour une
partie du code, chargées sur ses chemins.

Produit et avancement, dans `docs/` :
[vision produit](./docs/vision.md) (pour qui,
promesse, prix, périmètre) · [roadmap](./docs/roadmap.md) ·
[suivi](./docs/suivi.md) (où on en est) · specs techniques
[cible V1](./docs/architecture.md) et
[agent IA](./docs/tuteur.md).
