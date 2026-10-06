---
description: Serveur Bun + Hono — chargé uniquement sur apps/server
paths:
  - "apps/server/**"
---

# Serveur (`apps/server`)

**En refonte** : l'architecture cible est `docs/etudes/2026-10-06/refonte-architecture.md` ; elle
prime sur les patterns ci-dessous là où ils divergent, et chaque étape réécrit cette règle.

Spec du tuteur : `docs/tuteur.md` ; modules et rangement : `docs/architecture.md`. Premier
démarrage ou stack locale cassée : skill `dev-bootstrap`. Appel IA, choix de modèle, coût :
skill `mistral-stack`. Migrations : `.claude/rules/database-migrations.md`.

## Frontière de types (AppType / client typé)

Le type `AppType` (`typeof app`) est l'arbre de routes que consomment les clients via
`hc<AppType>` (`hono/client`, dans `@repo/api`). Il est **entremêlé au runtime Bun** (DB,
services) : un client qui typecheckerait `src/app.ts` directement hériterait des globals
`Bun` et tomberait sur des `TS2868`. D'où le contrat suivant, qu'il ne faut pas contourner :

- Le serveur publie son type comme **artefact buildé** : `bun run build:types` émet
  `dist/types/app.d.ts`, et l'export `tomai-server/app` pointe dessus, jamais sur la source.
- `@repo/api` et les clients consomment ce `.d.ts`. Si un client réclame les globals Bun,
  c'est que la frontière fuit — corriger la fuite, pas le client.
- Ordonnancement par turbo : `typecheck` `dependsOn ["^build:types"]`. `dist/types/` est
  gitignored, jamais commité.
- Sur un clone neuf, `packages/api/src/client.ts` est rouge dans l'IDE tant que le `.d.ts`
  n'existe pas ; `bun run typecheck` à la racine le régénère.
- Émettre le `.d.ts` exige un contrat public **nommable** : tout type qui fuit dans
  `AppType` doit être exporté (cf. `StreamGenerationParams`) ou neutralisé.

## Patterns

- **Pas de logique métier dans un route handler** → déléguer au service.
- **Pas d'accès DB depuis une route** → passer par le repository.
- **Routes** : handler écrit juste après le chemin, routes chaînées pour que le client typé
  les infère, pas de contrôleur
  ([best practices Hono](https://hono.dev/docs/guides/best-practices)).
- **Validation HTTP** : Zod partout, via `validate(target, schema)`
  (`platform/http/context.ts`), qui envoie l'échec dans l'enveloppe `VALIDATION_ERROR`.
- **Auth** : `requireUser` ou `requireParent` (`platform/http/context.ts`) posés sur la
  route, qui remplissent `c.var.user` et `c.var.session`. Jamais de `use()` d'auth dans un
  sous-routeur monté sur un préfixe partagé : il s'appliquerait à tout ce préfixe.
- **Transactions** : `db.transaction(...)` dès qu'une opération touche plusieurs tables.
- **Uploads** : URL présignée, le client écrit dans S3 sans passer par le backend.

## Sécurité

- **Fail-fast au boot** : `src/platform/config/env.ts` valide l'environnement au chargement
  et refuse de démarrer sur une variable requise absente ou invalide.
- Une seule origine sert l'API et le client web (`webClient` de `@repo/web-host`, monté après
  les routes `/api`, hors de `AppType`) : pas de CORS, cookie de session limité à l'hôte.
- En-têtes de sécurité, CSP comprise (`securityHeaders` de `@repo/web-host`), et rate limit
  de `/api` et `/health` se posent dans `src/app.ts` ; le preset `ai` de `platform/http/rate-limit.ts`, plus
  strict, garde les routes du chat.
