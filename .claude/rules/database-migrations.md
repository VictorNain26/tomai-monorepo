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

- Pas de `db:push` en production ni en staging.
- Pas d'édition manuelle des `.sql` ni de `_journal.json`.
- Pas de suppression d'une migration déjà appliquée en prod.

## Zero-downtime

- Nouvelles colonnes → `nullable` d'abord, contrainte apres migration de donnees
- Index → `CREATE INDEX CONCURRENTLY`
- Backup AVANT toute migration destructive (DROP, ALTER TYPE)

## Diagnostic

```bash
bun run db:check    # Detecte schema drift
bun run db:studio   # Interface visuelle
```

## Concurrence au deploy

`src/platform/db/migrate.ts` pose un advisory lock autour de `migrate()` : `drizzle-orm` n'en pose
aucun et plusieurs instances migrent en parallèle au boot. Ne pas le retirer ; la
course est reproduite par `src/integration-tests/migrate-lock.integration.test.ts`.
