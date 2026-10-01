# Plan — `refactor/server-hono`

Le serveur passe d'Elysia à Hono, sur Bun. PR ajoutée au lot 0, avant le logger et le
lint strict, pour que ces deux PR portent sur le code final. Chemins relatifs à
`apps/server/src/` sauf mention contraire.

## Décision (2026-10-01)

Victor a laissé carte blanche sur le framework, Python compris.

- **Pas de Python côté serveur.** Il faudrait réécrire tout le serveur, et on perdrait le
  contrat typé de bout en bout avec le client web Next.js du lot 3. Les services Python
  séparés (`ai-service`, `curriculum`) ont déjà pourri puis été supprimés. Python reste
  envisageable pour le harnais d'évaluation du lot 1, à trancher dans son plan.
- **Hono plutôt qu'Elysia.** Chiffres relevés le 2026-10-01 sur npm et GitHub :

  | | Elysia | Hono |
  |---|---|---|
  | Téléchargements npm par semaine | 1,36 M | 78 M |
  | Commits du 1er contributeur | 1 918 | 1 755 |
  | Commits du 2e contributeur | 30 | 245 |
  | Dernière release | 1.4.30, 2026-08-26 | 4.13.12, 2026-09-30 |

  Elysia dépend presque entièrement d'une seule personne et ne tourne que sur Bun. Hono
  tourne sur Bun, Node, Deno et l'edge. Chaque brique utilisée a son équivalent maintenu :
  - client typé `hc<AppType>` (doc honojs/website, `docs/guides/rpc.md`) ;
  - better-auth (`docs/content/docs/integrations/hono.mdx`) ;
  - `@sentry/hono` 11.2.0 (https://docs.sentry.io/platforms/javascript/guides/hono/) ;
  - `@hono/zod-validator` 0.9.1 (5,6 M téléchargements par semaine) ;
  - CORS, en-têtes de sécurité et request id intégrés à Hono.

## Correspondances

| Elysia | Hono |
|---|---|
| `new Elysia({ prefix })`, `.group` | `new Hono<AppEnv>()` chaîné, `app.route(prefix, sub)` |
| `authMacro` + `.guard({ auth })` | `requireUser` / `requireParent` (`createMiddleware`) qui posent `c.var.user` et `c.var.session` |
| `body: t.Object(...)` (TypeBox) | `zValidator('json', zodSchema, hook)` via un helper `validate`, qui lève `AppError('VALIDATION_ERROR')` |
| `onError` global | `app.onError` + `app.notFound`, même enveloppe `{ error: { code, message }, requestId }` |
| `requestIdMiddleware` | `requestId()` de `hono/request-id`, en-tête `X-Request-Id` |
| `@elysiajs/cors` | `cors()` de `hono/cors`, mêmes options |
| en-têtes posés à la main | `secureHeaders()` de `hono/secure-headers`, mêmes valeurs ; HSTS en production seulement |
| `@elysiajs/swagger` (dev) | retiré : le client typé couvre le besoin, aucun consommateur |
| `withElysia` (`@sentry/elysia`) | `sentry(app, options)` de `@sentry/hono/bun`, seulement si `SENTRY_DSN` |
| `app.listen` / `app.stop()` | `Bun.serve({ fetch: app.fetch, idleTimeout: 30 })` / `server.stop()`, qui laisse finir les requêtes en cours (doc Bun 1.4.2, `runtime/http/server.mdx`). `idleTimeout: 30` reprend la valeur d'Elysia. |
| `app.handle(request)` dans les tests | `app.request(path, init)` |
| Eden `treaty<App>` (`packages/api`) | `hc<AppType>` (`hono/client`) |
| `EDUCATION_LEVEL_UNION` (TypeBox) | `z.enum(EDUCATION_LEVELS)` |

## Tâches

1. **Socle** : dépendances (`hono`, `@hono/zod-validator`, `@sentry/hono`, `@sentry/bun`,
   retrait d'`elysia`, `@elysiajs/*`, `@sentry/elysia`) ; `AppEnv`, middlewares d'auth,
   `validate`, gestion d'erreurs, rate limit adapté au contexte Hono ; `app.ts` et
   `index.ts`.
2. **Routes** : les 42 routes, schémas TypeBox convertis en Zod, réponses en
   `c.json(body, status)`. Le flux du chat renvoie directement la `Response` de
   `createUIMessageStreamResponse`.
3. **Tests** : les 8 fichiers qui montent une app Elysia passent à `app.request`, sans
   test nouveau hors ce qu'un comportement modifié demande.
4. **`packages/api`** : client `hc<AppType>`.
5. **Doc** : `architecture.md` (ligne Serveur), `apps/server/CLAUDE.md` (patterns),
   `apps/server/README.md`, `CLAUDE.md` racine (« Contrat Eden »), `roadmap.md`,
   `suivi.md`.
6. Suppression de ce plan.

## Validation

`pnpm typecheck && pnpm lint && pnpm test && pnpm exec knip` ; intégration sur base neuve ;
boot réel : `/health`, inscription parent, création d'enfant invalide puis valide,
en-têtes CORS et de sécurité, rate limit, 404.
