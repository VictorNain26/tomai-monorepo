# Server Tom

Backend Bun + Elysia pour le tutorat socratique. Stack et versions : `README.md`
racine. Premier démarrage ou stack locale cassée : skill `/dev-bootstrap`.
Choix de modèle IA et coût des tokens : skill `/mistral-stack`.

## Commandes

```bash
# Depuis la RACINE (le compose y vit) :
pnpm dev                          # infra Docker + server host :3000 + landing
# Depuis apps/server :
bun run typecheck && bun run lint # validation
bun run test                      # tests, runner Bun
bun run test:integration          # obligatoire avant push, gating en CI
bun run build
```

Le backend tourne sur l'**host**, pas en conteneur — pas de collision sur `:3000`.

## Frontière de types (App / Eden Treaty)

Le type `App` (`typeof app`) est l'arbre de routes que consomment les clients via
Eden. Il est **entremêlé au runtime Bun** (DB, services) : un client qui
typecheckerait `src/app.ts` directement hériterait des globals `Bun` et tomberait
sur des `TS2868`. D'où le contrat suivant, qu'il ne faut pas contourner :

- Le serveur publie son type comme **artefact buildé** : `bun run build:types`
  émet `dist/types/app.d.ts`, et l'export `tomai-server/app` pointe dessus, jamais
  sur la source.
- `@repo/api` et les clients consomment ce `.d.ts`. Si un client réclame les
  globals Bun, c'est que la frontière fuit — corriger la fuite, pas le client.
- Ordonnancement par turbo : `typecheck` `dependsOn ["^build:types"]`.
  `dist/types/` est gitignored, jamais commité.
- Sur un clone neuf, `@repo/api/src/client.ts` est rouge dans l'IDE tant que le
  `.d.ts` n'existe pas. `pnpm turbo typecheck` le régénère.
- Émettre le `.d.ts` exige un contrat public **nommable** : tout type qui fuit
  dans `App` doit être exporté (cf. `PronoteCredentialSummary`) ou neutralisé.

## Patterns

- **JAMAIS de logique métier dans un route handler** → déléguer au service.
- **JAMAIS d'accès DB depuis une route** → passer par le repository.
- **Validation HTTP en TypeBox** (`t`, natif Elysia) sur chaque route : c'est elle
  qui alimente les types Eden. Zod (`src/schemas/`) est réservé aux payloads
  non-route — webhooks, validations externes complexes.
- **Auth** : macro `authMacro` + `.guard({ auth: true })`, qui injecte
  `{ user, session }` typés. Jamais de vérification manuelle.
- **Transactions** : `db.transaction(...)` dès qu'une opération touche plusieurs
  tables.
- **Uploads** : URL présignée, le client écrit dans S3 sans passer par le backend.
- **Feature flags** via `app.config.ts` pour les déploiements progressifs.

## Sécurité

- **Fail-fast au boot** si une variable de prod manque (`environment.config.ts`).
- **Pronote** : lib GPL `pawnote` et tokens **serveur uniquement**, jamais côté
  client. Credentials chiffrés AES-256-GCM, PBKDF2 600K itérations, **salt
  aléatoire de 16 octets par enregistrement** préfixé au ciphertext.
- **CORS** : whitelist en prod, `credentials: true`. **Headers** : HSTS,
  `X-Frame-Options: DENY`, nosniff, Permissions-Policy restrictive.
- **Rate limiting** : preset global, renforcé sur les credentials Pronote.

## Migrations

Source de vérité : `src/db/schema.ts`. Règles détaillées dans
`.claude/rules/database-migrations.md`, chargée automatiquement dès que tu touches
au code DB. En local `db:push` ; en prod `db:generate` → commit du SQL → migration
auto au déploiement.

## Tests

Runner Bun, tests dans `src/tests/<service>.test.ts`. Couverture attendue sur ce
qui casse silencieusement : quotas, round-trip de chiffrement, transactions
multi-tables.

Piège connu : `src/integration-tests/api-endpoints.test.ts` mocke `drizzle-orm`
partiellement. Tout nouveau module tiré par la chaîne `app.ts` /
`server-lifecycle.ts` qui importe les schémas Drizzle doit y être mocké — le
modèle est le mock de `retention-purge.service`.
