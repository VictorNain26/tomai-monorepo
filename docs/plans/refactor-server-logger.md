# Plan — `refactor/server-logger`

Point 6 du lot 0 (`roadmap.md`) : pino remplace le logger maison, puis un codemod rend leur
stack aux erreurs loggées. Chemins relatifs à `apps/server/src/`.

## Pré-vol (2026-10-01, contre `main` après #346)

- `lib/observability.ts` sérialise par `JSON.stringify` : une `Error` devient `{}`, un BigInt
  ou une référence circulaire fait lever l'appel de log. Il ignore `LOG_LEVEL`, validée par
  `config/env.ts` mais lue nulle part. Il n'importe pas `config/env` et n'a aucun test.
- 256 appels `logger.*(message, contexte)` ; 150 clés `_error` dans 55 fichiers, dont
  certaines hors des appels de log (le résultat de `requireAuth` porte aussi `_error`).
- **pino** 10.3.1 (60 M téléchargements par semaine, commit sur `main` le 2026-09-25) :
  sérialiseur `err` standard (type, message, stack, propriétés), `level` en option
  (doc pinojs/pino, `docs/api.md`).
- **pino-pretty** 13.1.3 : utilisable comme stream dans le même processus,
  `pino(options, pretty({ sync: true }))`, sans worker thread (README de pinojs/pino-pretty).
  On évite ainsi `pino.transport`, qui passe par des worker threads, sous Bun.

### Arbitrages

- **Signature conservée** : `logger.info(message, contexte)` reste l'API. Le module
  l'adapte à pino (`base.info(contexte, message)`). Les 256 appels ne bougent pas.
- **`err` à la place de `_error`** dans les contextes de log : le sérialiseur `err` de pino
  garde la stack. Le codemod ne touche que l'intérieur des appels `logger.*(...)`.
- **Production en JSON sur stdout** (pino par défaut), **dev en pretty**. Le niveau vient de
  `LOG_LEVEL`, lu par `Bun.env` comme le mode, pour la raison déjà notée dans le module :
  `bun build` fige `process.env.NODE_ENV`.

## Tâches

1. `lib/observability.ts` sur pino : même API, `ErrorContext.err` à la place de `_error`,
   `LOG_LEVEL` appliqué, pretty en dev. Test `tests/observability.test.ts` : une `Error`
   sort avec sa stack, un BigInt et une référence circulaire ne font pas lever,
   `LOG_LEVEL` filtre.
2. Codemod des contextes de log : `_error: x instanceof Error ? x.message : String(x)`
   devient `err: x`, toute autre clé `_error` d'un contexte de log devient `err`.
3. Doc : `apps/server/CLAUDE.md` si le logger y est décrit, `suivi.md`, `roadmap.md`, puis
   suppression de ce plan.

## Validation

`bun run typecheck && bun run lint && bun run test && bunx --no-install knip` ; intégration
sur base neuve ; boot réel avec une erreur provoquée, la stack apparaît dans le log ;
`LOG_LEVEL=warn` coupe les `info`.
