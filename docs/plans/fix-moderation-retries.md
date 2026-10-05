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
  retentés 429, 500, 502, 503 et 504 ; `Retry-After` lu, plafonné à `maxInterval`.
- Un hook `beforeRequest` du `HTTPClient` (README, « Custom HTTP Client ») s'exécute à chaque
  tentative : il peut lui donner son propre timeout.
- `retryConnectionErrors` retente aussi les erreurs de connexion et les timeouts.
- Le signal de timeout est créé une fois par appel (`esm/lib/sdks.js`) : toutes les tentatives
  le partagent. Un appel arrivé à son timeout serait retenté jusqu'à `maxElapsedTime`, chaque
  tentative échouant aussitôt (`esm/lib/retries.js`, `retryBackoff`).

## Tâches

1. `platform/ai/mistral-sdk.ts` :
   - modération, sur un client à elle : chaque tentative coupée à 1,5 s, timeouts et erreurs
     de connexion retentés pendant 2,5 s, sous le budget de l'appel (5 s) ; les trois
     constantes au même endroit, l'ordre tient par construction ;
   - embeddings et voix : 429 et 5xx retentés pendant 3 s, pas un timeout, leurs appels
     durant jusqu'à `MISTRAL_TIMEOUT` ; retenter un timeout sans timeout par tentative boucle
     jusqu'à la fin de la fenêtre (mesuré : 3,8 s pour un timeout de 500 ms) ;
   - `MISTRAL_RETRY_ATTEMPTS=0` coupe tout, comme pour l'AI SDK.
2. Tests contre un vrai serveur local, derrière le vrai `fetch` : 503 passager retenté ; 503
   durable abandonné à la fin de la fenêtre, avec le 503 ; appel bloqué du client partagé en
   échec à son timeout, sans boucle ; tentative bloquée de la modération coupée puis
   retentée ; modération bloquée à chaque tentative en échec avant son budget ; rien de
   retenté à `MISTRAL_RETRY_ATTEMPTS=0`.
3. `docs/suivi.md`.

## Hors périmètre

- S4 repassé une fois après cette PR, annoncé.

## Validation

`bun run typecheck`, `bun run lint`, `bunx knip`, `bun run test`.
