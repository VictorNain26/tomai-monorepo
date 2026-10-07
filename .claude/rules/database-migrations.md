---
description: Migrations Drizzle — chargé uniquement sur le schéma DB et les migrations
paths:
  - "apps/server/src/**/schema.ts"
  - "apps/server/src/platform/db/**"
  - "apps/server/drizzle/**"
  - "apps/server/drizzle.config*.ts"
---

# Migrations Drizzle ORM

Source de vérité : les `schema.ts`. `drizzle-kit` (`drizzle.config.ts`) lit
`src/platform/db/schema.ts`, qui réexporte les tables de better-auth
(`src/platform/auth/schema.ts`), et `src/modules/*/schema.ts` : `platform` n'importe aucun module.

## Base locale

`bun run db:migrate` (`apps/server`) applique les migrations ; `bun run dev` à la racine le fait
avant de lancer les apps. Pas de `db:push` : il ne passe pas par le journal, et le serveur
refuse de démarrer tant qu'une migration du journal n'est pas appliquée.

## Livrer un changement de schéma

```bash
# depuis apps/server
bun run db:generate   # SQL dans ./drizzle/
git add src/<chemin>/schema.ts drizzle/
```

Le job Migration Sync de la CI vérifie que le SQL commité correspond au schéma. Au démarrage
de l'image Docker, `docker-entrypoint.sh` applique les migrations (`dist/migrate.js`) hors
`NODE_ENV=development`.

## Interdictions

- Pas d'édition manuelle des `.sql` ni de `_journal.json`.
- Une migration commitée ne se modifie ni ne se supprime : elle a pu être appliquée ailleurs.

## Changements destructifs

- Jamais une colonne obligatoire ajoutée d'emblée à une table qui a des lignes : `nullable`
  d'abord, la contrainte après la migration des données.
- Jamais une migration destructive (DROP, ALTER TYPE) sans sauvegarde, sur une base qui garde des
  données.
- `migrate()` de `drizzle-orm` applique les migrations dans une transaction
  (`drizzle-orm/pg-core/dialect.js`) : `CREATE INDEX CONCURRENTLY`, que Postgres refuse dans
  une transaction ([doc](https://www.postgresql.org/docs/current/sql-createindex.html)), ne
  passe pas par ce chemin. Tant qu'aucune base ne garde de données réelles, un `CREATE INDEX`
  simple suffit. Ensuite, sur une grosse table : créer l'index à la main avec
  `CREATE INDEX CONCURRENTLY IF NOT EXISTS` avant le déploiement, et écrire la migration avec
  `CREATE INDEX IF NOT EXISTS` du même nom, qui ne fait alors plus rien et ne verrouille pas les
  écritures.

## Concurrence au déploiement

`runMigrations` (`src/platform/db/migrations.ts`) pose un advisory lock autour de `migrate()` :
`drizzle-orm` n'en pose aucun et plusieurs instances migrent en parallèle au démarrage. Ne pas le
retirer ; la course est reproduite par `src/platform/db/migrations.test.ts`.

## Diagnostic

```bash
bun run db:check    # cohérence des snapshots de drizzle/ (malformés, collisions entre branches)
bun run db:studio   # interface visuelle
```
