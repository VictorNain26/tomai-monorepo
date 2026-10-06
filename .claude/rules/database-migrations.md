---
description: Migrations Drizzle — chargé uniquement sur le schéma DB et les migrations
paths:
  - "apps/server/src/db/**"
  - "apps/server/src/**/*.schema.ts"
  - "apps/server/src/platform/db/**"
  - "apps/server/drizzle/**"
  - "apps/server/drizzle.config*.ts"
  - "**/schema.ts"
---

# Migrations Drizzle ORM

Source de vérité : les tables de chaque module, `apps/server/src/modules/*/*.schema.ts`,
réexportées par `src/db/schema.ts`, que lit `drizzle-kit` (`drizzle.config.ts`).

## Base locale

- **Base neuve** : `bun run setup` (racine), qui applique les migrations par `db:migrate`.
  Jamais `db:push` sur une base vierge : il ne crée pas la table de suivi que le serveur
  vérifie au démarrage (skill `dev-bootstrap`).
- **Itérer** sur le schéma : `bun run db:push` (`apps/server`), une fois les migrations
  appliquées.

## Livrer un changement de schéma

```bash
# depuis apps/server
bun run db:generate   # SQL dans ./drizzle/
git add src/modules/<module>/<fichier>.schema.ts drizzle/
```

Au démarrage de l'image Docker, `docker-entrypoint.sh` applique les migrations
(`dist/migrate.js`) hors `NODE_ENV=development`.

## Interdictions

- Pas de `db:push` hors d'une base locale.
- Pas d'édition manuelle des `.sql` ni de `_journal.json`.
- Une migration commitée ne se modifie ni ne se supprime : elle a pu être appliquée ailleurs.

## Changements destructifs

- Nouvelle colonne obligatoire → `nullable` d'abord, contrainte après la migration des données.
- Backup avant toute migration destructive (DROP, ALTER TYPE) sur une base qui garde des
  données.
- `migrate()` de `drizzle-orm` applique les migrations dans une transaction
  (`drizzle-orm/pg-core/dialect.js`) : `CREATE INDEX CONCURRENTLY`, que Postgres refuse dans
  une transaction ([doc](https://www.postgresql.org/docs/current/sql-createindex.html)), ne
  passe pas par ce chemin.

## Diagnostic

```bash
bun run db:check    # cohérence des snapshots de drizzle/ (malformés, collisions entre branches)
bun run db:studio   # interface visuelle
```

## Concurrence au déploiement

`src/platform/db/migrate.ts` pose un advisory lock autour de `migrate()` : `drizzle-orm` n'en pose
aucun et plusieurs instances migrent en parallèle au boot. Ne pas le retirer ; la
course est reproduite par `src/integration-tests/migrate-lock.integration.test.ts`.
