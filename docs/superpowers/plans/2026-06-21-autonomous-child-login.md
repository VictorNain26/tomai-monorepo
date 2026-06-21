# Login enfant autonome — suppression impersonation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Donner à chaque enfant un login autonome (identifiant + mot de passe via le plugin `username` de Better Auth) et supprimer toute la machinerie d'impersonation parent→enfant.

**Architecture:** Backend Better Auth : activer le plugin `username`, retirer le plugin `admin`. Mobile : router le chemin « Élève » du login (toggle déjà existant) vers `signIn.username`, ajouter un écran d'ajout d'enfant manuel (endpoint générique déjà existant), puis retirer l'ancien onboarding Pronote local, l'impersonation, `profile-select` et `child-access-store`. Le dashboard parent lit déjà les données enfant en session parent (`assertParentOrSelf`) — rien à changer côté data.

**Tech Stack:** Better Auth 1.6 (`username`/`admin` plugins), Elysia, Drizzle, Bun test ; Expo/RN, NativeWind v5, Eden Treaty, jest-expo.

**Spec:** `docs/superpowers/specs/2026-06-21-autonomous-child-login-design.md`

## Global Constraints

- **Pas de prod / pas d'utilisateurs réels** → aucune migration de données, retraits francs.
- **Vert à chaque commit** : le hook lefthook **pre-commit lance `typecheck`** et `typedRoutes: true` est actif → chaque commit doit passer le typecheck (pas de route/helper supprimé avant ses référents). L'ordre des tâches respecte cette contrainte (additifs d'abord, retraits feuilles→racines).
- **Doc-first** plugin username : [better-auth.com/docs/plugins/username](https://www.better-auth.com/docs/plugins/username) — requiert `username` (string, unique, optional) + `displayUsername` (string, optional) sur la table user (déjà présents : `auth.schema.ts:34-35`).
- **Server** : TypeBox sur chaque route, logique métier en service (jamais en route), validation `cd apps/server && bun run typecheck && bun run lint && bun run test` **+ `bun run test:integration`** avant push. Piège mock `api-endpoints.test.ts` si un nouveau module tire les schémas Drizzle (cf. `.claude/rules/testing-and-commits.md`).
- **Mobile** : TypeScript strict zéro `any` ; NativeWind only (pas de `StyleSheet`) ; primitives `@/components/ui/` ; a11y WCAG AA (labels, rôles, cibles ≥44pt, contrast 4.5:1) ; tokens `@repo/tokens` ; 400 lignes max/fichier. Validation `cd apps/mobile && pnpm typecheck && pnpm lint && pnpm test`.
- **Frontière de types serveur** (`apps/server/CLAUDE.md`) : `username()` est un plugin nameable (comme `expo()`), il reste dans le tableau `plugins` sans cast `BetterAuthPlugin[]` (réservé aux dev-only openAPI/mcp).
- **Commits** : conventional, staging explicite (jamais `git add .`), scopes `auth`/`mobile`/`server`. Branche : `feat/autonomous-child-login`.

---

### Task 1: Backend — activer le plugin `username`

**Files:**
- Modify: `apps/server/src/lib/auth.ts` (import L13 ; `additionalFields` L189-196 ; `plugins` ~L200-208)
- Test: `apps/server/src/tests/username-login.test.ts` (create)

**Interfaces:**
- Produces: route `POST /api/auth/sign-in/username` (`auth.api.signInUsername`) ; un compte créé par `parentService.createChild` est connectable par username + password.

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
1. L13 : ajouter `username` à l'import — `import { openAPI, mcp, admin, username } from "better-auth/plugins";`
2. Retirer les champs `username` et `displayUsername` de `user.additionalFields` (L189-196) — le plugin les déclare nativement. Laisser les autres additionalFields intacts.
3. Ajouter `username()` au tableau `plugins`, juste après `expo(),` :
```ts
    expo(),     // Mobile app support (deep links, secure storage)
    username(), // Autonomous child login: sign in with username + password
```

- [ ] **Step 4: Lancer le test, vérifier le succès**

Run: `cd apps/server && bun run db:push && bun run test src/tests/username-login.test.ts`
Expected: PASS (db:push no-op — colonnes déjà présentes).

- [ ] **Step 5: Non-régression auth + types**

Run: `cd apps/server && bun run typecheck && bun run test src/tests/auth-config.test.ts`
Expected: PASS. Si `auth-config.test.ts` assert la liste des additionalFields, adapter l'assertion (username/displayUsername désormais portés par le plugin).

- [ ] **Step 6: Suite complète + commit**

Run: `cd apps/server && bun run test`
Expected: PASS (runner isolé — cf. leçon ledger A4 : un module tirant les schémas Drizzle peut casser des mocks partiels).
```bash
git add apps/server/src/lib/auth.ts apps/server/src/tests/username-login.test.ts
git commit -m "feat(auth): enable better-auth username plugin for autonomous child login"
```

---

### Task 2: Backend — supprimer l'impersonation admin

**Files:**
- Modify: `apps/server/src/lib/auth.ts` (imports L13 + L23 ; bloc `admin({...})` ~L210-286 ; commentaire d'en-tête L5-6)
- Delete: `apps/server/src/lib/impersonation-policy.ts` + son test s'il existe (`src/tests/impersonation-policy.test.ts`)

**Interfaces:**
- Produces: plus de routes `/api/auth/admin/*` ; le rôle par défaut `parent` reste assuré par `additionalFields.role.defaultValue` (L171).

- [ ] **Step 1: Retirer le plugin admin et ses dépendances**

Dans `apps/server/src/lib/auth.ts` :
1. L13 : retirer `admin` de l'import → `import { openAPI, mcp, username } from "better-auth/plugins";`
2. L23 : supprimer `import { canParentImpersonate } from "./impersonation-policy";`
3. Supprimer entièrement le bloc `admin({ ... })` du tableau `plugins`.
4. Nettoyer le commentaire d'en-tête (L5-6) mentionnant `admin: Parent impersonation`.

- [ ] **Step 2: Supprimer la policy + son test**

```bash
cd apps/server
git rm src/lib/impersonation-policy.ts
git rm src/tests/impersonation-policy.test.ts 2>/dev/null || true
```

- [ ] **Step 3: Vérifier l'absence de référence**

Run: `cd apps/server && grep -rn "impersonat\|canParentImpersonate" src/`
Expected: aucune occurrence applicative. Corriger toute référence restante (tests inclus).

- [ ] **Step 4: Typecheck + lint + suite + non-régression accès parent**

Run: `cd apps/server && bun run typecheck && bun run lint && bun run test && bun run test src/integration-tests/pronote-data.integration.test.ts`
Expected: PASS — un parent lit `/children/:childId/grades` de son enfant (garde `assertParentOrSelf`), un tiers reçoit 403. Tout test ciblant `impersonationAllowed`/admin est supprimé ou adapté.

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/lib/auth.ts
git commit -m "feat(auth): remove parent->child impersonation (admin plugin)"
```

---

### Task 3: Mobile — câbler le login Élève sur `signIn.username` (additif)

**Files:**
- Modify: `apps/mobile/src/lib/auth.ts` (import plugins L18 ; tableau `plugins` L59-67 ; ajouter `signInUsername` ~L114)
- Modify: `apps/mobile/src/app/(auth)/login.tsx` (import L11 ; `handleLogin` L30-51 ; commentaire L4-5)
- Test: `apps/mobile/__tests__/app/login.test.tsx` (create)

**Interfaces:**
- Produces: `signInUsername(username: string, password: string)` ; `authClient.signIn.username` disponible.
- Note: **additif** — `adminClient()` et les helpers d'impersonation restent en place (retirés en Task 6). Garde le tree vert.

- [ ] **Step 1: Ajouter le client username + l'action**

Dans `apps/mobile/src/lib/auth.ts` :
1. L18 : ajouter `usernameClient` à l'import existant → `import { adminClient, usernameClient } from 'better-auth/client/plugins';`
2. Dans le tableau `plugins` (après `adminClient(),`) : ajouter `usernameClient(),`
3. Ajouter après la fonction `signIn` (~L114) :
```ts
/**
 * Connexion enfant avec identifiant (username) + mot de passe.
 */
export async function signInUsername(username: string, password: string) {
  return authClient.signIn.username({ username, password });
}
```

- [ ] **Step 2: Écrire le test du login qui échoue**

D'abord lire `apps/mobile/src/components/auth/AccountTypeToggle.tsx` et `LoginForm.tsx` pour les libellés exacts (onglet « Élève », label du champ identifiant, bouton submit). Puis créer `apps/mobile/__tests__/app/login.test.tsx` :

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
    fireEvent.press(getByText('Élève'));                       // adapter au libellé réel
    fireEvent.changeText(getByLabelText('Identifiant'), 'kid_abc'); // adapter
    fireEvent.changeText(getByLabelText('Mot de passe'), 'child-password-123');
    fireEvent.press(getByText('Se connecter'));                // adapter
    await waitFor(() =>
      expect(signInUsername).toHaveBeenCalledWith('kid_abc', 'child-password-123'),
    );
    expect(signInEmail).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Lancer le test, vérifier l'échec**

Run: `cd apps/mobile && pnpm test login.test`
Expected: FAIL — `handleLogin` appelle `signIn` (email) pour le student.

- [ ] **Step 4: Brancher sur `accountType`**

Dans `apps/mobile/src/app/(auth)/login.tsx` :
1. L11 : `import { signIn, signInUsername, signInWithGoogle } from '@/lib/auth';`
2. Dans `handleLogin`, remplacer `const result = await signIn(identifier, password);` par :
```ts
      const result =
        accountType === 'student'
          ? await signInUsername(identifier, password)
          : await signIn(identifier, password);
```
3. Mettre à jour le commentaire d'en-tête L4-5 (enfants se connectent par identifiant, plus via sélection de profil).

- [ ] **Step 5: Lancer le test, vérifier le succès**

Run: `cd apps/mobile && pnpm test login.test`
Expected: PASS.

- [ ] **Step 6: Validation + commit**

Run: `cd apps/mobile && pnpm typecheck && pnpm lint && pnpm test`
Expected: PASS.
```bash
git add apps/mobile/src/lib/auth.ts apps/mobile/src/app/\(auth\)/login.tsx apps/mobile/__tests__/app/login.test.tsx
git commit -m "feat(mobile): route student login to username sign-in"
```

---

### Task 4: Mobile — écran « Ajouter un enfant » manuel (additif)

**Files:**
- Create: `apps/mobile/src/app/(parent)/add-child.tsx`
- Modify: `apps/mobile/src/app/(parent)/_layout.tsx` (enregistrer la route si nécessaire)
- Test: `apps/mobile/__tests__/app/add-child.test.tsx` (create)

**Interfaces:**
- Consumes: `useParentDashboard().createChild(data: ICreateChildData)` (`src/hooks/useParentDashboard.ts:170`) → `POST /api/parent/children`.
- Note: **additif** — écran créé + route enregistrée, pas encore branché comme empty-state (Task 5). Reachable pour test.

- [ ] **Step 1: Lire le contrat exact**

Lire `apps/server/src/schemas/validation` (`createChildSchema`) et `apps/mobile/src/hooks/useParentDashboard.ts` (`ICreateChildData`) pour aligner les champs/validations : `firstName`, `lastName`, `username` (min 3), `password` (min 8), `schoolLevel`, `dateOfBirth` (requis par le Zod `createChildSchema`).

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
    // niveau + date de naissance : adapter aux composants réels (picker/date)
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

Créer `apps/mobile/src/app/(parent)/add-child.tsx` : formulaire (primitives `@/components/ui/`, NativeWind, tokens `@repo/tokens`) — prénom, nom, identifiant, mot de passe (indicateur de robustesse, min 8), niveau (picker via `EDUCATION_LEVEL`/`@/constants/levels`), date de naissance. États complets (idle/submitting/erreur API « identifiant déjà pris »). a11y : `accessibilityLabel` par champ, cibles ≥44pt, rôles. Sur succès → `router.back()`. Réutiliser les inputs existants (`@/components/ui/`) plutôt que dupliquer. ≤400 lignes (extraire un sous-composant si besoin). Enregistrer la route dans `(parent)/_layout.tsx` si le routing du groupe l'exige.

- [ ] **Step 5: Lancer le test + validation**

Run: `cd apps/mobile && pnpm test add-child.test && pnpm typecheck && pnpm lint && pnpm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/app/\(parent\)/add-child.tsx apps/mobile/__tests__/app/add-child.test.tsx
git add -u
git commit -m "feat(mobile): manual add-child screen (Pronote-independent)"
```

---

### Task 5: Mobile — retirer l'ancien onboarding Pronote, brancher l'empty-state sur add-child

**Files:**
- Delete: `apps/mobile/src/hooks/usePronoteOnboarding.ts`, `apps/mobile/src/hooks/usePronoteReconnect.ts`, `apps/mobile/src/app/(parent)/onboarding-pronote.tsx`, les écrans `pronote-connect` (sous `(parent)/tabs/(profile)/` et le réexport `(parent)/tabs/(home)/`), et les tests `__tests__/hooks/usePronoteOnboarding.test.ts` / `usePronoteReconnect.test.ts`
- Keep: `src/components/parent/Pronote*`, `src/components/parent/pronote/PronoteStep*`, `src/lib/pronote-helpers.ts`, `src/stores/pronote-store.ts`
- Modify: barrel `src/hooks/index.ts` ; le point de routing « 0 enfant » (aujourd'hui → `onboarding-pronote`) → vers `add-child`

**Interfaces:**
- Consumes: l'écran `add-child` (Task 4). Le 0-children empty-state pointe désormais vers lui.
- Produces: plus de consommateur Pronote de `child-access-store` (prépare Task 6).

- [ ] **Step 1: Cartographier les référents**

Run: `cd apps/mobile && grep -rn "usePronoteOnboarding\|usePronoteReconnect\|onboarding-pronote\|pronote-connect" src/`
Noter : qui navigue vers `onboarding-pronote` (le 0-children empty-state) et `pronote-connect` (CTA reconnect), et le barrel `src/hooks/index.ts`.

- [ ] **Step 2: Supprimer hooks + écrans + tests**

```bash
cd apps/mobile
git rm src/hooks/usePronoteOnboarding.ts src/hooks/usePronoteReconnect.ts \
  __tests__/hooks/usePronoteOnboarding.test.ts __tests__/hooks/usePronoteReconnect.test.ts
git rm src/app/\(parent\)/onboarding-pronote.tsx
# chemins pronote-connect confirmés à l'étape 1 :
git rm src/app/\(parent\)/tabs/\(profile\)/pronote-connect.tsx
git rm src/app/\(parent\)/tabs/\(home\)/pronote-connect.tsx
```

- [ ] **Step 3: Repointer l'empty-state + nettoyer les imports**

Retirer du barrel `src/hooks/index.ts` les exports supprimés. Repointer la navigation « 0 enfant » (route typée) de `/(parent)/onboarding-pronote` vers `/(parent)/add-child`. Retirer le CTA qui menait à `pronote-connect` (Pronote revient au sous-projet 2). Vérifier : `grep -rn "onboarding-pronote\|pronote-connect\|usePronoteOnboarding\|usePronoteReconnect" src/` → aucune occurrence.

- [ ] **Step 4: Validation + commit**

Run: `cd apps/mobile && pnpm typecheck && pnpm lint && pnpm test`
Expected: PASS.
```bash
git add -u
git commit -m "refactor(mobile): drop legacy Pronote onboarding, empty-state -> add-child"
```

---

### Task 6: Mobile — supprimer impersonation, profile-select et child-access-store

**Files:**
- Modify: `apps/mobile/src/lib/auth.ts` (retirer `adminClient` + `ImpersonatedSession` + `useImpersonatedBy` + `hasParentSessionBackup` + `restoreParentSession` + `launchChildSession` + commentaire « Quick Switch »)
- Modify: `apps/mobile/src/app/(parent)/tabs/(home)/child/[id]/index.tsx` (CTA `launchChildSession` ~L98), `apps/mobile/src/components/parent/ChildSummaryCard.tsx` (~L122), `apps/mobile/src/app/(student)/_layout.tsx` (bannière Return-to-Parent ~L42-66)
- Modify: `apps/mobile/src/app/(parent)/_layout.tsx` (retirer la route `profile-select`, recâbler l'entrée parent → `tabs`)
- Delete: `apps/mobile/src/app/(parent)/profile-select.tsx`, `apps/mobile/src/stores/child-access-store.ts`, `apps/mobile/__tests__/stores/child-access-store.test.ts`

**Interfaces:**
- Consumes: Tasks 3-5 ont retiré tous les autres consommateurs. `profile-select` et les call sites CTA/bannière sont les derniers référents de l'impersonation et du store.

- [ ] **Step 1: Retirer les call sites CTA + bannière**

Dans `child/[id]/index.tsx` et `ChildSummaryCard.tsx` : supprimer l'appel `launchChildSession`, le bouton/Pressable « Lancer Tom pour [enfant] » et tout state associé (`isLaunching`…). Dans `(student)/_layout.tsx` : supprimer le bloc lisant `useImpersonatedBy()`/`hasParentSessionBackup` et le bouton « Return to Parent » appelant `restoreParentSession`.

- [ ] **Step 2: Supprimer profile-select + recâbler l'entrée parent**

```bash
cd apps/mobile && git rm src/app/\(parent\)/profile-select.tsx
```
Dans `(parent)/_layout.tsx` : retirer l'enregistrement `profile-select`. Recâbler l'entrée du groupe `(parent)` pour qu'un parent connecté atterrisse directement sur `(parent)/tabs` (si `(parent)/index.tsx` redirigeait vers `profile-select`, le rediriger vers `/(parent)/tabs` ou supprimer l'index si `tabs` est l'entrée par défaut).

- [ ] **Step 3: Retirer les helpers d'impersonation + le client admin**

Dans `apps/mobile/src/lib/auth.ts` : supprimer l'interface `ImpersonatedSession`, `useImpersonatedBy`, le bloc « QUICK SWITCH » (`hasParentSessionBackup`, `restoreParentSession`, `launchChildSession`), le commentaire d'en-tête « Quick Switch 2026 », et retirer `adminClient` de l'import + du tableau `plugins` (laisser `usernameClient`).

- [ ] **Step 4: Supprimer child-access-store (plus aucun consommateur)**

Run: `cd apps/mobile && grep -rn "child-access-store\|useChildAccessStore\|launchChildSession\|restoreParentSession\|useImpersonatedBy\|hasParentSessionBackup\|adminClient\|profile-select\|impersonat" src/ __tests__/`
Expected: seulement le fichier du store + son test.
```bash
git rm src/stores/child-access-store.ts __tests__/stores/child-access-store.test.ts
```
Retirer l'export du barrel `src/stores/index.ts` si présent.

- [ ] **Step 5: Validation + commit**

Run: `cd apps/mobile && pnpm typecheck && pnpm lint && pnpm test`
Expected: PASS — `grep` final (Step 4) ne renvoie plus aucune occurrence.
```bash
git add -u
git commit -m "feat(mobile): remove impersonation, profile-select and local PIN store"
```

---

### Task 7: Validation finale + nettoyage doc

**Files:**
- Modify (facultatif): `apps/mobile/CLAUDE.md` (section décrivant l'ancien profile-switch), commentaires d'en-tête résiduels.

- [ ] **Step 1: Validation monorepo complète**

Run:
```bash
cd apps/server && bun run typecheck && bun run lint && bun run test && bun run test:integration
cd ../mobile && pnpm typecheck && pnpm lint && pnpm test
```
Expected: tout PASS (intégration serveur : `pronote-real-account`/`rag` skippent sans creds — normal).

- [ ] **Step 2: Grep final anti-résidu**

Run:
```bash
grep -rn "impersonat\|profile-select\|child-access-store\|usePronoteOnboarding\|usePronoteReconnect" apps/mobile/src apps/server/src
```
Expected: aucune occurrence (hors `docs/`).

- [ ] **Step 3: Commit éventuel des ajustements doc**

```bash
git add -u
git commit -m "docs(mobile): align CLAUDE.md with autonomous child login model"
```

---

## Self-Review

**Spec coverage :**
- Plugin `username` serveur → Task 1 ; client → Task 3. ✅
- Endpoint reset mot de passe enfant → **hors scope** (sous-projet 2), conforme au spec. ✅
- Suppression admin/impersonation serveur → Task 2 ; mobile → Task 6. ✅
- Login toggle Parent/Élève → existant + branchement username Task 3. ✅
- Add-child manuel → Task 4 ; empty-state branché Task 5. ✅
- Suppressions mobile (onboarding legacy, profile-select, child-access-store, helpers, bannière, CTA) → Tasks 5-6. ✅
- Data parent inchangée (assertParentOrSelf) → non-régression Task 2 Step 4. ✅
- Pas de migration (pré-prod) → aucun task de migration. ✅

**Vert à chaque commit (typedRoutes + hook pre-commit typecheck) :** additifs d'abord (T1 username serveur, T3 username login, T4 add-child), puis retraits feuilles→racines (T5 onboarding+repoint empty-state→add-child ; T6 impersonation+profile-select+store une fois leurs référents partis). Chaque task se termine par un typecheck vert avant commit. ✅

**Placeholder scan :** les « adapter les libellés/chemins exacts » renvoient à une lecture préalable obligatoire (Task 3 Step 2, Task 4 Step 1, Task 5 Step 1) — pas des TODO de code ; le contrat add-child impose de lire `createChildSchema` (source de vérité). ✅

**Type consistency :** `signInUsername(username, password)` défini Task 3, consommé login Task 3 ✅ ; `createChild(ICreateChildData)` consommé Task 4 (signature lue Step 1) ✅ ; `assertParentOrSelf` seulement vérifié, non modifié ✅ ; `adminClient` ajouté nulle part en T3 (déjà présent), retiré T6 — pas de double-retrait ✅.
