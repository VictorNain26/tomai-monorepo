# Migration app conso universelle — Roadmap phasée

> Référence décision : `docs/adr/0001-universal-consumer-app.md`. Ce document séquence l'exécution. **Chaque phase = une PR qui passe au vert ; l'app reste fonctionnelle tout du long ; le legacy n'est supprimé qu'au cutover (Phase 4).** Chaque phase reçoit son plan tâche-par-tâche détaillé (façon Lot 1/2/3) quand on l'attaque.

**But :** produit conso (parents/élèves) en une seule app Expo Router universelle (iOS/Android/web), landing en Next.js, Pronote natif-only, logique partagée — **zéro legacy, zéro doc contradictoire à l'état final**.

**Principe anti-conflit :** pas de coexistence longue de deux stacks conso. On construit l'universel **jusqu'à parité** pendant que `apps/web` continue de tourner, puis **un seul cutover** supprime `apps/web` + réconcilie la doc.

## Périmètre tech : ce qu'on garde vs ce qu'on rebâtit

On rebâtit **là où ça paie**, on garde **ce qui est déjà optimal** (revisiter une techno saine = temps perdu).

- **Gardé (asset, pas legacy)** : backend Bun + Elysia + Drizzle + **Eden Treaty** (le partage de types end-to-end est ce qui rend l'universel DRY) ; AI/RAG souverain EU (Mistral, Qdrant, BGE-M3) ; monorepo Turborepo + pnpm ; `@repo/api`, `@repo/tokens` ; `@repo/ui` (shadcn) **pour la landing + futur B2B**.
- **Rebâti à neuf (pas porté)** : le front conso. Vu la latitude « supprimer/reprendre », on **réécrit proprement** les écrans conso dans l'app universelle (plus net qu'un port ligne à ligne), puis suppression en bloc de `apps/web`.
- **UI universelle** : **NativeWind + React Native Reusables** (équivalent shadcn pour RN, déjà la techno mobile, compile en CSS sur web) + `@repo/tokens` → un seul système de composants web + mobile.

---

## Phase 1 — `@repo/chat-core` (logique partagée) — *sans regret*

**Pourquoi en premier :** valable quel que soit le verdict du pilote (même en statu quo, ça tue la moitié du double). Dé-risque le reste.

**Livrables :**
- Package `packages/chat-core` : hooks headless TanStack Query (ex. `useConversations`, `useChat`, `useStudentMemory`), validation, formatage — **aucune UI, aucune nav, aucun provider**.
- Différences plateforme isolées par fichiers `.web.ts`/`.native.ts` + condition `"react-native"` du `exports` (storage, env). Navigation = callback injecté (pas d'import `next/navigation` ni `expo-router`).
- **Câblé dans les DEUX apps existantes** (`apps/web` + `apps/mobile`) qui consomment le package au lieu de leurs hooks dupliqués → preuve immédiate que le partage marche, et suppression de la duplication actuelle.

**Gate :** `apps/web` et `apps/mobile` typecheck + lint + tests verts en consommant `@repo/chat-core`. Aucun `react-native` ne fuit dans le bundle web.

**État après :** rien de cassé, duplication logique éliminée, socle prêt. *(Plan détaillé à rédiger au démarrage de la phase.)*

---

## Phase 2 — Cible web Expo + **pilote** (gate go/no-go)

**Livrables :**
- Activer la cible **web** sur l'app Expo (`apps/mobile`) : Expo Router web, `output: static` (rendu statique), `+html.tsx`, métadonnées `generateMetadata`.
- **Better Auth sur web Expo** : valider session/cookies cross-origin (déjà OK côté Next.js — confirmer l'équivalent sur Expo-web).
- **Migrer UN écran** (le chat élève) servi sur la cible web, consommant `@repo/chat-core` (Phase 1).

**Mesures (gate) :** DX, perf web (LCP/CLS via le static rendering), **a11y** (clavier/focus/lecteurs d'écran sur RNW), parité visuelle via `@repo/tokens`, auth fonctionnelle.

**Décision :** **GO** → on continue Phase 3. **NO-GO** → repli documenté (statu quo + `@repo/chat-core` déjà acquis, ou Tamagui) ; coût limité à un écran. *(L'ADR assume GO mais ce gate existe pour le prouver.)*

**État après :** `apps/web` toujours en prod ; l'universel a un écran web prouvé. Pas de legacy supprimé.

---

## Phase 3 — Parité conso sur l'app universelle (rebâtie à neuf)

**Livrables :** **rebâtir à neuf** (pas porter) les écrans conso dans l'app universelle, à **parité fonctionnelle** avec `apps/web` :
- auth/login,
- dashboard parent (Lot 1),
- chat élève complet + liste de conversations (Lot 2),
- consultation/édition mémoire (Lot 3b, si pas encore fait — sinon livré directement en universel).
Réutilise `@repo/chat-core`, `@repo/api`, `@repo/tokens`. Pronote reste **natif-only** (non exposé sur web).

**Gate :** parité vérifiée écran par écran (vérif comportementale, ta méthode) ; tout vert ; le web Expo couvre 100 % de ce que `apps/web` faisait.

**État après :** deux surfaces web équivalentes coexistent **brièvement** (le temps de valider la parité) — c'est la seule fenêtre de coexistence, fermée immédiatement par la Phase 4.

---

## Phase 4 — **Cutover** (suppression du legacy)

**Livrables (un seul PR de bascule, atomique) :**
- **Supprimer `apps/web`** (toute l'app conso Next.js).
- **Renommer `apps/mobile` → `apps/app`** (le nom « mobile » devient trompeur) — ajuster imports, EAS, CI, `turbo.json`, `pnpm-workspace.yaml`, scripts racine (`pnpm dev`, ports).
- **Déploiement** : router le domaine produit web vers le déploiement Expo-web (Vercel/EAS Hosting) ; retirer le déploiement Vercel de `apps/web`.
- Retirer les usages `@repo/ui` propres à la conso (**garder** `@repo/ui` pour `apps/landing` + futur B2B).

**Gate :** build + déploiement preview verts ; le produit web tourne depuis l'app universelle ; `apps/web` n'existe plus ; aucune référence morte (CI, imports, turbo).

**État après :** **zéro legacy conso.** Une seule codebase produit.

---

## Phase 5 — Réconciliation de la doc (zéro contradiction)

**Livrables :** la doc reflète exactement l'état final, plus aucune trace de l'ancien modèle « web ≠ mobile / RNW écarté » :
- **Supprimer** `apps/web/CLAUDE.md`.
- **Réécrire** `apps/mobile/CLAUDE.md` → `apps/app/CLAUDE.md` : app universelle (iOS/Android/web), plus de « jamais de composants partagés avec le web », cible web Expo, Pronote natif-only.
- **`CLAUDE.md` racine** : table stack (Web = Expo universel, plus Next.js conso), commandes (`pnpm dev` ports), walk-up.
- **Specs/plans web obsolètes** marqués *superseded by ADR 0001* : `docs/superpowers/specs/2026-06-29-web-parcours-parent-eleve-design.md`, `docs/superpowers/plans/2026-06-30-web-chat-lot2-conversations.md`, et les autres plans `web-*`.
- **Mémoires** mises à jour (`chantier-web-parcours-parent-eleve`, etc.) → pointer l'ADR, retirer les affirmations devenues fausses.
- **`.claude/rules/`** : vérifier qu'aucune règle ne contredit le pivot.

**Gate :** `grep` sur les termes de l'ancien modèle (`react-native-web`, « ne partage pas ses composants », `apps/web`) → plus aucune occurrence active (hors cet ADR/plan qui historisent la décision).

**État après :** **une seule source de vérité.** Aucun conflit futur possible par doc contradictoire.

---

## Ordre & cadence

Phases 1 → 5 séquentielles, **une PR par phase, mergée au fil de l'eau** (`main` toujours à jour). Phase 2 porte le gate décisif. Le legacy (code + doc) tombe en bloc aux Phases 4-5, pas avant — pas d'état intermédiaire bancal.

**Prochain pas :** Phase 1 (`@repo/chat-core`) — je rédige son plan tâche-par-tâche et on exécute.
