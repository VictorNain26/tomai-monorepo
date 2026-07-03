# ADR 0001 — App conso universelle (Expo Router), web Next.js réservé landing + B2B

- **Statut** : Accepté
- **Date** : 2026-06-30
- **Décideur** : Victor (tech lead)
- **Portée** : architecture cross-plateforme du produit (web + mobile)

## Contexte

Aujourd'hui le produit conso (parents/élèves) est développé **deux fois** : `apps/web` (Next.js 16 + shadcn, DOM) et `apps/mobile` (Expo + NativeWind + React Native Reusables, RN). On partage déjà les types backend (`@repo/api`, Eden) et les tokens (`@repo/tokens`), mais **toute l'UI et la plupart des hooks métier sont réécrits à l'identique** (constaté en Lot 2 : `useConversations` web = quasi-copie du mobile). Coût récurrent croissant : chaque feature, fix, refonte = 2×.

Fait produit déterminant : **hors Pronote (déjà mobile-only), le produit web ≈ le produit mobile**. Le mobile est le produit principal (RevenueCat et Pronote mobile-only).

Le paysage 2026 a changé : **Expo Router fait du SEO en production via le static rendering** (HTML pré-rendu, crawlable) + API `generateMetadata` façon Next.js (SDK 56). SSR par-requête (alpha) et RSC (preview) ne sont pas requis derrière auth. La règle Expo : « produit principal = mobile, web = surface compagnon → une codebase ». Ce qui justifiait d'écarter React Native Web (« maintenance-only ») n'est plus exact : c'est le substrat maintenu du web Expo.

Sources : [Expo static rendering](https://docs.expo.dev/router/web/static-rendering/), [Expo SSR (alpha)](https://docs.expo.dev/router/web/server-rendering/), [Expo RSC (preview)](https://docs.expo.dev/guides/server-components/), [TanStack Query RN](https://tanstack.com/query/v5/docs/framework/react/react-native).

## Décision

**Architecture hybride, chaque surface sur le bon outil, le tout DRY :**

1. **Produit conso (parents/élèves)** = **une seule app Expo Router universelle** ciblant iOS + Android + **web**. C'est le cœur du gain : UI + navigation + hooks écrits **une fois**.
2. **`apps/landing`** reste **Next.js** (marketing/SEO/RSC) — aucun overlap mobile, rien à mutualiser. Garde `@repo/ui` (shadcn).
3. **Console B2B établissement** (futur) = **app Next.js dédiée** le jour venu (desktop dense : tables, reporting — là où RNW est faible). Pas d'overlap mobile.
4. **Pronote** = module **natif-only** dans l'app universelle (gate plateforme). Les credentials chiffrés ne touchent jamais le web (plus sûr).
5. **Pas de nouveau package de logique partagée.** Un seul codebase = les hooks/écrans conso vivent dans l'app et sont **réutilisés tels quels** (`apps/mobile` les contient déjà). Les coutures plateforme (streaming SSE, storage) se gèrent **dans l'app** via la convention native Expo `.web.ts`/`.native.ts` — pas d'abstraction maison. On garde les packages partagés légitimes : `@repo/api` (types Eden), `@repo/tokens`.

**`apps/web` (Next.js conso) est supprimé au cutover** — pas de coexistence longue.

## Conséquences

- **Devient legacy → supprimé au cutover (phase dédiée, pas laissé en place)** :
  - `apps/web` (toute l'app conso Next.js : auth/login, dashboard parent Lot 1, chat Lot 2).
  - Les usages de `@repo/ui` **dans la conso** (pas dans la landing : `@repo/ui` **reste** pour landing + futur B2B).
- **L'app universelle** : `apps/mobile` (qui contient **déjà** tout le produit conso — hooks + écrans) gagne la cible web (Expo Router web, static rendering + métadonnées) ; ses écrans existants servent le web (**réutilisés, pas recréés**), avec adaptation responsive + coutures plateforme. Renommée **`apps/app`** au cutover (le nom « mobile » deviendrait trompeur = source de confusion future).
- **Déploiement** : web Expo → Vercel ou EAS Hosting ; natif → EAS (inchangé). La landing → Vercel (inchangé).
- **Doc réconciliée à l'état final (zéro contradiction)** : `apps/web/CLAUDE.md` supprimé ; `apps/mobile/CLAUDE.md` → `apps/app/CLAUDE.md` réécrit (universel, plus « jamais de composants partagés avec le web ») ; `CLAUDE.md` racine (table stack + walk-up) mis à jour ; specs/plans web obsolètes marqués *superseded* ; mémoires mises à jour. Pointeur vers cet ADR.
- **Auth** : Better Auth cross-origin déjà en place côté web — à valider sur cible Expo-web (cookies/session) dès le pilote.

## Risques & atténuations

- **RNW faible en desktop dense** → on n'y met **pas** le B2B (reste Next.js). Le conso (chat, cartes, dashboards simples) mappe bien sur RNW.
- **Expo SSR/RSC alpha/preview** → sans impact : derrière auth, **static rendering** suffit ; le SEO vit dans la landing Next.js.
- **a11y / interactions web complexes sur RNW** → à mesurer **au pilote** (gate go/no-go) avant la bascule complète.
- **Coût** → on ne réécrit **pas** le conso (les écrans mobile existent et sont réutilisés sur web) ; le coût = activer la cible web + adapter responsive/coutures plateforme + supprimer le doublon `apps/web`. Minimal **maintenant** (`apps/web` n'a que 2 lots) ; chaque lot Next.js ajouté ensuite renchérit la suppression du doublon → fenêtre la moins chère = maintenant.

## Alternatives écartées

- **Statu quo + partage logique seul** : ne tue que ~50 % du double (la logique) ; l'UI reste 2× → taxe de maintenance permanente. Rejeté (l'objectif est la maintenabilité long terme).
- **Tamagui (Next.js + Expo, UI écrite une fois)** : garde Next.js mais conserve deux build-systems et parie sur un écosystème plus petit ; **v2 encore en RC** (risque de maintenabilité). Rejeté.

## Garde-fou d'exécution

Aucun état cassé intermédiaire : `apps/web` **reste fonctionnel** jusqu'à ce que l'app universelle atteigne la **parité** ; alors **un seul cutover** supprime le legacy + réconcilie la doc. Détail séquencé : `docs/superpowers/plans/2026-06-30-universal-app-migration.md`.
