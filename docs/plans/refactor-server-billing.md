# Plan — `refactor/server-billing`

Refonte du serveur, module `billing` (lot 0, `roadmap.md`, point 7), dernier module du
rangement de `architecture.md` (« Monolithe modulaire »). Chemins relatifs à
`apps/server/src/`. Comportement et URL inchangés ; le contrat `@repo/api` ne bouge pas.

## Pré-vol (contre `main` après #353)

- Code du module (≈ 1 300 lignes) : `services/quota/` (configuration, quota de tokens,
  quota de fiches), `services/token-quota.service.ts`, `services/subscription.service.ts`,
  `services/cost-tracking.service.ts`, `routes/subscription/` (`/api/subscriptions`),
  `db/repositories/subscription.repository.ts`, `user-subscriptions.repository.ts`,
  `db/schema/billing.schema.ts`, `db/schema/cost-tracking.schema.ts`.
- `services/token-quota.service.ts` est une façade à lignes vides qui expose les mêmes
  fonctions deux fois : en exports nommés (lus par `learning`) et dans un objet
  `tokenQuotaService` (lu par `tutor` et la route de statut). Une seule forme restera :
  les fonctions nommées.
- Cycle d'import connu `quota-functions` ↔ `quota-deck` : `quota-functions` réexporte les
  fonctions de fiches, qui importent `ensureUserSubscription` de `quota-functions`. L'index
  du module exporte directement chaque fichier, ce qui casse le cycle.
- `routes/subscription/status.routes.ts` charge le quota par `import()` dynamique sans
  raison, et `helpers.ts` ne sert qu'à cette route.
- Consommateurs hors module : `app.ts` (routes), `modules/learning/card-generate.routes.ts`
  (`checkQuota`, `checkDeckQuota`, `incrementDeckUsage`), `modules/tutor/chat-message.routes.ts`
  (`checkQuota`), `modules/tutor/chat-orchestration.service.ts` (`incrementTokenUsage`,
  `costTrackingService`), `db/schema.ts`, `db/schema/index.ts`.
- `cost_tracking` référence `study_sessions` par clé étrangère : `cost-tracking.schema.ts`
  importe `modules/tutor/session.schema.ts`, exception déjà notée dans `architecture.md`.
- Restes du mobile dans `billing.schema.ts` (RevenueCat) : lot 3, comme au suivi.
- `drizzle-kit generate` doit répondre sans changement.

## Tâches

1. `git mv` vers `modules/billing/` : `billing.schema.ts`, `cost-tracking.schema.ts`,
   `subscription.repository.ts`, `user-subscriptions.repository.ts`, `quota-config.ts`,
   `quota.ts` (ex-`quota-functions.ts`), `quota-deck.ts`, `subscription.service.ts`,
   `cost-tracking.service.ts`, `subscription.routes.ts` (ex-`status.routes.ts`, qui absorbe
   `helpers.ts` et charge le quota statiquement).
2. `services/token-quota.service.ts` et `routes/subscription/index.ts` disparaissent.
   `modules/billing/index.ts` : `subscriptionRoutes`, `checkQuota`, `incrementTokenUsage`,
   `getUsageStats`, `checkDeckQuota`, `incrementDeckUsage`, `costTrackingService`.
   `quota.ts` ne réexporte plus `quota-deck.ts`.
3. `tutor` et `learning` passent par l'index ; `db/schema.ts` et `db/schema/index.ts`
   importent les schémas du module.
4. Tests : chemins réécrits par script, appels de `tokenQuotaService.*` remplacés par les
   fonctions nommées, chaque `mock.module` vérifié contre un fichier existant.
5. Doc : lignes `billing` et `family` d'`architecture.md`, chemins du suivi (lot 2 :
   `quota-config.ts`, `cost_tracking`), suivi, suppression du plan.

## Validation

Typecheck, lint, tests unitaires et d'intégration, knip, `build`, `build:types`,
`drizzle-kit generate` sans changement, madge (cycle `quota` disparu), boot et sonde de
`/api/subscriptions/*`, `/api/chat/stream`, `/api/learning/generate`.
