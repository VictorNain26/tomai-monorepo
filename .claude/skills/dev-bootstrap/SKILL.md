---
name: dev-bootstrap
description: Démarrer le monorepo depuis un clone neuf, ou réparer une stack locale qui ne monte pas — postgres, migrations Drizzle. À utiliser quand le serveur refuse de booter, qu'une table manque, ou qu'on part d'une base vide. Explique pourquoi db:migrate et non db:push sur une base neuve.
---

# Premier démarrage, et réparation d'une stack locale

## Le chemin normal

```bash
pnpm install
pnpm run setup         # .env, BETTER_AUTH_SECRET, postgres, migrations
pnpm dev
```

`pnpm run setup` (`scripts/setup.mjs`) enchaîne ces étapes dans l'ordre. Le reste de
cette skill sert quand il échoue, ou pour comprendre ce qu'il fait.

## Le piège : `db:migrate`, jamais `db:push`, sur une base neuve

Au boot, `server-lifecycle.ts` vérifie la table de suivi
`drizzle.__drizzle_migrations`. **`db:push` ne la crée pas** — il synchronise le
schéma directement. Sur une base vierge, un `db:push` donne donc un schéma correct
et un serveur qui refuse quand même de démarrer, ce qui est le symptôme le plus
déroutant de la stack.

Séquence manuelle si `pnpm run setup` a échoué en route (commandes `docker` depuis la
racine, `bun run` depuis `apps/server`) :

```bash
docker compose up -d postgres
docker exec tomai-postgres-dev psql -U tomai_dev -d tomai_dev \
  -c "CREATE EXTENSION IF NOT EXISTS vector;"
bun run db:migrate    # crée __drizzle_migrations ET applique le SQL
bun run dev
```

Une fois la table de suivi créée, `db:push` redevient le bon outil pour **itérer**
le schéma en local.

## `.env` minimal qui suffit à booter

Auth et DB sont les seules variables requises (`apps/server/src/config/env.ts`) ;
tout le reste est incrémental — une feature (IA, stockage, Google OAuth) échoue à
l'usage tant que sa variable manque, mais le serveur démarre.

```
NODE_ENV=development
BETTER_AUTH_SECRET=<openssl rand -base64 32>
BETTER_AUTH_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:3001
DATABASE_URL=postgresql://tomai_dev:tomai_dev_password@localhost:5432/tomai_dev
DATABASE_URL_EXTERNAL=postgresql://tomai_dev:tomai_dev_password@localhost:5432/tomai_dev
```

Sans `MISTRAL_API_KEY`, `/health` reste `healthy` (il ne sonde que la base) ;
c'est `/health/ai` qui répond 503.

## Ce que `pnpm dev` attend réellement

`scripts/dev.mjs` démarre l'infra puis attend **postgres en `healthy`** avant de
lancer les apps. Si l'infra est incomplète, les apps ne démarrent pas du tout —
c'est voulu, pas un bug.

Le backend tourne sur l'**host**, pas en conteneur : pas de collision sur `:3000`.
L'image backend iso-prod reste disponible en opt-in via
`docker compose --profile backend up`.

## Diagnostic

```bash
pnpm run doctor    # PASS/FAIL/SKIP par dépendance
pnpm doctor:e2e    # strict : un SKIP compte comme un échec
```

## Repartir d'une base vraiment propre

```bash
docker compose down -v   # détruit les volumes, donc les données locales
pnpm run setup
```

Depuis Postgres 18 (lot 0), le volume s'appelle `tomai_postgres18_dev_data`. Un
ancien volume `tomai_postgres_dev_data` (PG16) est illisible par PG18 : le
supprimer avec `docker volume rm tomai_postgres_dev_data`, puis `pnpm run setup`.
