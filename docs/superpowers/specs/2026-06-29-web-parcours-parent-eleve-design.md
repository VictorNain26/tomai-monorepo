> **⚠️ SUPERSEDED (2026-07-01)** — `apps/web` est legacy : décision [ADR 0001](../../adr/0001-universal-consumer-app.md) (app conso universelle Expo, PR #260) + audit `docs/audits/2026-07-01-curriculum-to-frontend-architecture.md`. Aucun nouveau lot web Next ; suppression d'apps/web au cutover. Document conservé comme trace historique.

# Web — câblage des parcours parent & élève au backend

Date : 2026-06-29
Branche de départ : `refactor/mobile-safe-area-screen` (créer une branche dédiée par lot)
Statut : design approuvé (go utilisateur), socle + Lot 1 à implémenter

## 1. Contexte & objectif

`apps/web` (Next.js 16, role-aware) est aujourd'hui une **coquille d'authentification** :
seuls le login/signup/logout et la garde de routes (`proxy.ts`) parlent au backend.
Tous les dashboards (`/parent`, `/parent/enfants`, `/student`, `/student/revisions`,
`/school`) sont des **placeholders statiques** — zéro intégration Eden Treaty.

Le backend Elysia expose ~60 endpoints, et l'app **mobile** (mature) a déjà câblé
l'intégralité des parcours parent et élève contre ces endpoints via Eden Treaty +
TanStack Query. Le mobile est la **spec produit de référence** de ce chantier.

Objectif : rendre les parcours **parent** et **élève** réellement utilisables en web,
en réutilisant le backend existant. On porte la logique produit du mobile, pas son UI
(primitives RN ≠ DOM — décision actée dans `apps/web/CLAUDE.md`).

## 2. Scope

### Inclus (utilisable en web)
- Parent : dashboard enfants + métriques, CRUD enfants (créer / éditer niveau /
  supprimer / reset mot de passe), **lecture** des données Pronote (notes / devoirs /
  emploi du temps d'un enfant déjà connecté via mobile), statut d'abonnement **en lecture**.
- Élève : dashboard, classeur de fichiers, **chat SSE** (cœur produit), révisions **FSRS**
  (decks, session de rating, génération IA de cartes).

### Exclus (intrinsèquement mobile)
- **Onboarding Pronote** (scan QR par caméra). Décision projet « Pronote mobile-only ».
  Le web consomme les données déjà synchronisées, il ne lance pas la connexion.
- **Achats in-app RevenueCat**. Pas de paywall web ; statut d'abonnement en lecture seule.
- Vocal STT/TTS du chat : différé (faisable en web via MediaRecorder, hors lot initial).

## 3. Décisions d'architecture (socle, valables pour tous les lots)

| # | Décision | Rationale | Alternative écartée |
|---|----------|-----------|---------------------|
| 1 | **TanStack Query v5 (client) + Eden Treaty** pour toute la donnée serveur | Auth par cookie cross-origin + produit très interactif (chat, mutations) ; cache / loading / error / invalidation standardisés sur ~25 écrans ; déjà le pattern du mobile (`apps/mobile/src/lib/query-client.ts`) | React Server Components fetch — à contre-courant pour cookie cross-origin + forte interactivité ; ne couvre pas les mutations/streaming |
| 2 | **Init API** : `apps/web/lib/api.ts` appelle `initializeApi({ baseUrl: NEXT_PUBLIC_SERVER_URL })` ; un `Providers` Client Component monte `QueryClientProvider` + `setUnauthorizedHandler(() => router.push('/login'))` | Le navigateur envoie le cookie automatiquement ; `getTreaty()` met déjà `credentials: 'include'` quand pas de `cookieProvider` (cas web) | — |
| 3 | **Enrichir `@repo/ui`** avec les primitives shadcn manquantes (aujourd'hui : seulement `Button`, `Card`) | Convention `apps/web/CLAUDE.md` : « JAMAIS de composant UI custom → `@repo/ui` » ; partagé web + landing | Composants locaux dans `apps/web` — viole la convention |
| 4 | **Types dérivés du serveur** via `ResponseData<...>` de `@repo/api` | Contrat Eden = source de vérité, zéro type maintenu à la main | Types DTO recopiés à la main — dérive garantie |
| 5 | **Hooks web dédiés** dans `apps/web/lib/hooks/` (réécrits, non partagés avec le mobile) | Les hooks mobile dépendent de RN (AsyncStorage, secure-store) ; la logique métier reste côté serveur (convention) | Partager les hooks RN — impossible (deps natives) |
| 6 | **Chat SSE web** (Lot 4) : `fetch` + `ReadableStream` reader, parsing SSE manuel | L'endpoint `/api/chat/stream` est **POST + SSE** ; `EventSource` natif ne fait que GET | `EventSource` natif — incompatible POST |

### Conventions transverses (designer lead — front)
- **Tokens uniquement** (`@repo/tokens`), zéro valeur hardcodée ni CSS/inline.
- **États complets** sur tout écran data : loading (skeleton), empty (CTA), error (retry),
  et sur tout interactif : hover / focus / active / disabled / pending.
- **A11y WCAG AA** : focus clavier visible, cibles ≥ 44px, `aria-*`/rôles, contraste 4.5:1.
  Les primitives Radix/shadcn fournissent l'accessibilité — ne pas réinventer.
- **Responsive mobile-first** : layouts pensés petits écrans dès le départ.

## 4. Roadmap des lots (chaque lot = un spec → plan → PR)

| Lot | Contenu | Endpoints clés | Risque |
|-----|---------|----------------|--------|
| **1** | Fondation Eden Treaty + parent CRUD | `/api/parent/*`, `/api/education/levels`, `/api/subscriptions/status` | Faible |
| 2 | Parent : lecture Pronote (détail enfant, notes, devoirs, EDT) | `/api/pronote/children/:id/*` | Faible |
| 3 | Élève : dashboard + classeur fichiers | `/api/subscriptions/usage`, `/api/learning/due-summary`, `/api/upload/*` | Moyen |
| 4 | Élève : chat SSE (sessions, streaming, pièces jointes, decks inline) | `/api/chat/*` | Élevé |
| 5 | Élève : révisions FSRS (decks, review, génération IA) | `/api/learning/*` | Moyen |

Ce spec détaille le **socle + Lot 1**. Les lots 2-5 obtiendront leur propre spec au moment
de les concevoir.

## 5. Lot 1 — design détaillé

### 5.1 Socle (livré une fois, réutilisé partout)
- `apps/web/package.json` : ajouter `@repo/api` (workspace) et `@tanstack/react-query` (^5).
- `apps/web/lib/api.ts` : `initializeApi({ baseUrl: NEXT_PUBLIC_SERVER_URL })`.
- `apps/web/components/providers.tsx` (`"use client"`) : `QueryClient` créé via `useState`
  (une instance par client, pas partagée entre requêtes SSR) + `QueryClientProvider` +
  `setUnauthorizedHandler` branché sur le router. Monté dans `app/layout.tsx`.
- `@repo/ui` : ajouter les primitives shadcn nécessaires au Lot 1 — `input`, `label`,
  `dialog`, `alert-dialog`, `select`, `table`, `skeleton`, `sonner` (toasts), `badge`,
  `avatar`. Installées via la CLI shadcn, adaptées au registre du repo (tokens + `cn`).
  Nouvelles deps `@repo/ui` attendues : `@radix-ui/react-dialog`,
  `@radix-ui/react-alert-dialog`, `@radix-ui/react-select`, `@radix-ui/react-label`,
  `@radix-ui/react-avatar`, `sonner`.

### 5.2 Hooks
- `lib/hooks/use-parent-dashboard.ts` : `useQuery` → `getTreaty().api.parent.dashboard.get()`.
- `lib/hooks/use-children.ts` : `useQuery` liste enfants + `useMutation` create / update /
  delete / reset-password, avec `invalidateQueries(['parent','dashboard'])` et
  `(['parent','children'])` après succès.
- `lib/hooks/use-education-levels.ts` : `useQuery` → `/api/education/levels` (pour le select niveau).
- `lib/hooks/use-subscription-status.ts` : `useQuery` → `/api/subscriptions/status`.

### 5.3 Écrans (remplacent les placeholders)
| Route | Rôle | États | Actions |
|-------|------|-------|---------|
| `/parent` | Dashboard : titre + liste de cartes enfant (nom, niveau, activité Tom) + carte abonnement (lecture) | loading (skeletons), empty (« Aucun enfant lié » + CTA Ajouter), error (retry) | Ajouter un enfant (ouvre dialog) ; cliquer une carte → `/parent/enfants` (détail en Lot 2) |
| `/parent/enfants` | Gestion : table des enfants (nom, username, niveau) | loading / empty / error | Éditer niveau · Supprimer · Reset mdp · Ajouter |

### 5.4 Composants (dans `apps/web/components/parent/`)
- `child-card.tsx` : carte enfant du dashboard.
- `children-table.tsx` : table + menu d'actions par ligne.
- `add-child-dialog.tsx` : formulaire (prénom, nom, username, mot de passe, date de
  naissance, niveau) → `POST /api/parent/children`.
- `edit-child-dialog.tsx` : select niveau → `PATCH /api/parent/children/:id`.
- `reset-password-dialog.tsx` : nouveau mot de passe → `PATCH /api/parent/children/:id`.
- `delete-child-dialog.tsx` : `AlertDialog` de confirmation → `DELETE /api/parent/children/:id`.

### 5.5 Validation formulaire (alignée backend / mobile)
- `username` : 3–30 caractères, `[a-zA-Z0-9_.]`.
- `password` : ≥ 8 caractères, au moins une majuscule, une minuscule, un chiffre.
- `dateOfBirth` : `YYYY-MM-DD`, âge 5–19 ans.
- `schoolLevel` : valeur présente dans `/api/education/levels` (défaut `sixieme`).
- Validation à la **frontière** (saisie utilisateur) ; pas de double-validation interne.
  Les erreurs serveur (ex. username déjà pris) sont affichées en bannière du dialog.

### 5.6 Endpoints consommés (Lot 1)
`GET /api/parent/dashboard` · `GET /api/parent/children` · `POST /api/parent/children` ·
`PATCH /api/parent/children/:id` · `DELETE /api/parent/children/:id` ·
`GET /api/education/levels` · `GET /api/subscriptions/status`.

## 6. Vérification (par lot, avant de passer au suivant)

1. `docker compose up -d` (postgres + ai-service + qdrant) puis `pnpm seed`
   (parent `dev.parent@tomai.local` / `DevParent123!`, élève `dev.eleve` / `DevEleve123!`).
2. `pnpm dev:web` + backend (`pnpm dev:server`).
3. Vérification de visu : login parent → `/parent` affiche l'enfant seedé → créer un
   enfant via le dialog → il apparaît → éditer niveau → reset mdp → supprimer.
   Observer loading/empty/error réels, pas seulement le happy path.
4. `cd apps/web && pnpm typecheck && pnpm lint && pnpm test` verts avant commit.

Pas de tests e2e automatisés écrits (demande utilisateur : vérification manuelle de visu).

## 7. Risques & points ouverts
- **Cookie cross-site en prod** : web (Vercel) et server (Koyeb) sur domaines distincts →
  cookie de session `SameSite=None; Secure` + CORS `credentials` requis. OK en dev
  (host-only `localhost`). À valider côté serveur lors du déploiement (hors Lot 1).
- **Forme exacte des réponses** (`/api/parent/dashboard`, `/api/subscriptions/status`) :
  dérivée du contrat Eden au moment de l'impl via `ResponseData<...>` — ne pas présumer
  les champs, lire le type généré.
- **`@tanstack/react-query` + Next 16 App Router** : vérifier le pattern provider officiel
  (QueryClient via `useState`, pas de refetch SSR involontaire) à l'implémentation.
