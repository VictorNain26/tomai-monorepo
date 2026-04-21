# SP5 — Refactor dette — Plan

**Spec parent** : `docs/superpowers/specs/2026-04-21-mobile-audit/README.md`
**Date** : 2026-04-21

## Goal

Rentrer dans la contrainte CLAUDE.md "400 lignes max par fichier" côté mobile (3 exceptions), extraire la logique métier hors des routes server (`BillingService` + `LearningService`), stabiliser NativeWind v5 preview.

## Livrables

1. 3 fichiers mobile > 400 lignes découpés en composants focalisés
2. `BillingService` centralisant Stripe + RevenueCat (suppresssion de la duplication)
3. `LearningService` + repositories FSRS/decks/cards (suppression des `db.insert` directs dans les routes)
4. Wrapper NativeWind v5 pour absorber les breaking changes de preview

---

## Task 1 — Split mobile files > 400L

### Fichiers concernés (audit 2026-04-21)

| Fichier | Lignes | Plan de split |
|---|---|---|
| `apps/mobile/src/app/(auth)/login.tsx` | ~400 | Extraire `LoginForm` + `AccountTypeToggle` + `OAuthButtons` → chacun < 150L |
| `apps/mobile/src/app/(parent)/onboarding-pronote.tsx` | ~517 | Extraire `PronoteStepQR` + `PronoteStepCredentials` + `PronoteStepPin` + `useOnboardingState` hook |
| `apps/mobile/src/app/(parent)/tabs/(profile)/pronote-connect.tsx` | ~409 | Factoriser `PronoteStepQR` + `PronoteStepPin` (partage avec onboarding) |

### Steps

Pour chaque fichier :

- [ ] **Step 1 — Identifier les composants candidats** : regarder les blocs JSX de >50 lignes + groupes de hooks partagés
- [ ] **Step 2 — Extraire dans `src/components/<feature>/`** avec props typées
- [ ] **Step 3 — Extraire le state local en `src/hooks/use<Screen>State.ts`** si utile
- [ ] **Step 4 — Remplacer dans l'écran** par les imports
- [ ] **Step 5 — Typecheck + lint + tests + visuel manuel** (dev client)
- [ ] **Step 6 — Commit** par fichier split
  ```
  refactor(mobile): split <screen>.tsx into focused components (<400L each)
  ```

---

## Task 2 — `BillingService` extraction

Plan détaillé : `docs/superpowers/plans/2026-04-21-audit-remaining.md` Item 6.

### Résumé

**Files à créer** :
- `apps/server/src/services/billing/billing.service.ts` — `activatePremium`, `updateBillingStatus`, `expireAndDowngrade` (existe déjà comme méthode libre, à centraliser), `downgradeChildrenToFree`
- `apps/server/src/services/billing/billing-types.ts`
- `apps/server/src/tests/billing.service.test.ts`

**Files à refactor** :
- `stripe-webhook-checkout.ts`, `stripe-webhook-subscription.ts` — remplacer `db.insert/update familyBilling + userSubscriptions` par appels service
- `revenuecat-webhook-events.ts` — idem

**Bénéfice** : supprime la duplication Stripe ↔ RevenueCat (chaque canal fait la même mutation billing aujourd'hui).

### Étapes

- [ ] **Step 1 — Skeleton service** + signatures + types partagés
- [ ] **Step 2 — Tests unitaires** couvrant les 4 méthodes (mock `db`)
- [ ] **Step 3 — Implémenter `activatePremium`** = fusion de `stripe-webhook-checkout:83-138` + `revenuecat-webhook-events:101-147`
- [ ] **Step 4 — Refactor Stripe handlers** un par un
- [ ] **Step 5 — Refactor RevenueCat handlers** un par un
- [ ] **Step 6 — Supprimer imports DB morts** dans les webhook routes
- [ ] **Step 7 — Commits logiques**
  - `feat(server): add BillingService for shared billing mutations`
  - `refactor(server): migrate stripe webhooks to BillingService`
  - `refactor(server): migrate revenuecat webhooks to BillingService`

### Dépendance

Doit **précéder** la Task 5 de SP4 (RevenueCat signature) si elles sont faites ensemble — sinon le handler a un refactor + un changement de sécurité simultanés (plus risqué).

---

## Task 3 — `LearningService` extraction

Plan détaillé : `docs/superpowers/plans/2026-04-21-audit-remaining.md` Item 8.

### Résumé

**Files à créer** :
- `apps/server/src/db/repositories/learning-decks.repository.ts` — CRUD decks
- `apps/server/src/db/repositories/learning-cards.repository.ts` — CRUD cards
- `apps/server/src/services/learning/learning.service.ts`
  - `createDeckWithCards(userId, deckData, cards)` — transaction atomique
  - `deleteDeck(userId, deckId)` — ownership check + cascade
  - `listUserDecks(userId, opts)`
  - `getDeckWithCards(userId, deckId)`

**Files à refactor** :
- `deck.routes.ts`, `card.routes.ts`, `card-generate.routes.ts`, `fsrs*.routes.ts` → appels service
- `services/chat/tool-executor.ts:197` → utiliser `learningService.createDeckWithCards` au lieu d'un insert inline (corrige le bug : pas de transaction aujourd'hui)

**Bénéfice** : élimine l'accès DB direct des routes (conforme CLAUDE.md), corrige le bug "deck créé mais cards échouent" dans tool-executor.

### Étapes

- [ ] **Step 1 — Repositories + tests** (mock `db`)
- [ ] **Step 2 — Service + tests**
- [ ] **Step 3 — Refactor `card-generate.routes.ts`** (supprimer la transaction inline lignes 177-215)
- [ ] **Step 4 — Refactor `tool-executor.ts`** (remplacer insert inline)
- [ ] **Step 5 — Refactor autres routes learning** une par une
- [ ] **Step 6 — Tests intégration manquants AVANT les refactors** (filet de sécurité — couverture actuelle faible sur ce module)
- [ ] **Step 7 — Commits**
  - `feat(server): add learning repositories and service with transactions`
  - `refactor(server): migrate learning routes to LearningService`
  - `refactor(server): tool-executor uses LearningService for flashcard generation`

### Risque

Moyen. Les tests existants couvrent mal ce module. **Écrire des tests d'intégration manquants AVANT le refactor** (obligatoire).

---

## Task 4 — Stabilisation NativeWind v5

### Contexte

`nativewind@5.0.0-preview.2` — version preview, risque de breaking changes mineurs à chaque update.

### Steps

- [ ] **Step 1 — Auditer usage** : grep `className=` dans `src/` pour voir les patterns utilisés
- [ ] **Step 2 — Wrapper `src/lib/nativewind-compat.ts`** qui exporte les helpers NativeWind avec signatures stables (si des API divergent entre preview 2 → stable)
- [ ] **Step 3 — Watch liste** : suivre https://github.com/marklawlor/nativewind/releases pour la release stable v5
- [ ] **Step 4 — Tests visuels** : scénarios clés (login, chat, flashcards) en light + dark + text scaling 150%
- [ ] **Step 5 — Upgrade vers v5 stable** dès sortie — `pnpm up nativewind` + regression tests

### Déjà documenté

Le piège `SafeAreaView className` est déjà capturé dans `apps/mobile/CLAUDE.md` (Troubleshooting).

---

## Ordre d'exécution recommandé

**1 (split mobile) → 3 (LearningService) → 2 (BillingService) → 4 (NativeWind)**

Rationale :
- Task 1 est purement mobile, rapide, low-risk
- Task 3 (LearningService) doit précéder Task 2 (BillingService) car elle ne bloque pas sur la signature RevenueCat
- Task 2 doit être coordonné avec SP4 Task 5 (RevenueCat signature)
- Task 4 est continu (veille release)

## Risques

- **Task 1** : visuel manuel obligatoire après split (NativeWind v5 preview peut casser subtilement)
- **Task 2/3** : large surface refactor — faire PR par PR, pas en un bloc
- **Task 4** : dépend du calendrier NativeWind upstream
