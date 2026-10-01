# Plan — `refactor/server-cleanup`

Première des trois PR d'E2, la troisième PR du lot 0 (`roadmap.md`). Chemins relatifs à
`apps/server/src/` sauf mention contraire.

## Découpage d'E2

E2 regroupe onze chantiers sans lien entre eux : ensemble, ils ne forment pas une PR
qui se relit seule. Il est donc découpé en trois PR, dans cet ordre :

1. **`refactor/server-cleanup`** (celle-ci) : code mort du serveur, validation des routes
   parent, rate limit, variables et déclarations mortes. Elle passe en premier parce
   qu'elle supprime des sites que le codemod du logger toucherait sinon.
2. **Logger** : pino à la place de `lib/observability.ts`, puis codemod du motif `_error`.
3. **Outillage** : scripts, CI, `knip.json`, montage compose, lockfile, `appleWebApp` de
   la landing, skill `dev-bootstrap`.

`roadmap.md` et `suivi.md` enregistrent ce découpage dans cette PR.

## Pré-vol (2026-10-01, contre `main` à `985d8d0`)

- Les constats du suivi (22 et 23 septembre) tiennent. Écarts : le motif `_error`
  compte maintenant 125 sites dans 53 fichiers (PR 2). `memory-cache.service.ts` exporte
  `cacheService`, pas `memoryCacheService` ; son seul consommateur est
  `routes/api/health.routes.ts`. `memoryMonitor` est démarré dans
  `services/server-lifecycle.ts` et arrêté dans `index.ts`.
- **Pool** : le serveur utilise postgres.js (`db/connection.ts`), qui met une requête en
  file quand ses `max` connexions sont occupées (README de porsager/postgres,
  `_autodocs/api-reference/connection-management.md`, « Queue Management »).
  `db/pool-limiter.ts` refait donc ce que le driver fait déjà.
- **rate-limiter-flexible** (v11.2.1 du 2026-09-17, 3,6 M de téléchargements par semaine,
  dépôt actif) : `RateLimiterMemory({ points, duration, keyPrefix })`. `consume(key)`
  résout un `RateLimiterRes` (`remainingPoints`, `msBeforeNext`) et rejette avec un
  `RateLimiterRes` quand la limite est dépassée (wiki « Memory » et `llms.txt` du dépôt
  animir/node-rate-limiter-flexible).
- **Validation** : Elysia 1.4.30 accepte un schéma Standard Schema, donc Zod, comme `body`
  d'une route et en infère les types, y compris pour Eden (documentation Elysia,
  `docs/essential/validation.md`, « Standard Schema »).

### Arbitrages

- **Zod en Standard Schema plutôt qu'un portage en TypeBox.** Le suivi prévoyait une
  seule validation TypeBox, mais TypeBox ne transforme pas (trim, minuscules du nom
  d'utilisateur) et n'exprime pas la borne d'âge 5–19 ans : il faudrait les réécrire à
  la main dans le handler. `createChildSchema` et `updateChildSchema` deviennent
  directement le `body` des deux routes ; le doublon TypeBox et l'appel manuel à
  `validateSchema` disparaissent. La règle « Validation HTTP en TypeBox » de
  `apps/server/CLAUDE.md` est amendée : TypeBox par défaut, Zod en Standard Schema quand
  la règle a besoin de transformations ou de raffinements.
- **Réponse d'erreur** : une erreur de validation passe par le gestionnaire global
  (400 `{ error: { code: 'VALIDATION_ERROR', message }, requestId }`) au lieu du corps
  `{ error: 'Validation Error', message }` propre à ces routes. Aucun client, changement
  libre. À vérifier en pré-vol de la tâche 2 : le gestionnaire traite une erreur Standard
  Schema comme une erreur TypeBox.
- **Rate limit** : un `RateLimiterMemory` par appel à `createRateLimitMiddleware`, donc un
  compteur par limiteur (corrige le partage de clé). L'en-tête `X-RateLimit-*`, le 429 et
  son corps, et le 503 en cas d'erreur du limiteur restent. Seuls les presets `api` et `ai`
  restent ; `auth`, `upload` et `public` n'ont pas de consommateur.
- **Santé** : `/health` perd son contrôle `cache`, qui répondait toujours `healthy`.
- **`LOG_LEVEL`** reste dans `config/env.ts` : la PR 2 le branche sur pino.

## Tâches

Une tâche = un commit, typecheck et lint verts à chacun.

### 1. Code mort — `refactor(server)`

- Supprimés : `services/memory-cache.service.ts` et `tests/memory-cache.test.ts`,
  `middleware/memory-monitor.middleware.ts`, `db/pool-limiter.ts`, dépendance `p-limit`.
- `routes/api/health.routes.ts` : contrôle `cache` retiré. `tests/health-routes.test.ts`
  vérifie que la réponse ne porte plus que la base, saine et en panne.
- `services/server-lifecycle.ts` : log « In-memory cache ready » et
  `memoryMonitor.startMonitoring` retirés. `index.ts` : import et étape `stopMonitoring`
  de `createGracefulShutdown` retirés.
- `services/parent/parent-dashboard.service.ts` : `withPoolLimit` retiré, les requêtes
  partent directement dans `Promise.all`.
- Mocks devenus inutiles retirés de `tests/server-lifecycle-shutdown.test.ts`,
  `tests/parent-service.test.ts` et `integration-tests/api-endpoints.test.ts`.

### 2. Validation des routes parent — `refactor(parent)`

- `routes/api/parent.routes.ts` : `body: createChildSchema` (POST `/parent/children`) et
  `body: updateChildSchema` (PATCH `/parent/children/:id`) ; les `t.Object` en double,
  l'appel à `validateSchema`, le log et la réponse 400 maison disparaissent.
- `schemas/validation.ts` : ne garde que les deux schémas parent et ce qu'ils composent.
  `registerSchema`, `loginSchema`, `chatSessionSchema`, `chatMessageSchema`,
  `streamChatQuerySchema`, `emailSchema`, `validateSchema`, `isValidationError` et les
  types `Validation*` partent (aucun consommateur hors tests).
- `tests/validation.test.ts` : ne garde que les cas des deux schémas parent.
- Nouveau test de route (`tests/parent-routes-validation.test.ts`) : un corps invalide
  (âge hors bornes, mot de passe faible, aucun champ en PATCH) reçoit 400
  `VALIDATION_ERROR` sans appeler le service ; un corps valide arrive au service avec
  le nom d'utilisateur en minuscules et les noms sans espaces autour.
- `integration-tests/api-endpoints.test.ts` : mock de `schemas/validation` retiré.

### 3. Rate limit — `refactor(server)`

- `middleware/rate-limit.middleware.ts` réécrit sur `rate-limiter-flexible` : même
  signature `createRateLimitMiddleware(config)`, mêmes en-têtes et corps de réponse ;
  `setInterval`, `Map` partagée, `skipSuccessfulRequests` et presets sans consommateur
  retirés. `defaultKeyGenerator` inchangé.
- `tests/rate-limit.test.ts` : passage sous la limite, 429 avec `Retry-After` au-delà, 503
  quand le limiteur lève, et non-régression du bug : deux limiteurs aux plafonds
  différents ne partagent pas leur compteur pour une même clé.
  `tests/rate-limit-ordering.test.ts` inchangé.

### 4. Variables et déclarations mortes — `refactor(server)`

- `config/env.ts` : `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX_REQUESTS_API`,
  `RATE_LIMIT_MAX_REQUESTS_CHAT`, `DEBUG`, `POSTHOG_API_KEY`, `TRUSTED_ORIGINS` retirées, et
  de `apps/server/.env.example` si elles y figurent. `tests/auth-config.test.ts` aligné.
- `IAppUser.parentId` (`packages/api/src/types.ts`) et `ElysiaAuthenticatedUser.parentId`
  (`types/index.ts`) retirés.

### 5. Doc — `docs`

- `apps/server/README.md` : ligne `MemoryCacheService`, « memory monitor » de
  l'arborescence.
- `apps/server/CLAUDE.md` : règle de validation amendée (arbitrage ci-dessus).
- `docs/roadmap.md` : E2 en trois PR. `docs/suivi.md` : points faits retirés de « Lot 0 —
  E2 », le reste réparti entre PR 2 et PR 3, état et historique.

### 6. Suppression de ce plan — `docs(plans)`

## Validation

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm exec knip
cd apps/server && bun test src/integration-tests --isolate   # base neuve, comme la CI
```

Plus un boot réel (`/health` à 200) et un appel réel à `POST /api/parent/children` avec un
corps invalide (400 `VALIDATION_ERROR`) puis valide.
