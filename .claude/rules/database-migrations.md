---
description: Migrations Drizzle — chargé uniquement sur le schéma DB et les migrations
paths:
  - "apps/server/src/db/**"
  - "apps/server/drizzle/**"
  - "apps/server/drizzle.config.ts"
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
