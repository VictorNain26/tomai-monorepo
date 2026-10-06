---
description: Serveur Bun + Hono — chargé uniquement sur apps/server
paths:
  - "apps/server/**"
---

# Serveur (`apps/server`)

Architecture cible et ses sources : `docs/etudes/2026-10-06/refonte-architecture.md`, qui se
reconstruit par étapes ; ce qui n'est pas encore là n'existe pas, on ne le recrée pas à côté.
Spec du tuteur : `docs/tuteur.md`. Stack locale : skill `dev-bootstrap`. Appel IA : skill
`mistral-stack`. Migrations : `.claude/rules/database-migrations.md`.

## Composition

- `src/main.ts` est la seule racine de composition : lui seul lit l'environnement
  (`loadConfig(Bun.env)`, `src/config.ts`), crée les dépendances et les passe. Aucun autre
  fichier n'importe d'état global : un service reçoit la base, le logger, la config en
  paramètre ; `createApp(deps)` construit l'app.
- Les frontières sont vérifiées au lint (`eslint-plugin-boundaries`, `eslint.config.mjs`) :
  `platform` n'importe que `platform` et la config ; `domain` rien ; un fichier hors de toute
  classification est refusé. Une nouvelle zone s'y déclare dans la PR qui la crée.

## Patterns

- **Erreurs** : RFC 9457 (`platform/http/problem.ts`). On lève `new Problem(code, detail?)`,
  un code déclaré avec son statut ; aucun try/catch dans une route, aucun corps d'erreur écrit
  à la main ; un message interne ne sort jamais.
- **Routes** : sous-apps Hono montées par `app.route()`, handler écrit après le chemin, sans
  contrôleur ([best practices Hono](https://hono.dev/docs/guides/best-practices)). Une route
  `/api` se monte avant `webClient`, sinon la page répondrait à sa place.
- **Base** : seul un repository touche `db` ; `db.transaction(...)` dès qu'une opération touche
  plusieurs tables. Une table se déclare dans un `schema.ts`, réexporté par
  `platform/db/schema.ts`.
- **Logs** : pino reçu en dépendance, contexte en premier argument
  (`logger.error({ err }, 'message')`) ; le `requestId` s'ajoute seul. Jamais de contenu d'élève.
- **Auth** : better-auth (`platform/auth/auth.ts`), sur ses propres tables. Son contrôle
  d'origine est forcé, y compris sous `NODE_ENV=test` où il se désactive sinon.

## Sécurité

- Une seule origine sert l'API et le web : pas de CORS, cookie de session limité à l'hôte, CSP
  `default-src 'self'` (`platform/http/security-headers.ts`), `no-store` sur `/api`.
- En production, TLS vérifié vers Postgres (`platform/db/client.ts`), et refus de démarrer tant
  qu'une migration du journal n'est pas appliquée.

## Tests

Sur une vraie base : `testDatabase()` (`src/testing/database.ts`) donne à chaque fichier sa
base, copiée d'un modèle migré par le preload. L'app se construit par `createApp` avec ses
vraies dépendances. Aucun `mock.module`. Détail : `.claude/rules/testing.md`.
