---
description: Migrations Drizzle — chargé uniquement sur le schéma DB et les migrations
paths:
  - "apps/server/src/db/**"
  - "apps/server/drizzle/**"
  - "apps/server/drizzle.config*.ts"
  - "**/schema.ts"
---

# Migrations Drizzle ORM

Source de verite : `apps/server/src/db/schema.ts` (codebase-first).

## Dev local : `db:push`

```bash
# 1. Modifier src/db/schema.ts
# 2. docker compose up -d
# 3. bun run db:push (sync direct, pas de fichier SQL)
```

## Production : `db:generate` + `db:migrate`

```bash
# 1. Modifier src/db/schema.ts
# 2. bun run db:generate (genere SQL dans ./drizzle/)
# 3. git add src/db/schema.ts drizzle/
# 4. Deploy → docker-entrypoint.sh execute migrate.ts automatiquement
```

## Interdictions

- JAMAIS `db:push` en production/staging
- JAMAIS editer `.sql` ou `_journal.json` manuellement
- JAMAIS supprimer des migrations deja appliquees en prod

## Zero-downtime

- Nouvelles colonnes → `nullable` d'abord, contrainte apres migration de donnees
- Index → `CREATE INDEX CONCURRENTLY`
- Backup AVANT toute migration destructive (DROP, ALTER TYPE)

## Diagnostic

```bash
bun run db:check    # Detecte schema drift
bun run db:studio   # Interface visuelle
```

## Concurrence au deploy (advisory lock)

Plusieurs instances Koyeb peuvent booter en parallèle et chacune lance
`docker-entrypoint.sh` → `bun dist/migrate.js`. **`drizzle-orm` 0.45.2 ne pose
aucun verrou de session** dans son migrateur `postgres-js` — vérifié dans le
code installé : `node_modules/drizzle-orm/pg-core/dialect.js`, méthode
`async migrate(migrations, session, config)` lit `lastDbMigration` puis
applique les statements dans une seule transaction, sans `pg_advisory_lock`
ni verrou équivalent (confirmé aussi en reproduisant la course : deux
`runMigrations()` concurrents sur une base neuve font échouer `CREATE
EXTENSION IF NOT EXISTS vector` avec `duplicate key value violates unique
constraint "pg_extension_name_index"`, cf.
`apps/server/src/integration-tests/migrate-lock.integration.test.ts`).
Documentation officielle (https://orm.drizzle.team/docs/migrations) ne
mentionne aucun verrou non plus.

**`apps/server/src/db/migrate.ts`** pose donc un advisory lock explicite
autour de `migrate()` (et de la création d'extension) :

```typescript
await db.execute(sql`SELECT pg_advisory_lock(hashtext('drizzle_migrate'))`);
try {
  await migrate(db, { migrationsFolder: './drizzle' });
} finally {
  await db.execute(sql`SELECT pg_advisory_unlock(hashtext('drizzle_migrate'))`);
}
```

Le lock est scopé à la session (une connexion `postgres` avec `max: 1`) : les
autres instances bloquent jusqu'à la libération, puis ne trouvent plus rien à
appliquer (no-op sûr).
