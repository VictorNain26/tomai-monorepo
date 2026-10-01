# Server Tom

Backend Bun + Hono du tuteur IA. Produit :
`docs/vision.md` ; conception de l'agent :
`docs/agent.md`. Stack et versions : `README.md` racine.
Premier démarrage ou stack locale cassée : skill `/dev-bootstrap`. Choix de modèle IA et
coût des tokens : skill `/mistral-stack`.

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

## Frontière de types (AppType / client typé)

Le type `AppType` (`typeof app`) est l'arbre de routes que consomment les clients via
`hc<AppType>` (`hono/client`, dans `@repo/api`). Il est **entremêlé au runtime Bun** (DB, services) : un client qui
typecheckerait `src/app.ts` directement hériterait des globals `Bun` et tomberait
sur des `TS2868`. D'où le contrat suivant, qu'il ne faut pas contourner :

- Le serveur publie son type comme **artefact buildé** : `bun run build:types`
  émet `dist/types/app.d.ts`, et l'export `tomai-server/app` pointe dessus, jamais
  sur la source.
- `@repo/api` et les clients consomment ce `.d.ts`. Si un client réclame les
  globals Bun, c'est que la frontière fuit — corriger la fuite, pas le client.
- Ordonnancement par turbo : `typecheck` `dependsOn ["^build:types"]`.
  `dist/types/` est gitignored, jamais commité.
- Sur un clone neuf, `@repo/api/src/client.ts` est rouge dans l'IDE tant que le
  `.d.ts` n'existe pas. `pnpm turbo typecheck` le régénère.
- Émettre le `.d.ts` exige un contrat public **nommable** : tout type qui fuit
  dans `AppType` doit être exporté (cf. `StreamGenerationParams`) ou neutralisé.

## Patterns

- **Pas de logique métier dans un route handler** → déléguer au service.
- **Pas d'accès DB depuis une route** → passer par le repository.
- **Routes** : handler écrit juste après le chemin, routes chaînées pour que le
  client typé les infère, pas de contrôleur
  ([best practices Hono](https://hono.dev/docs/guides/best-practices)).
- **Validation HTTP** : Zod partout, via `validate(target, schema)` (`lib/http.ts`),
  qui envoie l'échec dans l'enveloppe `VALIDATION_ERROR`.
- **Auth** : `requireUser` ou `requireParent` (`lib/http.ts`) posés sur la route, qui
  remplissent `c.var.user` et `c.var.session`. Jamais de `use()` d'auth dans un
  sous-routeur monté sur un préfixe partagé : il s'appliquerait à tout ce préfixe.
- **Transactions** : `db.transaction(...)` dès qu'une opération touche plusieurs
  tables.
- **Uploads** : URL présignée, le client écrit dans S3 sans passer par le backend.

## Sécurité

- **Fail-fast au boot** : `src/config/env.ts` valide l'environnement au chargement
  et refuse de démarrer sur une variable requise absente ou invalide.
- **CORS** : whitelist en prod, `credentials: true`. **Headers** : HSTS,
  `X-Frame-Options: DENY`, nosniff, Permissions-Policy restrictive.
- **Rate limiting** : preset global `api`, preset `ai` plus strict sur le chat.

## Migrations

Source de vérité : `src/db/schema.ts`. Règles détaillées dans
`.claude/rules/database-migrations.md`, chargée automatiquement dès que tu touches
au code DB. En local `db:push` ; en prod `db:generate` → commit du SQL → migration
auto au déploiement.

## Tests

Runner Bun, tests dans `src/tests/<service>.test.ts`. Couverture attendue sur ce
qui casse silencieusement : quotas, transactions multi-tables.

Piège du mock partiel de `drizzle-orm` dans `api-endpoints.test.ts` :
`.claude/rules/testing-and-commits.md`.
