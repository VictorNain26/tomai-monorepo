> **⚠️ SUPERSEDED (2026-07-01)** — `apps/web` est legacy : décision [ADR 0001](../../adr/0001-universal-consumer-app.md) (app conso universelle Expo, PR #260) + audit `docs/audits/2026-07-01-curriculum-to-frontend-architecture.md`. Aucun nouveau lot web Next ; suppression d'apps/web au cutover. Document conservé comme trace historique.

# Web Lot 1 — Fondation Eden Treaty + parent CRUD — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Câbler `apps/web` au backend via Eden Treaty et livrer le parcours parent (dashboard + CRUD enfants) réellement fonctionnel.

**Architecture:** Client-side data avec TanStack Query v5 + Eden Treaty (`@repo/api`), en miroir du hook mobile `useParentDashboard`. UI via primitives shadcn ajoutées à `@repo/ui`. Auth par cookie de session cross-origin (le navigateur l'envoie automatiquement ; `getTreaty()` met déjà `credentials: 'include'`).

**Tech Stack:** Next.js 16 (App Router), React 19, `@tanstack/react-query` ^5, `@repo/api` (Eden Treaty), `@repo/ui` (shadcn), `@repo/tokens`, Better Auth client.

## Global Constraints

- **Validation = manuelle/visuelle, pas de tests automatisés écrits** (demande utilisateur). Les tests Vitest existants (`apps/web`) doivent rester **verts**.
- **Validation obligatoire avant chaque commit** : `cd apps/web && pnpm typecheck && pnpm lint && pnpm test` (et `pnpm typecheck` dans `@repo/ui` si modifié). Le typecheck web exige `apps/server/dist/types/app.d.ts` → lancer une fois `cd apps/server && bun run build:types` (ou `pnpm turbo typecheck` depuis la racine).
- **UI** : aucun composant custom dans `apps/web` → primitives dans `@repo/ui` ; zéro CSS/inline → Tailwind + tokens `@repo/tokens`.
- **TypeScript strict, zéro `any`.** React 19 (pas de `forwardRef`, ref = prop).
- **Types dérivés du contrat serveur** via `ResponseData<...>` / `Parameters<...>` — jamais recopiés à la main.
- **Stager les fichiers explicitement** (jamais `git add .`). Conventional commits, scope `web`.
- Branche : `feat/web-lot1-parent-crud` (déjà créée).

---

### Task 1 : Socle — deps, init API, Providers, exposition session

**Files:**
- Modify: `apps/web/package.json` (deps)
- Create: `apps/web/lib/api.ts`
- Modify: `apps/web/lib/auth-client.ts`
- Create: `apps/web/components/providers.tsx`
- Modify: `apps/web/app/layout.tsx`

**Interfaces:**
- Produces:
  - `apps/web/lib/api.ts` → `export function initApi(): void` (idempotent, appelle `initializeApi({ baseUrl })`).
  - `apps/web/lib/auth-client.ts` → ajoute `export const { signIn, signUp, signOut, useSession } = authClient;` et `export function useUser()` (retourne `useSession().data?.user ?? null`).
  - `apps/web/components/providers.tsx` → `export function Providers({ children }: { children: React.ReactNode })` (Client Component).

- [ ] **Step 1: Ajouter les dépendances**

Dans `apps/web/package.json`, section `dependencies`, ajouter :
```json
"@repo/api": "workspace:*",
"@tanstack/react-query": "^5.90.20"
```

- [ ] **Step 2: Installer**

Run: `pnpm install`
Expected: installe `@tanstack/react-query`, lie `@repo/api`.

- [ ] **Step 3: `lib/api.ts` — init Eden Treaty**

```ts
import { initializeApi } from "@repo/api";

const baseUrl = process.env.NEXT_PUBLIC_SERVER_URL ?? "http://localhost:3000";

let initialized = false;

/** Idempotent : initialise le client Eden Treaty (URL backend). */
export function initApi(): void {
  if (initialized) return;
  initializeApi({ baseUrl });
  initialized = true;
}
```

- [ ] **Step 4: Exposer `useSession` + `useUser`**

Dans `apps/web/lib/auth-client.ts`, remplacer la ligne d'export par :
```ts
export const { signIn, signUp, signOut, useSession } = authClient;

/** Utilisateur courant (ou null) — pour activer les requêtes data. */
export function useUser() {
  return useSession().data?.user ?? null;
}
```

- [ ] **Step 5: `components/providers.tsx`**

```tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { setUnauthorizedHandler } from "@repo/api";
import { initApi } from "@/lib/api";

initApi();

export function Providers({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: { queries: { staleTime: 60_000, retry: 1, refetchOnWindowFocus: false } },
      }),
  );

  useEffect(() => {
    setUnauthorizedHandler(() => router.push("/login"));
  }, [router]);

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
```

- [ ] **Step 6: Monter `Providers` + `Toaster` dans le layout**

Dans `apps/web/app/layout.tsx`, envelopper `{children}` du `ThemeProvider` (ou racine) avec `<Providers>`, et monter `<Toaster />` (importé de `@repo/ui` — créé Task 2 ; si Task 2 pas encore faite, ajouter le Toaster à ce moment). Ne pas dupliquer le `ThemeProvider`.

- [ ] **Step 7: Vérifier**

Run: `cd apps/server && bun run build:types` puis `cd apps/web && pnpm typecheck && pnpm lint && pnpm test`
Expected: typecheck/lint OK, tests existants verts.
Run: `pnpm dev:web` (avec backend lancé) → l'app démarre, `/login` se charge sans erreur console.

- [ ] **Step 8: Commit**

```bash
git add apps/web/package.json apps/web/lib/api.ts apps/web/lib/auth-client.ts apps/web/components/providers.tsx apps/web/app/layout.tsx pnpm-lock.yaml
git commit -m "feat(web): wire Eden Treaty + TanStack Query provider foundation"
```

---

### Task 2 : Enrichir `@repo/ui` avec les primitives shadcn

**Files:**
- Modify: `packages/ui/package.json` (deps Radix + sonner)
- Create: `packages/ui/src/components/{input,label,dialog,alert-dialog,select,table,skeleton,sonner,badge,avatar}.tsx`
- Modify: `packages/ui/src/index.ts` (exports)

**Interfaces:**
- Produces: exports nommés depuis `@repo/ui` — `Input`, `Label`, `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle`/`DialogDescription`/`DialogFooter`/`DialogTrigger`, `AlertDialog`/... , `Select`/`SelectTrigger`/`SelectContent`/`SelectItem`/`SelectValue`, `Table`/`TableHeader`/`TableBody`/`TableRow`/`TableHead`/`TableCell`, `Skeleton`, `Toaster` (sonner), `Badge`, `Avatar`/`AvatarImage`/`AvatarFallback`.

- [ ] **Step 1: Ajouter les dépendances Radix + sonner**

Dans `packages/ui/package.json` `dependencies` : `@radix-ui/react-dialog`, `@radix-ui/react-alert-dialog`, `@radix-ui/react-select`, `@radix-ui/react-label`, `@radix-ui/react-avatar`, `sonner`. Run `pnpm install`.

- [ ] **Step 2: Générer les primitives shadcn**

Copier les primitives depuis le registre shadcn officiel (https://ui.shadcn.com/docs/components), adaptées au repo : remplacer `@/lib/utils` par le `cn` local de `@repo/ui` (cf. `packages/ui/src/lib`), classes via tokens existants (mêmes conventions que `button.tsx`/`card.tsx`). Une primitive par fichier listé.
**Doc-first** : suivre le code de chaque composant sur le site shadcn (Radix sous-jacent) — ne pas réinventer les primitives accessibles.

- [ ] **Step 3: Exporter depuis `index.ts`**

Ajouter les `export * from "./components/<name>"` pour chaque nouveau fichier.

- [ ] **Step 4: Vérifier**

Run: `cd packages/ui && pnpm typecheck && pnpm lint` puis `cd apps/web && pnpm typecheck`
Expected: OK.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/package.json packages/ui/src/components packages/ui/src/index.ts pnpm-lock.yaml
git commit -m "feat(ui): add shadcn primitives needed for parent CRUD screens"
```

---

### Task 3 : Hooks data parent (web)

**Files:**
- Create: `apps/web/lib/hooks/use-parent-dashboard.ts`
- Create: `apps/web/lib/hooks/use-subscription-status.ts`

**Interfaces:**
- Consumes: `getTreaty`, `unwrap`, `ResponseData` (`@repo/api`) ; `useUser` (`@/lib/auth-client`).
- Produces:
  - `useParentDashboard()` → `{ children, childrenCount, isLoading, isError, errorMessage, levels, createChild, updateChild, deleteChild, isCreating, isUpdating, isDeleting, userName }`. Types `IChild`, `ICreateChildData` exportés.
  - `useSubscriptionStatus()` → `{ data, isLoading, isError }` (query `parentId = user.id`).

- [ ] **Step 1: `use-parent-dashboard.ts`**

Porter le hook mobile `apps/mobile/src/hooks/useParentDashboard.ts` quasi à l'identique. Différences :
- `import { useUser } from "@/lib/auth-client";` (au lieu du `@/lib/auth` mobile).
- Conserver la dérivation de types via `ResponseData<...>` et les appels `getTreaty().api.parent...`.
- Ajouter `resetPassword` (alias d'`updateChild` avec `{ password }`) si utile, sinon réutiliser `updateChild`.
Exporter `IChild` et `ICreateChildData`.

```ts
type ParentApi = ReturnType<typeof getTreaty>["api"]["parent"];
export type IChild = ResponseData<ParentApi["children"]["get"]>[number];
export type ICreateChildData = NonNullable<Parameters<ParentApi["children"]["post"]>[0]>;
```

- [ ] **Step 2: `use-subscription-status.ts`**

```ts
import { useQuery } from "@tanstack/react-query";
import { getTreaty, unwrap } from "@repo/api";
import { useUser } from "@/lib/auth-client";

export function useSubscriptionStatus() {
  const user = useUser();
  return useQuery({
    queryKey: ["subscriptions", "status", user?.id],
    enabled: !!user?.id,
    queryFn: async () =>
      unwrap(
        await getTreaty().api.subscriptions.status.get({
          query: { parentId: user!.id },
        }),
      ),
    staleTime: 5 * 60 * 1000,
  });
}
```
Note impl : `GET /api/subscriptions/status` exige le query param `parentId` (cf. `status.routes.ts`). Dériver le type de retour via `ResponseData<...>` plutôt que le présumer.

- [ ] **Step 3: Vérifier**

Run: `cd apps/web && pnpm typecheck && pnpm lint`
Expected: OK (les types Eden résolvent les formes de réponse).

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/hooks
git commit -m "feat(web): add parent dashboard + subscription status hooks"
```

---

### Task 4 : Écran dashboard parent `/parent`

**Files:**
- Modify: `apps/web/app/parent/page.tsx` (devient Client Component)
- Create: `apps/web/components/parent/child-card.tsx`
- Create: `apps/web/components/parent/subscription-card.tsx`

**Interfaces:**
- Consumes: `useParentDashboard`, `useSubscriptionStatus`, primitives `@repo/ui`.
- Produces: page `/parent` câblée.

- [ ] **Step 1: `child-card.tsx`**

Carte enfant (prop `child: IChild`) : `Avatar` (initiale), nom complet, `Badge` niveau, ligne d'activité si dispo. Toute la carte est un lien/bouton accessible vers `/parent/enfants` (focus visible, cible ≥44px). Tokens uniquement.

- [ ] **Step 2: `subscription-card.tsx`**

`Card` affichant le statut d'abonnement en **lecture seule** depuis `useSubscriptionStatus()` (plan famille / état). États loading (`Skeleton`) et error (texte discret). Mention « Gestion via l'app mobile ». Aucun bouton d'achat.

- [ ] **Step 3: Réécrire `app/parent/page.tsx`**

`"use client"`. Utiliser `useParentDashboard()` :
- `isLoading` → grille de `Skeleton`.
- `isError` → `Card` d'erreur + bouton « Réessayer » (refetch).
- `children.length === 0` → état vide : « Aucun enfant lié » + bouton « Ajouter un enfant » (lien vers `/parent/enfants`).
- sinon → titre « Bonjour {userName} », grille de `ChildCard` + `SubscriptionCard`.
Header : bouton « Ajouter un enfant » → navigue vers `/parent/enfants`.

- [ ] **Step 4: Vérifier (typecheck + lint + tests)**

Run: `cd apps/web && pnpm typecheck && pnpm lint && pnpm test`
Expected: OK, tests existants verts.

- [ ] **Step 5: Vérification visuelle**

Backend lancé (`docker compose up -d` + `pnpm seed` + `pnpm dev:server`) + `pnpm dev:web`. Se connecter avec `dev.parent@tomai.local` / `DevParent123!`. Attendu : `/parent` affiche l'enfant seedé (carte) + carte abonnement ; rafraîchir montre l'état réel (pas de placeholder). Vérifier loading/empty/error en conditions réelles (ex. backend coupé → état erreur).

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/parent/page.tsx apps/web/components/parent
git commit -m "feat(web): wire parent dashboard to backend"
```

---

### Task 5 : Gestion enfants `/parent/enfants` + dialogs CRUD

**Files:**
- Modify: `apps/web/app/parent/enfants/page.tsx`
- Create: `apps/web/components/parent/children-table.tsx`
- Create: `apps/web/components/parent/add-child-dialog.tsx`
- Create: `apps/web/components/parent/edit-child-dialog.tsx`
- Create: `apps/web/components/parent/reset-password-dialog.tsx`
- Create: `apps/web/components/parent/delete-child-dialog.tsx`
- Create: `apps/web/lib/validation/child.ts`

**Interfaces:**
- Consumes: `useParentDashboard` (mutations + `levels`), primitives `@repo/ui`, `Toaster`.
- Produces: `validateChildForm(input)` → `{ ok: true; data } | { ok: false; errors: Record<string,string> }`.

- [ ] **Step 1: `lib/validation/child.ts` — règles alignées backend**

Fonctions de validation (frontière) reproduisant les règles Zod serveur :
- `username` : 3–30 caractères, `^[a-zA-Z0-9_.]+$`.
- `password` : ≥8, au moins 1 majuscule, 1 minuscule, 1 chiffre.
- `dateOfBirth` : `YYYY-MM-DD`, âge calculé 5–19 ans.
- `firstName`/`lastName` : non vides.
- `schoolLevel` : présent dans `levels`.
Pas de dépendance nouvelle (helpers simples, pas de react-hook-form — YAGNI).

- [ ] **Step 2: `add-child-dialog.tsx`**

`Dialog` contrôlé. Champs : prénom, nom, username, mot de passe, date de naissance (`Input type="date"`), niveau (`Select` peuplé via `levels`). Bouton submit `disabled` si `isCreating`. À la soumission : `validateChildForm` → si erreurs, les afficher sous chaque champ ; sinon `createChild(data)` → succès : toast + fermer + reset ; erreur serveur : bannière dans le dialog (message renvoyé). États hover/focus/disabled/pending complets.

- [ ] **Step 3: `edit-child-dialog.tsx`**

`Dialog` : `Select` niveau pré-rempli. Submit `updateChild({ childId, data: { schoolLevel } })`. Toast succès/erreur.

- [ ] **Step 4: `reset-password-dialog.tsx`**

`Dialog` : champ nouveau mot de passe (validation password). Submit `updateChild({ childId, data: { password } })`. Toast.

- [ ] **Step 5: `delete-child-dialog.tsx`**

`AlertDialog` de confirmation (nom de l'enfant). Confirmer → `deleteChild(childId)`. Toast.

- [ ] **Step 6: `children-table.tsx`**

`Table` : colonnes nom, username, niveau, actions. Menu/boutons par ligne : Éditer, Reset mdp, Supprimer (ouvrent les dialogs). Accessibilité : boutons labellisés, focus visible, cibles ≥44px.

- [ ] **Step 7: Réécrire `app/parent/enfants/page.tsx`**

`"use client"`. `useParentDashboard()` : loading (`Skeleton`) / empty (« Aucun enfant » + bouton Ajouter) / error / liste → `ChildrenTable`. Header : bouton « Ajouter un enfant » (ouvre `AddChildDialog`).

- [ ] **Step 8: Vérifier (typecheck + lint + tests)**

Run: `cd apps/web && pnpm typecheck && pnpm lint && pnpm test`
Expected: OK.

- [ ] **Step 9: Vérification visuelle (parcours complet)**

Backend + web lancés, connecté en parent. Attendu : créer un enfant (formulaire validé, erreurs affichées si saisie invalide, username déjà pris → bannière) → il apparaît dans la table et sur le dashboard → éditer son niveau → reset mot de passe → supprimer (confirmation) → il disparaît. Observer les toasts et les états pending.

- [ ] **Step 10: Commit**

```bash
git add apps/web/app/parent/enfants/page.tsx apps/web/components/parent apps/web/lib/validation
git commit -m "feat(web): add children management (create/edit/reset-password/delete)"
```

---

## Self-Review

- **Spec coverage** : socle (deps/init/providers) → Task 1 ; `@repo/ui` enrichi → Task 2 ; hooks → Task 3 ; dashboard parent → Task 4 ; CRUD enfants + abonnement lecture → Tasks 4-5 ; validation alignée backend → Task 5/Step 1 ; états complets + a11y → Tasks 4-5 ; vérification visuelle → Tasks 4-5. Endpoints `/api/parent/*`, `/api/education/levels`, `/api/subscriptions/status` couverts.
- **Types** : `IChild` / `ICreateChildData` définis Task 3 et réutilisés Tasks 4-5 ; mutations `createChild`/`updateChild`/`deleteChild` cohérentes avec les signatures du hook mobile.
- **Hors Lot 1 (lots suivants)** : détail enfant + lecture Pronote (Lot 2), dashboard élève/chat/FSRS (Lots 3-5).
