# Plan — fix/moderation-retries

Constat du premier passage du lot 2 (2026-10-05) : pendant un incident Mistral, la modération
a échoué une vingtaine de fois, en 503 (code 3801) et en timeout ; chaque échec envoie la
réponse de repli, puisque rien ne part sans contrôle. Chemins relatifs à `apps/server/src/`.

## Cause

Le client du SDK Mistral (`platform/ai/mistral-sdk.ts`), partagé par la modération, les
embeddings, la transcription et la synthèse vocale, ne retente rien : la stratégie par défaut
de ces appels est `none` (`@mistralai/mistralai` 2.7.0, `esm/funcs/classifiersModerateChat.js`).
Les appels qui passent par l'AI SDK retentent, eux, `MISTRAL_RETRY_ATTEMPTS` fois.

## Ce que fait le SDK (lu dans la version installée)

- `retryConfig` à la création du client (README, « Retries ») : stratégie `backoff`, codes
  retentés par défaut 429, 500, 502, 503 et 504, `Retry-After` respecté.
- `retryConnectionErrors` retente aussi les erreurs de connexion et les timeouts.
- Le signal de timeout est créé une fois par appel (`esm/lib/sdks.js`) : toutes les tentatives
  le partagent. Un appel arrivé à son timeout serait retenté jusqu'à `maxElapsedTime`, chaque
  tentative échouant aussitôt (`esm/lib/retries.js`, `retryBackoff`).

## Tâches

1. `platform/ai/mistral-sdk.ts` : `retryConfig` en `backoff`, erreurs de connexion comprises,
   fenêtre de 3 s, sous le plus court timeout des appels du SDK (modération, 5 s) : un appel
   arrivé à son timeout est déjà hors de la fenêtre et échoue aussitôt. Un appel bloqué reste
   un échec, et la réponse de repli part comme aujourd'hui.
2. Tests, `fetch` simulé : un 503 puis une réponse, le résultat arrive en deux appels ; une
   400 n'est pas retentée ; un appel bloqué échoue à son timeout en un seul appel ; la fenêtre
   reste sous le timeout de la modération.
3. `docs/suivi.md`.

## Hors périmètre

- Un timeout par tentative : le SDK n'en a pas, et le construire serait du code maison.
- S4 repassé une fois après cette PR, annoncé.

## Validation

`bun run typecheck`, `bun run lint`, `bunx knip`, `bun run test`.
