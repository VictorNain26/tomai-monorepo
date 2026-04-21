# Audit Mobile avril 2026 — Master Spec

**Date** : 2026-04-21
**Scope** : `apps/mobile` + cohérence `apps/server`
**Objectif** : Aligner l'app mobile sur les meilleures pratiques Expo / React Native / sécurité / conformité d'avril 2026, et durcir l'intégration avec le server.

## Contexte

L'audit initial a identifié une base déjà très saine :
- Eden Treaty via `@repo/api`, type-safety e2e
- TanStack Query v5 + persister AsyncStorage
- Zustand pour client state, Drizzle + expo-sqlite pour offline
- Better Auth + SecureStore
- React Native Reusables
- Expo Router v7 avec `typedRoutes` actif
- EAS Workflows (Android + iOS)
- 0 `any`, 0 warning ESLint
- Maestro E2E déjà configuré (4 flows)
- Quota enforcement derrière flag `QUOTA_ENFORCEMENT_ENABLED`

Ce n'est pas un projet à refaire. C'est un projet à **durcir** : fixer les bugs prod résiduels, ajouter observabilité + sécurité + conformité EAA, moderniser les patterns Expo Router v7, et éliminer la dette technique (gros fichiers, services mal délimités).

## Décomposition (6 sous-projets exécutés en séquence)

| # | Sous-projet | Plan source | Scope |
|---|---|---|---|
| **SP0** | CLAUDE.md modernisé | (ce document) | Refresh des 4 CLAUDE.md (root, monorepo, server, mobile) + index specs |
| **SP1** | Durcissement server-mobile | `plans/2026-04-21-audit-remaining.md` (items 1, 3, 5) | Bug ternaire `canceled`, test coverage reset combiné, PBKDF2 salt aléatoire |
| **SP2** | Modernisation Expo + React 19 | `plans/2026-03-20-mobile-modernisation-2026.md` + extensions | React Compiler (bloqué upstream — documenté), bytecode diffing (fait), audit useLoaderData, Stack.Protected, FlashList v2, expo-image, useSuspenseQuery |
| **SP3** | Observabilité | `plans/2026-04-21-mobile-audit/03-observability.md` (à créer) | Sentry RN v8 + source maps EAS, PostHog RN + session replay, coverage Jest 60%, Maestro dans preview workflow |
| **SP4** | Sécurité & conformité | `plans/2026-04-21-mobile-audit/04-security.md` (à créer) + `audit-remaining` items 7, 9 | App Integrity iOS+Android, SSL pinning (auth+paiement), audit a11y WCAG 2.1 AA, RevenueCat JWT signature, SQLCipher + cache TanStack chiffré |
| **SP5** | Refactor dette | `plans/2026-04-21-mobile-audit/05-refactor.md` (à créer) + `audit-remaining` items 6, 8 | Split 3 fichiers > 400L mobile, `BillingService`, `LearningService`, stabilisation NativeWind v5 |

## Ordre d'exécution

**SP0 → SP1 → SP2 → SP3 → SP4 → SP5**

Rationale :
- SP0 pose le standard documentaire
- SP1 fixe les bugs résiduels identifiés AVANT de refactor
- SP2 modernise les patterns (React Compiler bloqué = documenté, on passe aux autres)
- SP3 pose l'observabilité avant de toucher à la sécurité (besoin de mesurer les régressions)
- SP4 apporte la conformité légale (EAA) et cryptographique (webhooks signés)
- SP5 consolide la dette sur les patterns stabilisés

## Contraintes traversales

- **TDD** (via superpowers skills) pour toute logique métier
- **TypeScript strict**, zéro `any`
- **400 lignes max** par fichier
- **Commits conventionnels** : `fix(mobile)`, `feat(server)`, `refactor(db)`, etc.
- **Staging push direct** OK, `main` uniquement via PR merge commit (jamais squash)
- **Validation systématique** avant commit : `typecheck && lint && test`

## État avril 2026 (acquis)

- `experiments.typedRoutes: true` actif
- `enableBsdiffPatchSupport: true` activé (Hermes bytecode diffing)
- Pas de `forwardRef` ni `useContext` résiduel
- 5 écrans avec `testID` + 4 flows Maestro + `.maestro/config.yaml`
- `QUOTA_ENFORCEMENT_ENABLED` défaut `true` (opt-out)
- Colonnes `user.stripe_*` supprimées (source unique `family_billing`)
- Mémoire épisodique pgvector (Phase 1.4)
- Pré-classifier intent + Cohere Rerank stage 2

## État avril 2026 (bloqué / reporté)

- **React Compiler** : bloqué par Expo Router (issue expo#35100) — mémo manuelle conservée
- **`useOptimistic` + SSE chat** : reporté (incompatibilité design, voir spec mobile-modernisation)

## Livrables par sous-projet

Chaque sous-projet produit :
1. Un ou plusieurs commits conventionnels sur `staging`
2. Une mise à jour des CLAUDE.md si des patterns changent
3. Des tests (unit + E2E si pertinent)
4. Une update de ce README si l'état change

À la fin de SP5 : une PR récap `staging → main` avec note de release.
