---
name: dev-bootstrap
description: Démarrer le monorepo depuis un clone neuf, ou réparer une stack locale qui ne monte pas — postgres, migrations Drizzle. À utiliser quand le serveur refuse de démarrer, qu'une table manque, qu'une base locale porte un ancien schéma, ou qu'on part d'une base vide.
---

# Premier démarrage, et réparation d'une stack locale

## Le chemin normal

```bash
bun install
bun run setup         # .env depuis .env.example, BETTER_AUTH_SECRET, postgres, migrations
bun run dev           # postgres prêt, migrations, puis les apps
```

`bun run dev` lance `docker compose up -d --wait postgres`, puis `db:migrate` du serveur, puis
`turbo run dev` : si postgres ne répond pas ou si une migration échoue, rien ne démarre. Le
serveur tourne sur l'hôte, pas en conteneur.

## Le serveur refuse de démarrer

Il refuse tant qu'une migration du journal (`apps/server/drizzle/`) n'est pas appliquée, et le
dit dans son log (« Migrations not applied »). `bun run db:migrate` (`apps/server`) les
applique. Il n'y a pas de `db:push` : il contournerait le journal que le serveur vérifie.

## Une base locale qui porte un ancien schéma

La refonte du 2026-10-06 repart d'une baseline neuve : une base créée avant, avec l'ancien
schéma, fait échouer la migration (« relation already exists »). Il faut la recréer. Ce sont des
données locales, sans élève réel, mais leur suppression ne se rattrape pas : la commande se
lance à la main.

```bash
docker compose down -v   # détruit le volume postgres, donc les données locales
bun run setup
```

## `.env` qui suffit à démarrer

Le schéma, ses valeurs par défaut et ses contrôles : `apps/server/src/config.ts`. En dev, seuls
`DATABASE_URL` et `BETTER_AUTH_SECRET` sont requis ; `apps/server/.env.example` donne les
valeurs de la stack locale.

## Les tests

Ceux du serveur tournent sur le même Postgres : chaque fichier crée sa base et la supprime, ce
qui demande un utilisateur autorisé à créer des bases (celui de `docker compose` l'est). La
suite de bout en bout du web utilise sa propre base, `tom_e2e`, recréée à chaque lancement.
