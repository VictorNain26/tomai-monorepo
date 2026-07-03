# Migration app conso universelle — Roadmap phasée

> Référence décision : `docs/adr/0001-universal-consumer-app.md`. Ce document séquence l'exécution. **Chaque phase = une PR qui passe au vert ; l'app reste fonctionnelle tout du long ; le legacy n'est supprimé qu'au cutover.** Chaque phase reçoit son plan tâche-par-tâche détaillé quand on l'attaque.

**But :** produit conso (parents/élèves) servi par **une seule app Expo Router universelle** (iOS/Android/web), landing en Next.js, Pronote natif-only — **zéro legacy, zéro doc contradictoire à l'état final**.

**Principe directeur :** on **réutilise** ce qui existe (`apps/mobile` est déjà un produit conso complet : hooks + écrans), on **ne recrée rien**, on s'appuie sur les outils du framework. Pas de coexistence longue : on amène l'app universelle sur web **jusqu'à parité** pendant que `apps/web` tourne, puis **un seul cutover** supprime le doublon `apps/web` + réconcilie la doc.

## Périmètre tech : ce qu'on garde vs ce qu'on supprime

- **Gardé (asset)** : `apps/mobile` (le produit conso existant — réutilisé, c'est lui qui devient l'app universelle) ; backend Bun + Elysia + Drizzle + **Eden Treaty** ; AI/RAG souverain EU ; monorepo Turborepo + pnpm ; `@repo/api`, `@repo/tokens` ; `@repo/ui` (shadcn) **pour la landing + futur B2B**.
- **Supprimé au cutover** : `apps/web` (le doublon conso DOM/Next.js — auth, dashboard parent Lot 1, chat Lot 2) et ses usages propres de `@repo/ui`.
- **PAS de nouveau package** de logique partagée : un seul codebase, les hooks/écrans vivent dans l'app. Coutures plateforme (streaming SSE, storage) via la convention **native Expo `.web.ts`/`.native.ts`** — pas d'abstraction maison.
- **UI** : NativeWind + React Native Reusables + `@repo/tokens`, déjà la techno mobile (compile en CSS sur web).

---

## Phase 1 — Cible web Expo + **pilote** (gate go/no-go)

**Livrables :**
- Activer la cible **web** sur `apps/mobile` : Expo Router web, `output: static` (rendu statique), `+html.tsx`, métadonnées `generateMetadata`.
- **Better Auth sur web Expo** : valider session/cookies cross-origin (déjà OK côté Next.js — confirmer l'équivalent sur Expo-web).
- **Servir UN écran existant** (le chat élève — réutilisé tel quel) sur la cible web. Première couture plateforme à traiter : le **streaming** (`useStreamManager` mobile = react-native-sse) → variante web via `.web.ts` (fetch SSE).

**Mesures (gate) :** DX, perf web (LCP/CLS), **a11y** (clavier/focus/lecteurs d'écran sur RNW), parité visuelle via `@repo/tokens`, auth fonctionnelle.

**Décision :** **GO** → Phase 2. **NO-GO** → repli documenté (statu quo, ou Tamagui) ; coût limité à un écran. *(L'ADR assume GO ; ce gate existe pour le prouver, doc-first/mesuré.)*

**État après :** `apps/web` toujours en prod ; l'universel a un écran web prouvé. Aucun legacy supprimé.

---

## Phase 2 — Reste du produit conso sur web (réutiliser + adapter)

**Livrables :** amener les écrans conso **existants** sur la cible web — **réutilisés**, adaptés au responsive/desktop + coutures plateforme restantes :
- auth/login, dashboard parent, chat complet + liste de conversations, profil mémoire élève.
- Pronote reste **natif-only** (non exposé sur web — gate plateforme).

**Gate :** parité vérifiée écran par écran (vérif comportementale) ; le web Expo couvre 100 % de ce que `apps/web` faisait.

**État après :** deux surfaces web équivalentes coexistent **brièvement** (validation parité) — seule fenêtre de coexistence, fermée par la Phase 3.

---

## Phase 3 — **Cutover** (suppression du legacy)

**Livrables (un seul PR de bascule, atomique) :**
- **Supprimer `apps/web`** (tout le doublon conso Next.js).
- **Renommer `apps/mobile` → `apps/app`** — ajuster imports, EAS, CI, `turbo.json`, `pnpm-workspace.yaml`, scripts racine (`pnpm dev`, ports).
- **Déploiement** : router le domaine produit web vers le déploiement Expo-web (Vercel/EAS Hosting) ; retirer le Vercel de `apps/web`.
- Retirer les usages `@repo/ui` propres à la conso (**garder** `@repo/ui` pour `apps/landing` + futur B2B).

**Gate :** build + déploiement preview verts ; le produit web tourne depuis l'app universelle ; `apps/web` n'existe plus ; aucune référence morte.

**État après :** **zéro legacy conso.** Une seule codebase produit.

---

## Phase 4 — Réconciliation de la doc (zéro contradiction)

**Livrables :** la doc reflète l'état final, plus aucune trace de l'ancien modèle « web ≠ mobile / RNW écarté » :
- **Supprimer** `apps/web/CLAUDE.md`.
- **Réécrire** `apps/mobile/CLAUDE.md` → `apps/app/CLAUDE.md` : app universelle (iOS/Android/web), plus de « jamais de composants partagés avec le web », cible web Expo, Pronote natif-only.
- **`CLAUDE.md` racine** : table stack (Web = Expo universel, plus Next.js conso), commandes/ports, walk-up.
- **Specs/plans web obsolètes** marqués *superseded by ADR 0001* (`2026-06-29-web-parcours-parent-eleve-design.md`, `2026-06-30-web-chat-lot2-conversations.md`, autres `web-*`).
- **Mémoires** mises à jour → pointer l'ADR, retirer les affirmations devenues fausses.
- **`.claude/rules/`** : vérifier qu'aucune règle ne contredit le pivot.

**Gate :** `grep` sur les termes de l'ancien modèle (`react-native-web`, « ne partage pas ses composants », `apps/web`) → plus aucune occurrence active (hors ADR/plan qui historisent).

**État après :** **une seule source de vérité.**

---

## Ordre & cadence

Phases 1 → 4 séquentielles, **une PR par phase, mergée au fil de l'eau** (`main` toujours à jour — gelé tant que le quota GitHub Actions n'est pas rétabli). Phase 1 porte le gate décisif. Le legacy (code + doc) tombe en bloc aux Phases 3-4.

**Prochain pas :** Phase 1 (cible web Expo + pilote chat) — plan tâche-par-tâche au démarrage.
