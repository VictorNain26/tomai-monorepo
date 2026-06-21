# Login enfant autonome — suppression impersonation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner à chaque enfant un login autonome (identifiant + mot de passe via le plugin `username` de Better Auth) et supprimer toute la machinerie d'impersonation parent→enfant.

**Architecture:** Backend Better Auth : activer le plugin `username`, retirer le plugin `admin`. Mobile : router le chemin « Élève » du login (toggle déjà existant) vers `signIn.username`, supprimer `profile-select`/`child-access-store`/helpers d'impersonation, et remplacer l'empty-state Pronote par un écran d'ajout d'enfant manuel (endpoint générique déjà existant). Le dashboard parent lit déjà les données enfant en session parent (`assertParentOrSelf`) — rien à changer côté data.

**Tech Stack:** Better Auth 1.6 (`username`/`admin` plugins), Elysia, Drizzle, Bun test ; Expo/RN, NativeWind v5, Eden Treaty, jest-expo.

**Spec:** `docs/superpowers/specs/2026-06-21-autonomous-child-login-design.md`

## Global Constraints

- **Pas de prod / pas d'utilisateurs réels** → aucune migration de données, retraits francs.
- **Doc-first** plugin username : [better-auth.com/docs/plugins/username](https://www.better-auth.com/docs/plugins/username) — requiert `username` (string, unique, optional) + `displayUsername` (string, optional) sur la table user (déjà présents : `auth.schema.ts:34-35`).
- **Server** : TypeBox sur chaque route, logique métier en service (jamais en route), validation avant commit `cd apps/server && bun run typecheck && bun run lint && bun run test` **+ `bun run test:integration`** avant push. Piège mock `api-endpoints.test.ts` si un nouveau module tire les schémas Drizzle (cf. `.claude/rules/testing-and-commits.md`).
- **Mobile** : TypeScript strict zéro `any` ; NativeWind only (pas de `StyleSheet`) ; primitives `@/components/ui/` ; a11y WCAG AA (labels, rôles, cibles ≥44pt, contrast 4.5:1) ; tokens `@repo/tokens` ; 400 lignes max/fichier. Validation `cd apps/mobile && pnpm typecheck && pnpm lint && pnpm test`.
- **Frontière de types serveur** (`apps/server/CLAUDE.md`) : le plugin `username()` est un vrai plugin nameable (comme `expo()`/`admin()`), il reste dans le tableau `plugins` sans cast `BetterAuthPlugin[]` (réservé aux dev-only openAPI/mcp).
- **Commits** : conventional, staging explicite (jamais `git add .`), scopes `auth`/`mobile`/`server`. Branche : `feat/autonomous-child-login` (déjà créée).

---

### Task 1: Backend — activer le plugin `username`

**Files:**
- Modify: `apps/server/src/lib/auth.ts` (imports L13 ; `additionalFields` L189-196 ; `plugins` L200-287)
- Test: `apps/server/src/tests/username-login.test.ts` (create)

**Interfaces:**
- Produces: route `POST /api/auth/sign-in/username` (`signIn.username({ username, password })`) ; un compte créé par `parentService.createChild` est connectable par username.

- [ ] **Step 1: Écrire le test qui échoue**

Créer `apps/server/src/tests/username-login.test.ts` :

```ts
import { describe, it, expect } from 'bun:test';
import { auth } from '../lib/auth';
import { parentService } from '../services/parent.service';

describe('Autonomous child username login', () => {
  it('lets a child created by a parent sign in with username + password', async () => {
    const suffix = Math.random().toString(36).slice(2, 8);
    const parent = await auth.api.signUpEmail({
      body: {
        email: `parent_${suffix}@example.test`,
        password: 'parent-password-123',
        name: 'Parent Test',
      },
    });

    const childPassword = 'child-password-123';
    const childUsername = `kid_${suffix}`;
    await parentService.createChild(parent.user.id, {
      firstName: 'Kid',
      lastName: 'Test',
      username: childUsername,
      password: childPassword,
      schoolLevel: 'sixieme',
      dateOfBirth: '2014-05-01',
    });

    const signedIn = await auth.api.signInUsername({
      body: { username: childUsername, password: childPassword },
    });

    expect(signedIn).toBeTruthy();
    expect(signedIn?.user?.username).toBe(childUsername);
  });
});
```

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `cd apps/server && bun run test src/tests/username-login.test.ts`
Expected: FAIL — `auth.api.signInUsername` n'existe pas (plugin absent).

- [ ] **Step 3: Activer le plugin**

Dans `apps/server/src/lib/auth.ts` :

1. L13, ajouter `username` à l'import plugins :
```ts
import { openAPI, mcp, admin, username } from "better-auth/plugins";
```

2. Retirer les champs `username` et `displayUsername` de `user.additionalFields` (L189-196) — le plugin les déclare nativement. Laisser les autres additionalFields intacts.

3. Ajouter `username()` au tableau `plugins`, après `expo()` :
```ts
    expo(),     // Mobile app support (deep links, secure storage)
    username(), // Autonomous child login: sign in with username + password
```

- [ ] **Step 4: Lancer le test, vérifier le succès**

Run: `cd apps/server && bun run test src/tests/username-login.test.ts`
Expected: PASS. (Base dev : `bun run db:push` au préalable si besoin — les colonnes existent déjà, push no-op.)

- [ ] **Step 5: Non-régression auth + types**

Run: `cd apps/server && bun run typecheck && bun run test src/tests/auth-config.test.ts`
Expected: PASS. Si `auth-config.test.ts` assert la liste des additionalFields, adapter l'assertion (username/displayUsername désormais portés par le plugin, pas par additionalFields).

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/lib/auth.ts apps/server/src/tests/username-login.test.ts
git commit -m "feat(auth): enable better-auth username plugin for autonomous child login"
```

---

### Task 2: Backend — supprimer l'impersonation admin

**Files:**
- Modify: `apps/server/src/lib/auth.ts` (import L13 + L23 ; bloc `admin({...})` L210-286 ; commentaire d'en-tête L5-6)
- Delete: `apps/server/src/lib/impersonation-policy.ts` + son test s'il existe (`src/tests/impersonation-policy.test.ts`)
- Test: réutilise `apps/server/src/integration-tests/pronote-data*.test.ts` (non-régression accès parent)

**Interfaces:**
- Produces: plus de routes `/api/auth/admin/*` ; le rôle par défaut `parent` reste assuré par `additionalFields.role.defaultValue` (L171).

- [ ] **Step 1: Retirer le plugin admin et ses dépendances**

Dans `apps/server/src/lib/auth.ts` :
1. L13 : retirer `admin` de l'import (`import { openAPI, mcp, username } from "better-auth/plugins";`).
2. L23 : supprimer `import { canParentImpersonate } from "./impersonation-policy";`.
3. Supprimer entièrement le bloc `admin({ ... })` (L210-286) du tableau `plugins`.
4. Nettoyer le commentaire d'en-tête (L5-6) qui mentionne `admin: Parent impersonation`.

- [ ] **Step 2: Supprimer le fichier de policy + son test**

```bash
git rm apps/server/src/lib/impersonation-policy.ts
# si présent :
git rm apps/server/src/tests/impersonation-policy.test.ts
```

- [ ] **Step 3: Vérifier qu'aucune référence ne subsiste**

Run: `cd apps/server && grep -rn "impersonat\|canParentImpersonate\|admin(" src/`
Expected: aucune occurrence applicative (hors `username`/commentaires). Corriger toute référence restante.

- [ ] **Step 4: Typecheck + tests serveur complets**

Run: `cd apps/server && bun run typecheck && bun run lint && bun run test`
Expected: PASS. Tout test ciblant `impersonationAllowed`/admin est supprimé ou adapté.

- [ ] **Step 5: Non-régression accès données parent (sans impersonation)**

Run: `cd apps/server && bun run test src/integration-tests/pronote-data.integration.test.ts`
Expected: PASS — un parent lit `/children/:childId/grades` de son enfant (garde `assertParentOrSelf`), un tiers reçoit 403.

- [ ] **Step 6: Commit**

```bash
git add apps/server/src/lib/auth.ts
git commit -m "feat(auth): remove parent->child impersonation (admin plugin)"
```

---

### Task 3: Client — plugin username, suppression du client admin

**Files:**
- Modify: `apps/mobile/src/lib/auth.ts` (imports L16-18 ; `plugins` L57-67 ; ajouter `signInUsername` ; supprimer `useImpersonatedBy` L99-103, `ImpersonatedSession` L41-43, `hasParentSessionBackup` L234-242, `restoreParentSession` L252-259, `launchChildSession` L275-298)

**Interfaces:**
- Produces: `signInUsername(username: string, password: string)` ; `authClient.signIn.username` disponible. Supprime du module : `useImpersonatedBy`, `hasParentSessionBackup`, `restoreParentSession`, `launchChildSession`.

- [ ] **Step 1: Mettre à jour le client Better Auth**

Dans `apps/mobile/src/lib/auth.ts` :
1. L18 : remplacer `import { adminClient } from 'better-auth/client/plugins';` par `import { usernameClient } from 'better-auth/client/plugins';`.
2. L65 : remplacer `adminClient(), // Quick Switch...` par `usernameClient(), // Autonomous child login`.
3. Ajouter l'action après `signIn` (vers L114) :
```ts
/**
 * Connexion enfant avec identifiant (username) + mot de passe.
 */
export async function signInUsername(username: string, password: string) {
  return authClient.signIn.username({ username, password });
}
```
4. Supprimer : l'interface `ImpersonatedSession` (L41-43), `useImpersonatedBy` (L99-103), tout le bloc « QUICK SWITCH » (L222-298 : `hasParentSessionBackup`, `restoreParentSession`, `launchChildSession`) et le commentaire d'en-tête « Quick Switch 2026 » (L7-11).

- [ ] **Step 2: Vérifier qu'aucune référence interne ne casse**

Run: `cd apps/mobile && grep -rn "adminClient\|launchChildSession\|restoreParentSession\|useImpersonatedBy\|hasParentSessionBackup\|impersonat" src/`
Expected: les seules occurrences restantes sont dans les fichiers traités par les Tasks 6-7 (login/profile-select déjà neutralisés ou à venir). Noter la liste pour les tasks suivantes.

- [ ] **Step 3: Typecheck**

Run: `cd apps/mobile && pnpm typecheck`
Expected: erreurs UNIQUEMENT dans les call sites supprimés par Tasks 6-7 (`profile-select.tsx`, `child/[id]/index.tsx`, `ChildSummaryCard.tsx`, `(student)/_layout.tsx`). C'est attendu — ces fichiers sont traités ensuite. Ne pas committer tant que le typecheck n'est pas vert (regrouper avec Tasks 6-7) **ou** committer ce module isolément si les call sites sont déjà retirés.

- [ ] **Step 4: Commit (après Tasks 6-7 si le typecheck dépend d'elles)**

```bash
git add apps/mobile/src/lib/auth.ts
git commit -m "feat(mobile): add username sign-in, drop impersonation client helpers"
```

---

### Task 4: Mobile — router le login Élève vers `signIn.username`

**Files:**
- Modify: `apps/mobile/src/app/(auth)/login.tsx` (import L11 ; `handleLogin` L30-51 ; commentaire d'en-tête L4-5)
- Test: `apps/mobile/__tests__/app/login.test.tsx` (create si absent)

**Interfaces:**
- Consumes: `signIn`, `signInUsername` (Task 3) ; `accountType: 'parent' | 'student'` (existant).

- [ ] **Step 1: Écrire le test qui échoue**

Créer `apps/mobile/__tests__/app/login.test.tsx` :

```tsx
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import LoginScreen from '@/app/(auth)/login';

const signInEmail = jest.fn().mockResolvedValue({ error: null });
const signInUsername = jest.fn().mockResolvedValue({ error: null });

jest.mock('@/lib/auth', () => ({
  signIn: (...a: unknown[]) => signInEmail(...a),
  signInUsername: (...a: unknown[]) => signInUsername(...a),
  signInWithGoogle: jest.fn(),
}));

describe('LoginScreen', () => {
  beforeEach(() => jest.clearAllMocks());

  it('uses username sign-in when the Élève tab is active', async () => {
    const { getByText, getByLabelText } = render(<LoginScreen />);
    fireEvent.press(getByText('Élève'));
    fireEvent.changeText(getByLabelText('Identifiant'), 'kid_abc');
    fireEvent.changeText(getByLabelText('Mot de passe'), 'child-password-123');
    fireEvent.press(getByText('Se connecter'));
    await waitFor(() => expect(signInUsername).toHaveBeenCalledWith('kid_abc', 'child-password-123'));
    expect(signInEmail).not.toHaveBeenCalled();
  });
});
```

(Adapter les libellés exacts — `Élève`, `Identifiant`, `Mot de passe`, `Se connecter` — à ceux rendus par `AccountTypeToggle` / `LoginForm` ; les lire d'abord.)

- [ ] **Step 2: Lancer le test, vérifier l'échec**

Run: `cd apps/mobile && pnpm test login.test`
Expected: FAIL — `handleLogin` appelle toujours `signIn` (email) pour le student.

- [ ] **Step 3: Brancher sur `accountType`**

Dans `apps/mobile/src/app/(auth)/login.tsx` :
1. L11 : `import { signIn, signInUsername, signInWithGoogle } from '@/lib/auth';`
2. Dans `handleLogin`, remplacer l'appel `const result = await signIn(identifier, password);` par :
```ts
      const result =
        accountType === 'student'
          ? await signInUsername(identifier, password)
          : await signIn(identifier, password);
```
3. Mettre à jour le commentaire d'en-tête L4-5 (les enfants se connectent par identifiant, plus via sélection de profil).

- [ ] **Step 4: Lancer le test, vérifier le succès**

Run: `cd apps/mobile && pnpm test login.test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/app/(auth)/login.tsx apps/mobile/__tests__/app/login.test.tsx
git commit -m "feat(mobile): route student login to username sign-in"
```

---

### Task 5: Mobile — supprimer l'ancien onboarding Pronote (consommateur du PIN local)

**Files:**
- Delete: `apps/mobile/src/hooks/usePronoteOnboarding.ts`, `apps/mobile/src/hooks/usePronoteReconnect.ts`, `apps/mobile/src/app/(parent)/onboarding-pronote.tsx`, `apps/mobile/src/app/(parent)/tabs/(profile)/pronote-connect.tsx`, le réexport `apps/mobile/src/app/(parent)/tabs/(home)/pronote-connect.tsx`, et les tests `__tests__/hooks/usePronoteOnboarding.test.ts` / `usePronoteReconnect.test.ts`
- Keep: `src/components/parent/Pronote*`, `src/components/parent/pronote/PronoteStep*`, `src/lib/pronote-helpers.ts`, `src/stores/pronote-store.ts` (réutilisés au sous-projet 2)
- Modify: l'export-barrel `src/hooks/index.ts` (retirer les exports supprimés) ; toute route les référençant.

**Interfaces:**
- Produces: plus aucun consommateur de `useChildAccessStore` via Pronote (prépare Task 8).

- [ ] **Step 1: Supprimer hooks + écrans + tests**

```bash
cd apps/mobile
git rm src/hooks/usePronoteOnboarding.ts src/hooks/usePronoteReconnect.ts \
  src/app/\(parent\)/onboarding-pronote.tsx \
  src/app/\(parent\)/tabs/\(profile\)/pronote-connect.tsx \
  src/app/\(parent\)/tabs/\(home\)/pronote-connect.tsx \
  __tests__/hooks/usePronoteOnboarding.test.ts __tests__/hooks/usePronoteReconnect.test.ts
```
(Adapter les chemins exacts des écrans `pronote-connect` après `grep -rn "usePronoteReconnect\|usePronoteOnboarding" src/`.)

- [ ] **Step 2: Nettoyer les barrels / imports**

Run: `cd apps/mobile && grep -rn "usePronoteOnboarding\|usePronoteReconnect\|onboarding-pronote\|pronote-connect" src/`
Retirer chaque référence trouvée (barrel `src/hooks/index.ts`, navigations `router.push`/`<Link>`). Le bouton/CTA qui menait à `onboarding-pronote` ou `pronote-connect` est retiré (Pronote revient au sous-projet 2).

- [ ] **Step 3: Typecheck + lint + tests**

Run: `cd apps/mobile && pnpm typecheck && pnpm lint && pnpm test`
Expected: PASS (les call sites d'impersonation de la Task 3 peuvent encore casser si Task 3 déjà appliquée — sinon vert ici).

- [ ] **Step 4: Commit**

```bash
git add -u
git commit -m "refactor(mobile): remove legacy Pronote onboarding hooks/screens (server model in sub-project 2)"
```

---

### Task 6: Mobile — supprimer `profile-select` + recâbler l'entrée parent

**Files:**
- Delete: `apps/mobile/src/app/(parent)/profile-select.tsx`
- Modify: `apps/mobile/src/app/(parent)/_layout.tsx` (retirer la `Stack.Screen name="profile-select"`), le point d'entrée du groupe `(parent)` (redirection vers `tabs`)

**Interfaces:**
- Consumes: la suppression de `child-access-store` (Task 8) — `profile-select` est son dernier consommateur d'UI ; le supprimer ici débloque Task 8.

- [ ] **Step 1: Identifier l'entrée parent**

Run: `cd apps/mobile && grep -rn "profile-select" src/` puis lire `src/app/(parent)/_layout.tsx` et `src/app/(parent)/index.tsx` (s'il existe).
Objectif : après login parent, l'app doit ouvrir directement `(parent)/tabs` (dashboard), sans écran intermédiaire de sélection de profil.

- [ ] **Step 2: Supprimer l'écran + sa route**

```bash
cd apps/mobile && git rm src/app/\(parent\)/profile-select.tsx
```
Dans `(parent)/_layout.tsx` : retirer l'enregistrement `profile-select`. Si `(parent)/index.tsx` faisait `redirect` vers `profile-select`, le rediriger vers `/(parent)/tabs` (ou retirer l'index si `tabs` est déjà l'entrée par défaut du groupe).

- [ ] **Step 3: Vérifier le routing à 0 et à N enfants**

Run: `cd apps/mobile && grep -rn "profile-select" src/`
Expected: aucune occurrence.
Le cas « 0 enfant » est traité en Task 8 (empty-state add-child). Ici, vérifier juste que le parent atterrit sur `tabs`.

- [ ] **Step 4: Typecheck + lint**

Run: `cd apps/mobile && pnpm typecheck && pnpm lint`
Expected: PASS (hors call sites impersonation Task 7 si non encore traités).

- [ ] **Step 5: Commit**

```bash
git add -u
git commit -m "feat(mobile): remove profile-select, parent enters dashboard directly"
```

---

### Task 7: Mobile — retirer les CTA « Lancer Tom » et la bannière « Return to Parent »

**Files:**
- Modify: `apps/mobile/src/app/(parent)/tabs/(home)/child/[id]/index.tsx` (appel `launchChildSession` ~L98 + son CTA), `apps/mobile/src/components/parent/ChildSummaryCard.tsx` (~L122), `apps/mobile/src/app/(student)/_layout.tsx` (bannière + `restoreParentSession` + `useImpersonatedBy` ~L42-66)

**Interfaces:**
- Consumes: l'absence des helpers d'impersonation (Task 3).

- [ ] **Step 1: Retirer le CTA « Lancer Tom pour [enfant] »**

Dans `child/[id]/index.tsx` et `ChildSummaryCard.tsx` : supprimer l'appel à `launchChildSession`, le bouton/Pressable associé, et tout state lié (`isLaunching`, etc.). Le parent consulte les données enfant via les écrans existants (grades/homework/timetable) — pas d'entrée dans l'espace enfant.

- [ ] **Step 2: Retirer la bannière « Return to Parent »**

Dans `(student)/_layout.tsx` : supprimer le bloc qui lit `useImpersonatedBy()`/`hasParentSessionBackup` et affiche le bouton « Return to Parent » appelant `restoreParentSession`. L'espace enfant n'a plus de notion de session parente.

- [ ] **Step 3: Vérifier l'absence totale de références impersonation**

Run: `cd apps/mobile && grep -rn "launchChildSession\|restoreParentSession\|useImpersonatedBy\|hasParentSessionBackup\|impersonat" src/`
Expected: **aucune occurrence**.

- [ ] **Step 4: Typecheck + lint + tests (le module auth Task 3 doit être vert maintenant)**

Run: `cd apps/mobile && pnpm typecheck && pnpm lint && pnpm test`
Expected: PASS.

- [ ] **Step 5: Commit (inclure le module de la Task 3 si pas encore committé)**

```bash
git add -u
git commit -m "feat(mobile): drop parent->child quick-switch UI (no impersonation)"
```

---

### Task 8: Mobile — supprimer `child-access-store` (plus aucun consommateur)

**Files:**
- Delete: `apps/mobile/src/stores/child-access-store.ts`, `apps/mobile/__tests__/stores/child-access-store.test.ts`
- Modify: barrel `src/stores/index.ts` si présent

**Interfaces:**
- Consumes: Tasks 5-7 ont retiré tous les call sites (`setCredential`, `setParentCredential`, `verifyCredential`, `verifyParentCredential`, `hasCredential`).

- [ ] **Step 1: Confirmer zéro consommateur**

Run: `cd apps/mobile && grep -rn "child-access-store\|useChildAccessStore\|setParentCredential\|verifyParentCredential" src/ __tests__/`
Expected: seulement le fichier du store + son test.

- [ ] **Step 2: Supprimer le store + test**

```bash
cd apps/mobile && git rm src/stores/child-access-store.ts __tests__/stores/child-access-store.test.ts
```
Retirer l'export du barrel `src/stores/index.ts` si présent.

- [ ] **Step 3: Typecheck + lint + tests**

Run: `cd apps/mobile && pnpm typecheck && pnpm lint && pnpm test`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add -u
git commit -m "refactor(mobile): remove child-access-store (local PIN obsolete)"
```

---

### Task 9: Mobile — écran « Ajouter un enfant » manuel + empty-state parent

**Files:**
- Create: `apps/mobile/src/app/(parent)/add-child.tsx` (ou `(parent)/tabs/(home)/add-child.tsx` selon le routing du groupe)
- Modify: l'entrée parent à 0 enfant (cf. Task 6) pour pointer vers cet écran ; barrel routes si besoin
- Test: `apps/mobile/__tests__/app/add-child.test.tsx` (create)

**Interfaces:**
- Consumes: `useParentDashboard().createChild(data: ICreateChildData)` (`src/hooks/useParentDashboard.ts:170`) → `POST /api/parent/children`. Champs requis (alignés sur `apps/server/src/schemas/validation` `createChildSchema` — **les lire avant de figer le formulaire**) : `firstName`, `lastName`, `username` (min 3), `password` (min 8), `schoolLevel` (`EDUCATION_LEVEL_UNION`), `dateOfBirth` (requis par le Zod `createChildSchema`).

- [ ] **Step 1: Lire le contrat exact**

Lire `apps/server/src/schemas/validation` (`createChildSchema`) et `apps/mobile/src/hooks/useParentDashboard.ts` (`ICreateChildData`) pour aligner précisément les champs/validations du formulaire (notamment `dateOfBirth` requis, format username, longueur mot de passe).

- [ ] **Step 2: Écrire le test qui échoue**

Créer `apps/mobile/__tests__/app/add-child.test.tsx` :

```tsx
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import AddChildScreen from '@/app/(parent)/add-child';

const createChild = jest.fn().mockResolvedValue({ id: 'child-1' });
jest.mock('@/hooks', () => ({
  useParentDashboard: () => ({ createChild, children: [] }),
}));
jest.mock('expo-router', () => ({ useRouter: () => ({ back: jest.fn(), replace: jest.fn() }) }));

describe('AddChildScreen', () => {
  it('submits a child via createChild', async () => {
    const { getByLabelText, getByText } = render(<AddChildScreen />);
    fireEvent.changeText(getByLabelText('Prénom'), 'Kid');
    fireEvent.changeText(getByLabelText('Nom'), 'Test');
    fireEvent.changeText(getByLabelText('Identifiant'), 'kid_abc');
    fireEvent.changeText(getByLabelText('Mot de passe'), 'child-password-123');
    // niveau + date de naissance : adapter aux composants réels (picker)
    fireEvent.press(getByText('Créer le compte'));
    await waitFor(() =>
      expect(createChild).toHaveBeenCalledWith(
        expect.objectContaining({ firstName: 'Kid', username: 'kid_abc' }),
      ),
    );
  });
});
```

- [ ] **Step 3: Lancer le test, vérifier l'échec**

Run: `cd apps/mobile && pnpm test add-child.test`
Expected: FAIL — l'écran n'existe pas.

- [ ] **Step 4: Implémenter l'écran**

Créer `apps/mobile/src/app/(parent)/add-child.tsx` : formulaire (primitives `@/components/ui/`, NativeWind, tokens) avec champs prénom, nom, identifiant, mot de passe (indicateur de robustesse, min 8), niveau (picker `EDUCATION_LEVEL`), date de naissance. États complets (idle/submitting/erreur « identifiant déjà pris » renvoyée par l'API/error). a11y : `accessibilityLabel` sur chaque champ, cibles ≥44pt, rôles. Sur succès → `router.back()` (ou retour dashboard). Réutiliser un éventuel composant de saisie existant (`PronoteStepChildPin` ou form parent) plutôt que dupliquer.

- [ ] **Step 5: Brancher l'empty-state**

À l'endroit défini en Task 6 (parent à 0 enfant), afficher un état vide avec CTA « Ajouter un enfant » → `router.push('/(parent)/add-child')`. Enregistrer la route dans `(parent)/_layout.tsx` si nécessaire.

- [ ] **Step 6: Lancer le test + validation complète**

Run: `cd apps/mobile && pnpm test add-child.test && pnpm typecheck && pnpm lint && pnpm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/app/\(parent\)/add-child.tsx apps/mobile/__tests__/app/add-child.test.tsx
git add -u
git commit -m "feat(mobile): manual add-child screen + empty-state (Pronote-independent)"
```

---

### Task 10: Validation finale + nettoyage doc

**Files:**
- Modify: `apps/mobile/CLAUDE.md` (section Pronote/onboarding si elle décrit l'ancien modèle de profile-switch — facultatif), commentaires d'en-tête résiduels.

- [ ] **Step 1: Validation monorepo complète**

Run:
```bash
cd apps/server && bun run typecheck && bun run lint && bun run test && bun run test:integration
cd ../mobile && pnpm typecheck && pnpm lint && pnpm test
```
Expected: tout PASS (intégration serveur : tests env-gated `pronote-real-account`/`rag` skippent sans creds — normal).

- [ ] **Step 2: Grep final anti-résidu**

Run:
```bash
grep -rn "impersonat\|profile-select\|child-access-store\|usePronoteOnboarding\|usePronoteReconnect" apps/mobile/src apps/server/src
```
Expected: aucune occurrence (hors specs/plans `docs/`).

- [ ] **Step 3: Commit éventuel des ajustements doc**

```bash
git add -u
git commit -m "docs(mobile): align CLAUDE.md with autonomous child login model"
```

---

## Self-Review

**Spec coverage :**
- Plugin `username` serveur+client → Tasks 1, 3. ✅
- Endpoint reset mot de passe enfant → **hors scope sous-projet 1** (sous-projet 2), conforme au spec. ✅
- Suppression admin/impersonation serveur → Task 2. ✅
- Login toggle Parent/Élève → existant + branchement username Task 4. ✅
- Suppressions mobile (profile-select, child-access-store, helpers, bannière, CTA) → Tasks 5-8. ✅
- Empty-state add-child manuel → Task 9. ✅
- Data parent inchangée (assertParentOrSelf) → vérifié Task 2 Step 5 (non-régression). ✅
- Pas de migration (pré-prod) → aucun task de migration. ✅

**Placeholder scan :** les « adapter les libellés/chemins exacts » renvoient à une lecture préalable obligatoire (pas un TODO de code) ; le contrat add-child (Task 9 Step 1) impose de lire `createChildSchema` avant de figer le formulaire — volontaire, le schéma Zod est la source de vérité.

**Type consistency :** `signInUsername(username, password)` défini Task 3, consommé Task 4 ✅ ; `createChild(ICreateChildData)` consommé Task 9 (signature lue Step 1) ✅ ; `assertParentOrSelf` non modifié, seulement vérifié ✅.

**Ordre/dépendances :** Tasks 5-7 retirent tous les consommateurs avant la suppression de `child-access-store` (Task 8) et du module auth impersonation (Task 3 committé avec Task 7). Le typecheck mobile n'est garanti vert qu'à partir de la fin de Task 7 — noté explicitement dans Tasks 3/5/6.
