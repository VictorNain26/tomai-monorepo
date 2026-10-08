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

Un compte parent se crée sur invitation, en bêta fermée comme en production :
`cd apps/server && bun run invite <adresse>` (`bun dist/invite.js <adresse>` dans l'image).

Arrêt de l'infra : `bun run dev:down`. `bun run dev` attend que postgres soit prêt et que les
migrations passent ; sinon rien ne démarre.

**En refonte** depuis le 2026-10-06 (`docs/etudes/2026-10-06/refonte-architecture.md`) ; ce qui
est fait et ce qui reste : `docs/suivi.md`.

## Structure

```
apps/
├── server/       # Bun + Hono — API backend (3000)
├── landing/      # Astro — vitrine SEO, statique (3001)
└── web/          # Vite + React + TanStack Router — application, téléphone d'abord (3002)

packages/
├── ui/              # Primitives shadcn du web ; ses classes servent aussi la landing (`@repo/ui/classes`)
├── tokens/          # Design tokens CSS (Tailwind v4) partagés
└── eslint-config/   # Config ESLint partagée

tooling/
└── playwright-web/  # Suite de bout en bout du web, contre le serveur construit
```

## Stack

| Couche | Technologies |
|--------|-------------|
| Backend | Bun 1.4, Hono 4, PostgreSQL 18, Drizzle ORM 0.45, pino |
| Landing | Astro 7, statique et sans framework client, TailwindCSS 4, Motion 13 (API vanilla), classes de `@repo/ui` |
| Web | Vite 8, React 19, TanStack Router, TailwindCSS 4 ; tests Playwright à largeur de téléphone (`docs/etudes/2026-10-06/client-web.md`) |
| Auth | Better Auth 1.7 : le gardien entre par un code envoyé à son adresse, sans mot de passe, sur invitation pendant la bêta fermée ; l'appareil de l'élève est relié par un code |
| IA | Mistral Small 4, endpoint UE (`docs/tuteur.md`) |
| Paiements | Aucun branché. Paiement web prévu au lot 3 |
| Observabilité | Logs pino ; Bugsink, auto-hébergé, pour les erreurs avec la préproduction (`docs/etudes/2026-10-07/hebergement.md`). Pas d'analytics installée |
| Monorepo | Turborepo, workspaces Bun |
| Déploiement | Landing : une application statique Clever Cloud, servie par Caddy (`apps/landing/Caddyfile`), pas encore déployée. Server : image `apps/server/Dockerfile`, qui embarque le build du web, publiée sur GHCR au SHA à chaque merge sur `main`, pas encore déployée ; elle le sera chez Clever Cloud, région Paris, en staging à chaque merge, puis en production sur approbation (`docs/architecture.md`, « Environnements et livraison »). Web : servi par le serveur, sur la même origine que l'API ; en dev, par le proxy de Vite (`apps/web/vite.config.ts`) |

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

`main` est la seule branche permanente, sans branche par environnement ; la façon d'y entrer est dans `CLAUDE.md`, « Interdits ».

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
