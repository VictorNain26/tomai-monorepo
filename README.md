# Tom Monorepo

Tuteur IA pour les devoirs des collégiens (6e à 3e) : il aide l'élève à trouver sans
faire l'exercice à sa place, et le parent reçoit un résumé de la semaine, jamais les
conversations. Pré-lancement : aucun utilisateur en production.

## Démarrage

```bash
bun install    # Bun 1.4.2+ ; Node 24+ pour la landing
bun run setup  # .env, BETTER_AUTH_SECRET, postgres, migrations Drizzle
bun run dev    # postgres, migrations, puis server :3000 + landing :3001 + web :3002
```

Arrêt de l'infra : `bun run dev:down`. `bun run dev` attend que postgres soit prêt et que les
migrations passent ; sinon rien ne démarre.

**En refonte** depuis le 2026-10-06 (`docs/etudes/2026-10-06/refonte-architecture.md`) : le
serveur est reconstruit par étapes, et ne fait pour l'instant que l'auth, la santé et le service
du web.

## Structure

```
apps/
├── server/       # Bun + Hono — API backend (3000)
├── landing/      # Astro — vitrine SEO, statique (3001)
└── web/          # Vite + React + TanStack Router — application, téléphone d'abord (3002)

packages/
├── ui/              # Primitives shadcn sur Radix
├── tokens/          # Design tokens CSS (Tailwind v4) partagés
└── eslint-config/   # Config ESLint partagée

tooling/
└── playwright-web/  # Suite de bout en bout du web, contre le serveur construit
```

## Stack

| Couche | Technologies |
|--------|-------------|
| Backend | Bun 1.4, Hono 4, PostgreSQL 18, Drizzle ORM 0.45, pino |
| Landing | Astro 7, îlots React, TailwindCSS 4, Motion 13, `@repo/ui` (shadcn) |
| Web | Vite 8, React 19, TanStack Router, TailwindCSS 4 ; tests Playwright à largeur de téléphone (`docs/etudes/2026-10-06/client-web.md`) |
| Auth | Better Auth 1.7, e-mail et mot de passe ; foyer et comptes élèves à l'étape 4 de la refonte |
| IA | Mistral Small 4, endpoint UE, avec le tuteur à l'étape 5 de la refonte |
| Paiements | Aucun branché. Paiement web prévu au lot 3 |
| Observabilité | Logs pino ; Bugsink, auto-hébergé, pour les erreurs avec la préproduction (`docs/etudes/2026-10-07/hebergement.md`). Pas d'analytics installée |
| Monorepo | Turborepo, workspaces Bun |
| Déploiement | Landing : une application statique Clever Cloud, servie par Caddy (`apps/landing/Caddyfile`), pas encore déployée. Server : image `apps/server/Dockerfile`, qui embarque le build du web, publiée sur GHCR au SHA à chaque merge sur `main`, pas encore déployée ; hébergée chez Clever Cloud, région Paris (`docs/etudes/2026-10-07/hebergement.md`). Web : servi par le serveur, sur la même origine que l'API ; en dev, Vite (3002) envoie `/api/` au serveur par son proxy |

## Commandes

```bash
bun run typecheck && bun run lint  # validation, obligatoire avant commit
bun run format                     # Prettier, vérifié en CI et sur les fichiers indexés
bun run test                       # tests du serveur (Postgres local) et des paquets
bun run build                      # build production
bun run db:generate                # migration SQL d'un changement de schéma
```

Migrations : `.claude/rules/database-migrations.md` ; stack locale : skill `dev-bootstrap`.

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
[tuteur IA](./docs/tuteur.md).
