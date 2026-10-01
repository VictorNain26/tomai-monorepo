# Plan — `build/bun-package-manager`

Première des deux PR « outillage Bun » du lot 0 (`roadmap.md`, point 5) : `bun install`
remplace pnpm. La seconde passera les scripts sous Bun et traitera le reste de la liste
« Lot 0 — outillage » du suivi.

## Pré-vol (2026-10-01, contre `main` à `ef24712`)

Ce que pnpm porte aujourd'hui et son équivalent Bun 1.4.2 :

| pnpm (`pnpm-workspace.yaml`, `package.json`) | Bun | Source |
|---|---|---|
| `packages: apps/*, packages/*` | `workspaces` du `package.json` racine | doc Bun, `guides/install/from-npm-install-to-bun-install.mdx` |
| `minimumReleaseAge: 1440` (minutes) | `[install] minimumReleaseAge = 86400` (secondes), `bunfig.toml` | doc Bun, `runtime/bunfig.mdx` |
| `allowBuilds` (scripts d'install autorisés) | `trustedDependencies`, qui remplace la liste par défaut de Bun | doc Bun, `guides/install/trusted.mdx` |
| `overrides` | `overrides` du `package.json` racine | doc Bun, `pm/overrides` |
| `catalog:` | voir l'arbitrage ci-dessous | — |
| `pnpm --filter`, `pnpm exec` | `bun --filter`, `bunx` | doc Bun, `pm/filter.mdx` |
| `pnpm audit --prod --audit-level high` | `bun audit --audit-level=high --prod`, sortie 1 si une vulnérabilité reste | doc Bun, `pm/cli/audit.mdx` |

Outils tiers :

- **Vercel** détecte `bun.lock` et lance `bun install` pour Bun ≥ 1.2
  (https://vercel.com/docs/package-managers, mise à jour 2026-08-11).
- **Turborepo** gère Bun en stable depuis la 2.6 (blog `turbo-2-6.mdx`).
- **Renovate** gère `bun.lock` et sa maintenance (https://docs.renovatebot.com/modules/manager/bun/),
  mais **pas encore les catalogs de Bun** : renovatebot/renovate#42909, ouverte le
  2026-10-01.
- **sherif** gère Bun et sa règle `multiple-dependency-versions` impose une version unique
  par dépendance (https://github.com/QuiiBz/sherif).

### Arbitrages

- **Catalogs retirés.** Sans support Renovate, un catalog Bun ne serait plus mis à jour,
  sans aucun signal. Les 12 entrées du catalog redeviennent des versions explicites dans
  chaque `package.json`. sherif, déjà en CI, empêche qu'elles divergent, et les groupes
  Renovate existants (`react`, `tailwind`, `eslint`) les montent ensemble. Le retour des
  catalogs passe en surveillance, déclenché par la fusion de #42909.
- **Docker sans `turbo prune`.** Le lockfile élagué par `turbo prune` échoue sous
  `bun install --frozen-lockfile` dans des cas proches du nôtre (turborepo, fixtures
  `bun-v1-issue-12653` et `bun-v1-issue-12744`). L'image copie les `package.json` de
  tous les workspaces et installe le seul serveur avec
  `bun install --frozen-lockfile --filter tomai-server` (doc Bun, `pm/filter.mdx`).
  Node et pnpm sortent de l'image.
- **Node reste** pour ce qui en dépend : la landing Next.js, qui tourne sous Node sur
  Vercel et dont le build en CI suit, et `.nvmrc`.

## Tâches

1. **Bascule** : `workspaces`, `trustedDependencies`, `overrides` et `packageManager`
   dans le `package.json` racine ; `bunfig.toml` ; versions explicites à la place de
   `catalog:` ; `bun install` génère `bun.lock` ; `pnpm-lock.yaml` et
   `pnpm-workspace.yaml` supprimés. Les scripts racine passent de `pnpm` à `bun`.
2. **Outillage** : `lefthook.yml`, `.github/actions/setup-monorepo` (`setup-bun`,
   `bun install --frozen-lockfile`), `ci.yml`, `security.yml` (`bun audit`), `docker.yml`
   (chemins), `claude-code.yml` (commandes autorisées), `.claude/settings.json`,
   `apps/landing/vercel.json`, Dockerfile, `.dockerignore`, Renovate.
3. **Doc et messages** : toutes les commandes `pnpm` de la doc (`README.md`, `CLAUDE.md`,
   `apps/*/CLAUDE.md`, `apps/server/README.md`, `.claude/`, `SECURITY.md`) et des messages
   des scripts (`scripts/*.mjs`, `.env.example`, `docker-compose.yml`).
4. Suivi et roadmap, puis suppression de ce plan.

## Validation

`bun install --frozen-lockfile` sur un clone propre ; `bun run typecheck`,
`bun run lint`, `bun run test`, `bun run test:scripts`, `bunx knip`, `bunx sherif` ;
`docker build` de l'image de production en local, puis le job CI ; build de la landing ;
preview Vercel au vert sur la PR.
