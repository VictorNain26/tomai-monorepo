# Plan — Items restants après audit du 2026-04-21

> **Contexte** : 35+ findings de l'audit ont été appliqués et poussés sur `staging` (6 commits : `2bd9905` → `ed50395`). Ce document couvre les 9 items volontairement laissés de côté, soit parce qu'ils nécessitaient une décision business, soit parce qu'ils touchaient à des sous-systèmes qui méritaient une session dédiée.
>
> **Contrainte clé** : pas de prod actuellement, donc pertes de données acceptables. Toute migration de schéma peut être faite via `db:push` sans préserver les données existantes (confirmé par l'utilisateur le 2026-04-21).

**Objectif global** : atteindre zéro finding P0 restant avant la mise en prod de TomAI.

---

## Priorisation

| # | Item | Priorité | Effort | Bloque | Décision requise |
|---|---|---|---|---|---|
| 1 | Bug ternaire `canceled → active` | P1 | 15min | — | Confirmation intent |
| 2 | `user.stripe_*` columns dedup | P1 | 1h | — | Non |
| 3 | O-2 test coverage reset combiné | P2 | 15min | — | Non |
| 4 | P0-1 Quota bypass réactivation | P0 | 1-2h | — | Business : quand ? |
| 5 | P1 PBKDF2 salt Pronote | P1 | 2h | — | Non |
| 6 | P0-4 `BillingService` extraction | P0 | 1j | 7, 8 | Non |
| 7 | P0-3 RevenueCat JWT signature | P0 | 4h | — | Doc research |
| 8 | P0-5 `LearningService` extraction | P0 | 1j | — | Non |
| 9 | N-1 SQLCipher cache mobile chiffré | P1 | 2j | — | Design native deps |

**Ordre d'exécution recommandé** : 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9

Les 5 premiers sont indépendants et courts. Les 4 derniers sont des refactors qui bénéficient d'une session dédiée chacun. 6 doit précéder 7 (BillingService simplifie l'implémentation du webhook signé). 8 est indépendant.

---

## Item 1 — Fix bug ternaire `handleSubscriptionUpdated`

**Source audit** : `apps/server/src/routes/stripe-webhook-subscription.ts:61`
```ts
const childStatus = billingStatus === 'active' ? 'active'
  : billingStatus === 'canceled' ? 'active'  // ← les deux branches retournent 'active'
  : 'paused';
```

**Décision requise avant d'écrire du code** : est-ce intentionnel (les enfants gardent `active` jusqu'à la fin de période après annulation) ou un bug (devrait être `paused` ou `canceled`) ?

**Approche selon réponse** :

- **Si intentionnel** : garder la logique mais renommer pour qu'elle se lise : `const childStatus = billingStatus === 'active' || billingStatus === 'canceled' ? 'active' : 'paused';` + commentaire "`canceled` signifie annulation en fin de période ; les enfants gardent l'accès jusqu'à la date de fin réelle (`handleSubscriptionDeleted` les bascule à la fin)".
- **Si bug** : remplacer par `billingStatus === 'canceled' ? 'paused' : 'active'` — ou aligner sur la logique de `handleSubscriptionDeleted` qui passe les enfants en plan `free`.

**Tests** : `src/tests/stripe-webhook-subscription.test.ts` — ajouter un cas pour `status: 'canceled'` qui assert le `childStatus` attendu.

**Risque** : si c'est un bug silencieux qui tourne depuis longtemps, le fix change le comportement utilisateur. Mais pas de prod → pas de régression.

---

## Item 2 — Supprimer les colonnes `user.stripe_*` dupliquées

**Source audit** : `apps/server/src/db/schema/auth.schema.ts:52-55` (champs `stripeCustomerId`, `stripeSubscriptionId`, `subscriptionStatus`, `subscriptionPlan`)

**Contexte** : `family_billing` est la source de vérité actuelle. Les champs sur `user` ne sont plus mis à jour par les webhooks, mais ils existent toujours dans le schéma, invitant à des lectures erronées.

**Files à toucher** :
- `apps/server/src/db/schema/auth.schema.ts` : retirer les 4 colonnes
- Grep `stripeCustomerId|subscriptionStatus|subscriptionPlan` dans `apps/server/src` et `packages/api` pour nettoyer tout reader résiduel
- Pas de migration SQL : `db:push` + re-génération du schéma Drizzle

**Étapes** :

1. `git grep -n "user\.\(stripe\|subscription\)" apps/server/src packages/api` — inventorier les lecteurs
2. Pour chaque lecteur : si pas utilisé → delete, si utilisé → migrer vers `familyBilling`
3. Retirer les 4 colonnes de `auth.schema.ts`
4. `cd apps/server && docker compose up -d && bun run db:push` (dev local)
5. `bun run typecheck && bun run lint && bun run test`
6. Commit : `refactor(db): drop duplicate stripe columns from user table`

**Tests** : si le typecheck passe après retrait, ça prouve qu'aucun code ne lisait plus ces champs. Pas de test unitaire à ajouter.

**Risque** : si un consumer externe (landing, admin) lit ces champs via Better Auth session user, ça casse. Grep dans `apps/landing` et `apps/mobile` aussi.

---

## Item 3 — O-2 Test coverage reset combiné

**Source** : review pre-push — `apps/server/src/tests/token-quota.service.test.ts:168-179`

**Gap** : aucun test ne couvre le cas où `shouldResetWindow` ET `shouldResetDaily` sont tous deux `true` simultanément (scenario minuit pile en heure Paris sur un utilisateur qui a une window qui expire au même instant).

**Étapes** :

1. Ajouter un test dans `describe('incrementTokenUsage — behavioral window/reset tests')` :
   ```ts
   it('should reset window AND daily when both expire simultaneously', async () => {
     const now = Date.now();
     const sixHoursAgo = new Date(now - 6 * 60 * 60 * 1000);
     const yesterdayMorning = new Date(now - 24 * 60 * 60 * 1000);
     dbSelectResult = [makeDbSubscription({
       windowStartAt: sixHoursAgo,         // > 5h → reset window
       windowTokensUsed: 4000,
       lastResetAt: yesterdayMorning,       // > 24h → reset daily
       tokensUsedToday: 10000,
     })];
     const result = await tokenQuotaService.incrementTokenUsage('user-001', 500);
     expect(result.success).toBe(true);
     expect(result.newWindowTokensUsed).toBe(500);  // window reset + delta
     expect(result.newDailyTokensUsed).toBe(500);   // daily reset + delta
   });
   ```
2. `bun test src/tests/token-quota.service.test.ts` — expected pass
3. Commit : `test(server): cover simultaneous window+daily reset in quota`

**Risque** : aucun. Pure ajout de test.

---

## Item 4 — P0-1 Quota bypass : réactivation derrière feature flag

**Source audit** : `apps/server/src/services/quota/quota-functions.ts:113-115` et `quota-deck.ts:20-28`. `checkQuota` et `checkDeckQuota` retournent `{ allowed: true, remaining: 999_999 }` hardcodé.

**Décision business requise** : quand réactiver ? Aujourd'hui ? Avant la mise en prod ? Jamais (= quotas uniquement informatifs) ?

**Approche recommandée** : feature flag `QUOTA_ENFORCEMENT_ENABLED` dans `app.config.ts`, défaut `false` (comportement actuel préservé). La logique d'enforcement existe déjà — juste à la reconnecter.

**Files** :
- `apps/server/src/config/app.config.ts` : ajouter `quotas: { enforcementEnabled: Bun.env['QUOTA_ENFORCEMENT_ENABLED'] === 'true' }`
- `apps/server/src/services/quota/quota-functions.ts` : nouvelle fonction `checkQuotaReal(userId)` qui fait le vrai calcul (à partir du code existant dans `getUsageStats`) ; `checkQuota` route vers `checkQuotaReal` si flag activé, sinon retourne le default unlimited
- `apps/server/src/services/quota/quota-deck.ts` : même pattern pour `checkDeckQuota`
- Supprimer `src/tests/quota-bypass.test.ts` (remplacé par des tests du flow réel)
- Ajouter `src/tests/quota-enforcement.test.ts` avec cases : flag off = allowed, flag on + under limit = allowed, flag on + over = blocked

**Étapes TDD** :

1. Écrire `quota-enforcement.test.ts` avec un test "flag off → allowed unlimited" — exécuter → pass (comportement actuel)
2. Écrire test "flag on + under limit → allowed with real counters" — exécuter → fail
3. Implémenter `checkQuotaReal` + branchement du flag
4. Tests re-run → pass
5. Idem pour `checkDeckQuota`
6. Supprimer `quota-bypass.test.ts`
7. Run full : `bun run typecheck && bun run lint && bun run test`
8. Commit : `feat(quota): reactivate quota enforcement behind feature flag`

**Tests d'intégration** : ajouter à `api-endpoints.test.ts` un test `POST /api/chat/stream` avec quota over limit + flag on → 429 Too Many Requests.

**Risque** : le mobile affiche actuellement `999_999 tokens restants` (via `useChildTokenUsage`). Activer le flag va changer l'affichage vers la vraie valeur — cohérent avec l'intent produit mais à valider en UI.

---

## Item 5 — P1 PBKDF2 salt aléatoire Pronote

**Source audit** : `apps/server/src/lib/encryption.ts:42-43` — salt fixe hardcodé `'tomai-pronote-v2'`. Si `PRONOTE_ENCRYPTION_KEY` fuite, toute la table `pronote_credentials` est déchiffrable avec la même clé dérivée, et la rotation nécessite de re-chiffrer tous les enregistrements.

**Approche** : stocker un salt 16 bytes aléatoire par enregistrement, préfixé au ciphertext.

**Format actuel** : `IV(12 bytes) || ciphertext+tag(GCM)` → encodé en base64

**Nouveau format** : `salt(16 bytes) || IV(12 bytes) || ciphertext+tag` → base64

**Files** :
- `apps/server/src/lib/encryption.ts` : `encrypt()` génère un salt aléatoire, `decrypt()` le lit depuis les premiers 16 bytes ; `deriveKey(salt: Uint8Array)` prend le salt en paramètre
- `apps/server/src/tests/encryption.test.ts` : nouveaux tests "each encryption produces a different output for the same plaintext" + "salt is extractable from ciphertext"

**Étapes TDD** :

1. Écrire test : `encrypt(plain)` appelée 2 fois produit 2 outputs différents (vérifie que salt aléatoire)
2. Run → fail (aujourd'hui le salt est fixe, seul l'IV change)
3. Refactor `deriveKey` pour accepter le salt en paramètre
4. Refactor `encrypt` : générer salt via `crypto.getRandomValues(new Uint8Array(16))`, dériver la clé, préfixer au format final
5. Refactor `decrypt` : extraire salt (16 bytes), IV (12 bytes), ciphertext (reste), dériver la clé
6. Test → pass
7. Test round-trip : encrypt + decrypt retourne le même plaintext
8. Pas de migration DB : `db:push` sans changer le schéma de `pronote_credentials`, mais **les tokens existants en DB deviennent illisibles**. Acceptable car pas de prod.
9. `bun run typecheck && bun run lint && bun run test src/tests/encryption.test.ts src/tests/pronote-sync.test.ts`
10. Commit : `fix(server): random per-record PBKDF2 salt for Pronote encryption`

**Risque** : le mobile stocke-t-il un ciphertext déchiffrable par le backend ? Vérifier que c'est le backend qui chiffre/déchiffre (pas le mobile). Grep `src/services/pronote-sync.service.ts` pour l'ownership du chiffrement.

---

## Item 6 — P0-4 `BillingService` extraction

**Source audit** : `apps/server/src/routes/stripe-webhook-*.ts` et `revenuecat-webhook-events.ts` contiennent des `db.insert/update` directs sur `familyBilling` et `userSubscriptions`. Logique dupliquée entre Stripe et RevenueCat (notamment "activer les enfants premium").

**Objectif** : extraire `BillingService` dans `apps/server/src/services/billing/` qui centralise les mutations de billing. Les webhook handlers deviennent des fines enveloppes qui parsent le payload → appellent le service.

**Files à créer** :
- `apps/server/src/services/billing/billing.service.ts`
  - `activatePremium(parentId, childrenIds, { source: 'stripe' | 'revenuecat', periodStart, periodEnd, ...meta })`
  - `updateBillingStatus(parentId, status, { periodStart, periodEnd, ...meta })`
  - `expireBilling(parentId)` — pour `handleExpiration` / `handleSubscriptionDeleted`
  - `downgradeChildrenToFree(childrenIds)` — pour quand l'abonnement expire
- `apps/server/src/services/billing/billing-types.ts` — types partagés
- `apps/server/src/tests/billing.service.test.ts` — tests unitaires

**Files à refactor** :
- `apps/server/src/routes/stripe-webhook-checkout.ts` : `handleCheckoutCompleted`, `handleInvoicePaid`, `handleInvoicePaymentFailed` délèguent à `billingService`
- `apps/server/src/routes/stripe-webhook-subscription.ts` : idem (`handleSubscriptionUpdated`, `handleSubscriptionDeleted`, `handleScheduleUpdated`)
- `apps/server/src/routes/revenuecat-webhook-events.ts` : `handleInitialPurchase`, `handleRenewal`, `handleExpiration`, `handleCancellation`, `handleBillingIssue`, `handleProductChange` délèguent à `billingService`

**Étapes** :

1. Écrire les signatures + types dans `billing.service.ts` (vide, juste l'interface)
2. Écrire tests unitaires `billing.service.test.ts` couvrant les 4 méthodes, mockant `db`
3. Implémenter `activatePremium` : fusion de la logique `insert familyBilling + onConflictDoUpdate` actuellement dans stripe-webhook-checkout:83-138 ET revenuecat-webhook-events:101-147
4. Run tests → pass
5. Refactor `stripe-webhook-checkout.ts::handleCheckoutCompleted` : remplacer les 55 lignes de DB par un appel à `billingService.activatePremium(...)` + mapping des params
6. Run `bun test src/tests/stripe-webhook.test.ts` → pass
7. Répéter pour chaque handler (6 au total)
8. Supprimer les imports de `db`, `familyBilling`, `userSubscriptions` devenus morts dans les webhook routes
9. `typecheck && lint && test`
10. Commit en plusieurs chunks logiques :
    - `feat(server): add BillingService for shared billing mutations`
    - `refactor(server): migrate stripe webhooks to BillingService`
    - `refactor(server): migrate revenuecat webhooks to BillingService`

**Tests** : les tests existants `stripe-webhook.test.ts` et `revenuecat-webhook.test.ts` doivent continuer à passer — ils testent le comportement HTTP (signature verification, idempotence, response code). Le nouveau `billing.service.test.ts` teste la logique métier directement.

**Risque** : les webhook handlers ont une logique conditionnelle subtile (ex: `childrenIds.length || 1` dans handleInitialPurchase). Préserver à l'identique dans le service, puis nettoyer dans un commit de follow-up.

---

## Item 7 — P0-3 RevenueCat webhook signature JWT

**Source audit** : `apps/server/src/routes/revenuecat-webhook.handler.ts:17-33` — protection = Bearer statique uniquement. Pas de signature cryptographique. Si le token fuite, un attaquant peut forger `INITIAL_PURCHASE` pour n'importe quel `app_user_id`.

**Approche** : utiliser la vérification officielle RevenueCat (le format exact dépend de ce que RevenueCat supporte — JWT signé ou HMAC).

**Pré-requis doc research** : consulter `https://www.revenuecat.com/docs/integrations/webhooks/webhooks-v2` — signature header + format du payload signé. À valider.

**Files** :
- `apps/server/src/lib/revenuecat/signature.ts` (nouveau) : `verifyRevenueCatWebhookSignature(rawBody: string, headers: Headers, secret: string): boolean`
- `apps/server/src/routes/revenuecat-webhook.handler.ts` : remplacer la comparaison Bearer par `verifyRevenueCatWebhookSignature`
- `apps/server/src/config/environment.config.ts` : renommer `REVENUECAT_WEBHOOK_AUTH` → `REVENUECAT_WEBHOOK_SIGNING_SECRET` + validation fail-fast au boot si prod et pas défini
- `apps/server/src/tests/revenuecat-webhook.test.ts` : nouveaux tests signature valid/invalid/replay

**Étapes** :

1. Doc research (15min) — noter le format exact de signature RevenueCat
2. Écrire tests `signature.test.ts` avec payload + signature valide précalculée
3. Implémenter `verifyRevenueCatWebhookSignature` (probablement HMAC-SHA256 comme Stripe, ou JWT vérifié)
4. Run signature tests → pass
5. Remplacer le check dans `revenuecat-webhook.handler.ts`
6. Run `bun test src/tests/revenuecat-webhook.test.ts` — adapter les fixtures pour inclure la signature
7. Ajouter au boot dans `server-lifecycle.ts` un fail-fast si `NODE_ENV=production` et `REVENUECAT_WEBHOOK_SIGNING_SECRET` manquant
8. Mettre à jour `.env.example`
9. Mettre à jour la doc RevenueCat dashboard → pointer vers le nouveau endpoint si nécessaire
10. Commit : `fix(server): verify RevenueCat webhook signatures instead of shared token`

**Dépendance** : bénéficie de l'Item 6 (BillingService) car la signature est orthogonale à la logique métier. Si fait avant Item 6, le handler a un refactor + un changement de sécurité → plus risqué.

**Risque** : bug de signature = tous les webhooks deviennent 401. Test de bout en bout avec un webhook RC de sandbox avant de déployer.

---

## Item 8 — P0-5 `LearningService` extraction

**Source audit** : `apps/server/src/routes/learning/*.routes.ts` contiennent tous des `db.insert/update/delete` directs. `card-generate.routes.ts:177-215` contient la seule vraie transaction du codebase (insert deck + cards) — mais dupliquée dans `tool-executor.ts:197` sans transaction.

**Objectif** : centraliser via `LearningService` et `LearningRepository` pour respecter la règle CLAUDE.md "JAMAIS de logique métier dans les routes".

**Files à créer** :
- `apps/server/src/db/repositories/learning-decks.repository.ts` — CRUD decks
- `apps/server/src/db/repositories/learning-cards.repository.ts` — CRUD cards
- `apps/server/src/services/learning/learning.service.ts`
  - `createDeckWithCards(userId, deckData, cards)` — transaction partagée
  - `deleteDeck(userId, deckId)` — ownership check + cascade
  - `listUserDecks(userId, opts)`
  - `getDeckWithCards(userId, deckId)`
- `apps/server/src/tests/learning.service.test.ts`

**Files à refactor** :
- `apps/server/src/routes/learning/deck.routes.ts` : `GET /`, `GET /:id`, `DELETE /:id` → appels service
- `apps/server/src/routes/learning/card.routes.ts` : idem
- `apps/server/src/routes/learning/card-generate.routes.ts` : déléguer la transaction au service (suppression des lignes 177-215)
- `apps/server/src/services/chat/tool-executor.ts:197` : remplacer la création deck inline par `learningService.createDeckWithCards(...)` pour bénéficier de la transaction

**Étapes** :

1. Créer les repositories avec méthodes typées Drizzle
2. Tests unitaires repositories (mock `db`)
3. Créer `LearningService` avec méthodes
4. Tests unitaires service (mock repositories)
5. Refactor `card-generate.routes.ts` : supprimer la transaction inline, appeler le service
6. Tests d'intégration existants doivent passer
7. Refactor `tool-executor.ts` : remplacer l'insert inline par l'appel service
8. Tests `tool-executor.test.ts` adaptés
9. Refactor `deck.routes.ts`, `card.routes.ts`, `fsrs*.routes.ts` (accès DB direct remplacés)
10. Commits logiques :
    - `feat(server): add learning repositories and service`
    - `refactor(server): migrate learning routes to LearningService`
    - `refactor(server): tool-executor uses LearningService for flashcard generation`

**Tests** : couverture critique sur `createDeckWithCards` en transaction (rollback si insert cards échoue après insert deck).

**Risque** : moyen. Les tests existants couvrent mal ce module. Recommandé : écrire des tests d'intégration manquants AVANT le refactor (filet de sécurité).

---

## Item 9 — N-1 Cache mobile chiffré (SQLite + AsyncStorage)

**Source audit cross-check** : `apps/mobile/src/lib/query-client.ts` persiste le TanStack cache en **AsyncStorage non chiffré** (24h gcTime) + `apps/mobile/src/db/client.ts` utilise `expo-sqlite` standard non chiffré. Sur Android, accessible via appareil rooté ou app malveillante avec permission. Données stockées : conversations d'enfants, métriques scolaires, progression — RGPD sensible.

**Objectif** : chiffrer ces deux caches au repos.

**Deux sous-items** :

### 9a — SQLite chiffré via SQLCipher

**Approche** : migrer de `expo-sqlite` vanilla vers `@op-engineering/op-sqlite` qui supporte SQLCipher nativement.

**Files** :
- `apps/mobile/package.json` : remove `expo-sqlite`, add `@op-engineering/op-sqlite`
- `apps/mobile/src/db/client.ts` : réécrire `getDatabase()` en utilisant op-sqlite
- `apps/mobile/app.config.ts` : ajouter le config plugin op-sqlite avec SQLCipher activé
- Nouvelle dep native → `pnpm build:dev` obligatoire

**Étapes** :

1. Générer une clé SQLCipher au premier lancement et la stocker en SecureStore (`pronote-secure-store` pattern déjà en place)
2. Ouvrir la DB avec `PRAGMA key = '...'`
3. Écrire migration : si ancienne DB non chiffrée détectée, drop + recreate (pas de données à préserver, dev only)
4. Rebuild dev client (`pnpm build:dev`)
5. Smoke test : login → créer conversation → logout → login autre user → vérifier que les données ne sont pas lisibles via ADB

**Risque** : natif requis → les workflows EAS de preview/prod cassent tant que la lib n'est pas propagée. Timing à coordonner avec une session de build EAS.

### 9b — TanStack persistence chiffrée

**Approche** : wrapper AsyncStorage avec chiffrement AES via `expo-crypto` + `expo-secure-store` pour la clé.

**Files** :
- `apps/mobile/src/lib/encrypted-storage.ts` (nouveau) : wrapper qui implémente l'interface AsyncStorage-like (`getItem`, `setItem`, `removeItem`) avec encrypt/decrypt
- `apps/mobile/src/lib/query-client.ts` : `createAsyncStoragePersister({ storage: encryptedStorage })` au lieu d'AsyncStorage direct

**Étapes** :

1. Générer clé AES-256 au premier boot, stockée en SecureStore (réutilise la même clé que SQLCipher si possible)
2. Wrapper avec `encrypt(JSON.stringify(value))` avant setItem, `JSON.parse(decrypt(...))` après getItem
3. Gérer le cas d'une valeur corrompue (decrypt échoue → retourner null, ne pas planter)
4. Tester migration : ancien cache en clair détecté → purge + repopulate (pas de données à préserver)

**Risque** : perf — chaque setItem déclenche encrypt. Mitigé par le `throttleTime: 1000` déjà configuré dans le persister.

**Commits** :
- `feat(mobile): encrypt SQLite offline cache with SQLCipher`
- `feat(mobile): encrypt TanStack query cache at rest`

**Dépendance** : nécessite `pnpm build:dev` (natif). À faire dans une session dédiée avec un smoke-test complet sur device Android.

---

## Notes transverses

### Dette restante tracée mais hors scope de ce plan

Les items suivants, vus lors de l'audit, ne sont **pas traités ici** :
- Dependabot : 43 vulnérabilités dans la default branch (à traiter via `pnpm update` + review des breaking changes, session dédiée)
- 400L limit : `file-upload.routes.ts` à 387L (proche du seuil, factoriser les 4 auth+ownership en helper avant d'ajouter des endpoints)
- `requireAuth` double call via `getAuthenticatedParent` → `getAuthenticatedUser` → `requireAuth` (N-1 nit : chaque endpoint subscription fait un SELECT user en double)
- Observabilité `requestId` non propagée aux services (préexistant, nécessite refactor signature services ou AsyncLocalStorage)

### Règles à suivre à chaque item

- **Validation systématique** avant commit : `bun run typecheck && bun run lint && bun run test` côté server, `pnpm typecheck && pnpm lint && pnpm test` côté mobile. Gérés automatiquement par lefthook mais à connaître si le hook bloque.
- **TDD** pour tout changement de logique métier : test failing en premier, implémentation minimale ensuite.
- **Commits conventionnels** : `fix(scope)`, `feat(scope)`, `refactor(scope)`, `test(scope)` avec scope dans `chat | server | landing | mobile | ci | db | auth | rag`.
- **Jamais `git add .`** : toujours stager les fichiers explicitement pour éviter de commit un `.env` ou un fichier de plan oublié.
- **Staging push direct** OK ; `main` : toujours via PR depuis `staging` avec merge commit (jamais squash — désynchronise les branches).

---

## Exécution

Ce plan est un **roadmap** : il donne assez de contexte pour exécuter chaque item mais ne spécifie pas chaque step TDD ligne par ligne.

**Si tu veux partir en exécution** : pick un item (idéalement dans l'ordre 1-9), dis-le-moi, je produis un plan TDD détaillé par item dans `docs/superpowers/plans/2026-04-21-audit-N.md` avec code blocks complets et steps 2-5min chacun, prêt à être exécuté via `superpowers:subagent-driven-development` ou `superpowers:executing-plans`.
