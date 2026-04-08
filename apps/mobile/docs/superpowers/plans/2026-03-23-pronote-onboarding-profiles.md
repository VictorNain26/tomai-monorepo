# Pronote Onboarding + Profile Selection — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace manual child creation with Pronote-based import + Netflix-like profile selection with PIN access.

**Architecture:** Parent-only auth → Pronote QR onboarding → child import with PIN setup → profile select screen. Pronote data 100% device-only. Child sessions via Better Auth impersonation (existing `launchChildSession`). Routing restructured: `(parent)/_layout.tsx` becomes a Stack wrapping a `tabs/` group for the MaterialTopTabs.

**Tech Stack:** Expo SDK 55, React Native 0.83, pawnote 1.6, expo-crypto, Zustand+MMKV, Better Auth admin plugin

**Spec:** `docs/superpowers/specs/2026-03-23-pronote-onboarding-profiles-design.md`

---

## Task 0: Add expo-crypto dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install expo-crypto**

```bash
cd apps/mobile && pnpm add expo-crypto
```

- [ ] **Step 2: Verify install**

```bash
pnpm typecheck
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/package.json pnpm-lock.yaml
git commit -m "chore(mobile): add expo-crypto for PIN hashing"
```

---

## Task 1: Remove Pronote server sync (device-only)

**Files:**
- Delete: `src/services/pronote/pronote-credentials.ts`
- Modify: `src/hooks/usePronote.ts` (lines 26, 97, 113)

- [ ] **Step 1: Delete pronote-credentials.ts**

```bash
rm src/services/pronote/pronote-credentials.ts
```

- [ ] **Step 2: Remove imports and calls in usePronote.ts**

Remove line 26:
```typescript
// DELETE: import { pronoteCredentialsSync } from '@/services/pronote/pronote-credentials';
```

In `connect()` function (~line 97), remove the server sync call:
```typescript
// DELETE: await pronoteCredentialsSync.pushToServer({...});
```

In `disconnect()` function (~line 113), remove:
```typescript
// DELETE: await pronoteCredentialsSync.removeFromServer();
```

- [ ] **Step 3: Verify**

```bash
pnpm typecheck && pnpm lint
```

- [ ] **Step 4: Commit**

```bash
git add src/services/pronote/pronote-credentials.ts src/hooks/usePronote.ts
git commit -m "refactor(mobile): remove Pronote server sync (device-only for legal)"
```

---

## Task 2: Create child-access-store (PIN storage)

**Files:**
- Create: `src/stores/child-access-store.ts`
- Test: `__tests__/stores/child-access-store.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/stores/child-access-store.test.ts
import { useChildAccessStore } from '@/stores/child-access-store';

// Reset store between tests
beforeEach(() => {
  useChildAccessStore.getState().reset();
});

describe('child-access-store', () => {
  it('should set and verify a child PIN', async () => {
    const store = useChildAccessStore.getState();
    await store.setCredential('child-1', 'pin', '1234');

    const valid = await store.verifyCredential('child-1', '1234');
    expect(valid).toBe(true);

    const invalid = await store.verifyCredential('child-1', '0000');
    expect(invalid).toBe(false);
  });

  it('should set and verify a child password', async () => {
    const store = useChildAccessStore.getState();
    await store.setCredential('child-1', 'password', 'mypassword');

    const valid = await store.verifyCredential('child-1', 'mypassword');
    expect(valid).toBe(true);
  });

  it('should set and verify parent credential', async () => {
    const store = useChildAccessStore.getState();
    await store.setParentCredential('9876');

    const valid = await store.verifyParentCredential('9876');
    expect(valid).toBe(true);
  });

  it('should remove a credential', async () => {
    const store = useChildAccessStore.getState();
    await store.setCredential('child-1', 'pin', '1234');
    store.removeCredential('child-1');

    const valid = await store.verifyCredential('child-1', '1234');
    expect(valid).toBe(false);
  });

  it('should reset a credential with new value', async () => {
    const store = useChildAccessStore.getState();
    await store.setCredential('child-1', 'pin', '1234');
    await store.resetCredential('child-1', 'pin', '5678');

    const oldInvalid = await store.verifyCredential('child-1', '1234');
    expect(oldInvalid).toBe(false);

    const newValid = await store.verifyCredential('child-1', '5678');
    expect(newValid).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test -- __tests__/stores/child-access-store.test.ts
```
Expected: FAIL — module not found

- [ ] **Step 3: Implement child-access-store.ts**

```typescript
// src/stores/child-access-store.ts
/**
 * Child Access Store
 *
 * Device-only PIN/password storage for profile selection.
 * Uses expo-crypto for hashing. Never synced to server.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import * as Crypto from 'expo-crypto';
import { MMKV } from 'react-native-mmkv';

const mmkv = new MMKV({ id: 'child-access' });

const mmkvStorage = {
  getItem: (key: string) => mmkv.getString(key) ?? null,
  setItem: (key: string, value: string) => mmkv.set(key, value),
  removeItem: (key: string) => mmkv.delete(key),
};

// ============================================================================
// TYPES
// ============================================================================

interface ChildAccessCredential {
  childId: string;
  type: 'pin' | 'password';
  hash: string;
  salt: string;
}

interface ParentAccessCredential {
  type: 'pin';
  hash: string;
  salt: string;
}

interface ChildAccessState {
  credentials: ChildAccessCredential[];
  parentCredential: ParentAccessCredential | null;
  setCredential: (childId: string, type: 'pin' | 'password', value: string) => Promise<void>;
  setParentCredential: (value: string) => Promise<void>;
  verifyCredential: (childId: string, value: string) => Promise<boolean>;
  verifyParentCredential: (value: string) => Promise<boolean>;
  removeCredential: (childId: string) => void;
  resetCredential: (childId: string, type: 'pin' | 'password', value: string) => Promise<void>;
  hasCredential: (childId: string) => boolean;
  reset: () => void;
}

// ============================================================================
// HELPERS
// ============================================================================

async function generateSalt(): Promise<string> {
  const bytes = await Crypto.getRandomBytesAsync(16);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function hashValue(value: string, salt: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    salt + value,
  );
}

// ============================================================================
// STORE
// ============================================================================

export const useChildAccessStore = create<ChildAccessState>()(
  persist(
    (set, get) => ({
      credentials: [],
      parentCredential: null,

      setCredential: async (childId, type, value) => {
        const salt = await generateSalt();
        const hash = await hashValue(value, salt);
        const filtered = get().credentials.filter((c) => c.childId !== childId);
        set({ credentials: [...filtered, { childId, type, hash, salt }] });
      },

      setParentCredential: async (value) => {
        const salt = await generateSalt();
        const hash = await hashValue(value, salt);
        set({ parentCredential: { type: 'pin', hash, salt } });
      },

      verifyCredential: async (childId, value) => {
        const cred = get().credentials.find((c) => c.childId === childId);
        if (!cred) return false;
        const hash = await hashValue(value, cred.salt);
        return hash === cred.hash;
      },

      verifyParentCredential: async (value) => {
        const cred = get().parentCredential;
        if (!cred) return false;
        const hash = await hashValue(value, cred.salt);
        return hash === cred.hash;
      },

      removeCredential: (childId) => {
        set({ credentials: get().credentials.filter((c) => c.childId !== childId) });
      },

      resetCredential: async (childId, type, value) => {
        const salt = await generateSalt();
        const hash = await hashValue(value, salt);
        const filtered = get().credentials.filter((c) => c.childId !== childId);
        set({ credentials: [...filtered, { childId, type, hash, salt }] });
      },

      hasCredential: (childId) => {
        return get().credentials.some((c) => c.childId === childId);
      },

      reset: () => set({ credentials: [], parentCredential: null }),
    }),
    {
      name: 'child-access-store',
      storage: createJSONStorage(() => mmkvStorage),
    },
  ),
);
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test -- __tests__/stores/child-access-store.test.ts
```
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/stores/child-access-store.ts __tests__/stores/child-access-store.test.ts
git commit -m "feat(mobile): add child-access-store for PIN/password hashing"
```

---

## Task 3: Create school level inference utility

**Files:**
- Create: `src/lib/infer-school-level.ts`
- Test: `__tests__/lib/infer-school-level.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// __tests__/lib/infer-school-level.test.ts
import { inferSchoolLevel } from '@/lib/infer-school-level';

describe('inferSchoolLevel', () => {
  it.each([
    ['CP A', 'cp'],
    ['CE1 B', 'ce1'],
    ['CE2', 'ce2'],
    ['CM1 A', 'cm1'],
    ['CM2 B', 'cm2'],
    ['6ème A', 'sixieme'],
    ['6eme B', 'sixieme'],
    ['5ème 3', 'cinquieme'],
    ['4ème C', 'quatrieme'],
    ['3ème A', 'troisieme'],
    ['2nde 5', 'seconde'],
    ['2de A', 'seconde'],
    ['1ère S', 'premiere'],
    ['1ere ES', 'premiere'],
    ['Terminale S', 'terminale'],
    ['Term STI2D', 'terminale'],
  ])('should infer "%s" as "%s"', (className, expected) => {
    expect(inferSchoolLevel(className)).toBe(expected);
  });

  it('should return null for unrecognized class names', () => {
    expect(inferSchoolLevel('Division 3A')).toBeNull();
    expect(inferSchoolLevel('Groupe Alpha')).toBeNull();
    expect(inferSchoolLevel('')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test -- __tests__/lib/infer-school-level.test.ts
```

- [ ] **Step 3: Implement infer-school-level.ts**

```typescript
// src/lib/infer-school-level.ts
import type { EducationLevelType } from '@/constants/levels';

const LEVEL_PATTERNS: [RegExp, EducationLevelType][] = [
  [/\bCP\b/i, 'cp'],
  [/\bCE1\b/i, 'ce1'],
  [/\bCE2\b/i, 'ce2'],
  [/\bCM1\b/i, 'cm1'],
  [/\bCM2\b/i, 'cm2'],
  [/\b6[eè]me?\b/i, 'sixieme'],
  [/\b5[eè]me?\b/i, 'cinquieme'],
  [/\b4[eè]me?\b/i, 'quatrieme'],
  [/\b3[eè]me?\b/i, 'troisieme'],
  [/\b2n?de?\b/i, 'seconde'],
  [/\b1[eè]re?\b/i, 'premiere'],
  [/\bT(er)?m?(inale)?\b/i, 'terminale'],
];

/**
 * Infer school level from a Pronote className string.
 * Returns null if no pattern matches — caller should show a level picker.
 */
export function inferSchoolLevel(className: string): EducationLevelType | null {
  for (const [pattern, level] of LEVEL_PATTERNS) {
    if (pattern.test(className)) return level;
  }
  return null;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test -- __tests__/lib/infer-school-level.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/infer-school-level.ts __tests__/lib/infer-school-level.test.ts
git commit -m "feat(mobile): add school level inference from Pronote className"
```

---

## Task 4: Restructure (parent) routing — Stack wrapping tabs

**Files:**
- Modify: `src/app/(parent)/_layout.tsx` → becomes Stack navigator
- Create: `src/app/(parent)/tabs/_layout.tsx` → MaterialTopTabs (moved)
- Move: `src/app/(parent)/(home)/` → `src/app/(parent)/tabs/(home)/`
- Move: `src/app/(parent)/(profile)/` → `src/app/(parent)/tabs/(profile)/`

- [ ] **Step 1: Create tabs/_layout.tsx with the existing MaterialTopTabs code**

```typescript
// src/app/(parent)/tabs/_layout.tsx
/**
 * Parent Tabs - TomAI 2026
 *
 * Swipeable tab navigation (Material Top Tabs at bottom position).
 * Parent can swipe between Accueil and Profil like Instagram.
 */

import { withLayoutContext } from 'expo-router';
import { Home, User } from 'lucide-react-native';
import type { ParamListBase, TabNavigationState } from '@react-navigation/native';
import {
  createMaterialTopTabNavigator,
  type MaterialTopTabNavigationOptions,
  type MaterialTopTabNavigationEventMap,
} from '@react-navigation/material-top-tabs';
import { useSwipeableTabConfig } from '@/lib/navigation';

const { Navigator } = createMaterialTopTabNavigator();

const MaterialTopTabs = withLayoutContext<
  MaterialTopTabNavigationOptions,
  typeof Navigator,
  TabNavigationState<ParamListBase>,
  MaterialTopTabNavigationEventMap
>(Navigator);

export default function ParentTabsLayout() {
  const swipeableOptions = useSwipeableTabConfig();

  return (
    <MaterialTopTabs
      tabBarPosition="bottom"
      screenOptions={swipeableOptions}
    >
      <MaterialTopTabs.Screen
        name="(home)"
        options={{
          title: 'Accueil',
          tabBarIcon: ({ color }) => <Home color={color} size={22} />,
        }}
      />
      <MaterialTopTabs.Screen
        name="(profile)"
        options={{
          title: 'Profil',
          tabBarIcon: ({ color }) => <User color={color} size={22} />,
        }}
      />
    </MaterialTopTabs>
  );
}
```

- [ ] **Step 2: Move (home) and (profile) directories into tabs/**

```bash
# Move route groups into tabs/
mv "src/app/(parent)/(home)" "src/app/(parent)/tabs/(home)"
mv "src/app/(parent)/(profile)" "src/app/(parent)/tabs/(profile)"
```

- [ ] **Step 3: Rewrite (parent)/_layout.tsx as Stack**

```typescript
// src/app/(parent)/_layout.tsx
/**
 * Parent Layout - TomAI 2026
 *
 * Stack navigator wrapping:
 * - profile-select: Netflix-like profile grid (initial)
 * - onboarding-pronote: forced Pronote setup (0 children)
 * - tabs: MaterialTopTabs (home + profile)
 */

import { Stack } from 'expo-router';
import { useStackScreenOptions } from '@/lib/navigation';

export default function ParentLayout() {
  const screenOptions = useStackScreenOptions();

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="profile-select" />
      <Stack.Screen name="onboarding-pronote" />
      <Stack.Screen name="tabs" />
    </Stack>
  );
}
```

- [ ] **Step 4: Create placeholder profile-select.tsx**

```typescript
// src/app/(parent)/profile-select.tsx
/**
 * Profile Selection Screen - TomAI 2026
 *
 * Netflix-like profile grid. Redirects to onboarding if 0 children.
 * TODO: Implement full UI in Task 7.
 */

import { View } from 'react-native';
import { Redirect } from 'expo-router';
import { Text } from '@/components/ui/text';
import { useParentDashboard } from '@/hooks';
import { SafeAreaView } from '@/components/ui/safe-area-view';

export default function ProfileSelectScreen() {
  const { children, isLoading } = useParentDashboard();

  if (isLoading) return null;

  if (children.length === 0) {
    return <Redirect href="/(parent)/onboarding-pronote" />;
  }

  // TODO: Replace with full ProfileCard grid + PinPrompt
  return (
    <SafeAreaView className="flex-1 bg-stone-50 dark:bg-stone-900 items-center justify-center">
      <Text variant="h2">Qui utilise Tom ?</Text>
      <Text variant="muted" className="mt-2">{children.length} profil(s) — UI en cours</Text>
    </SafeAreaView>
  );
}
```

- [ ] **Step 5: Create placeholder onboarding-pronote.tsx**

```typescript
// src/app/(parent)/onboarding-pronote.tsx
/**
 * Pronote Onboarding Screen - TomAI 2026
 *
 * Shown on first login when parent has 0 children.
 * TODO: Implement full QR + import flow in Task 6.
 */

import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { SafeAreaView } from '@/components/ui/safe-area-view';

export default function OnboardingPronoteScreen() {
  return (
    <SafeAreaView className="flex-1 bg-stone-50 dark:bg-stone-900 items-center justify-center px-6">
      <Text variant="h2" className="text-center">Bienvenue !</Text>
      <Text variant="muted" className="mt-2 text-center">
        Pour commencer, connectons Pronote
      </Text>
      <Text variant="muted" className="mt-4 text-center text-xs">
        TomAI n'est pas affilié à Index Education. Vos données Pronote restent sur votre appareil.
      </Text>
    </SafeAreaView>
  );
}
```

- [ ] **Step 6: Update route references in moved files**

Check all `router.push()` calls in `tabs/(home)/` and `tabs/(profile)/` files. Paths like `/(parent)/(home)/child/xxx` become `/(parent)/tabs/(home)/child/xxx`. Update imports if path aliases changed.

```bash
grep -r "/(parent)/(home)" src/app/(parent)/tabs/ --include="*.tsx" -l
grep -r "/(parent)/(profile)" src/app/(parent)/tabs/ --include="*.tsx" -l
```

Update any hardcoded paths found.

- [ ] **Step 7: Verify**

```bash
pnpm typecheck && pnpm lint
```

- [ ] **Step 8: Commit**

```bash
git add src/app/\(parent\)/
git commit -m "refactor(mobile): restructure (parent) routing — Stack wrapping MaterialTopTabs"
```

---

## Task 5: Create UI components (ProfileCard, PinPrompt)

**Files:**
- Create: `src/components/parent/ProfileCard.tsx`
- Create: `src/components/parent/PinPrompt.tsx`

- [ ] **Step 1: Create ProfileCard.tsx**

```typescript
// src/components/parent/ProfileCard.tsx
/**
 * Profile Card - Netflix-like profile avatar for profile selection.
 */

import { TouchableOpacity, View } from 'react-native';
import { Text } from '@/components/ui/text';
import { bgColors } from '@/lib/styles';
import { useThemeColors } from '@/hooks';

interface ProfileCardProps {
  name: string;
  subtitle?: string;
  variant?: 'child' | 'parent';
  onPress: () => void;
}

export function ProfileCard({ name, subtitle, variant = 'child', onPress }: ProfileCardProps) {
  const colors = useThemeColors();
  const initial = name.charAt(0).toUpperCase();
  const isParent = variant === 'parent';

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      className="items-center gap-2"
      accessibilityLabel={`Profil ${name}`}
      accessibilityRole="button"
    >
      <View
        className={`h-20 w-20 items-center justify-center rounded-2xl ${
          isParent ? 'border-2 border-primary' : ''
        }`}
        style={{ backgroundColor: isParent ? bgColors.primary[10] : bgColors.muted[10] }}
      >
        <Text
          className="text-3xl font-bold"
          style={{ color: isParent ? colors.primary : colors.foreground }}
        >
          {initial}
        </Text>
      </View>
      <Text className="font-medium">{name}</Text>
      {subtitle && <Text variant="tiny">{subtitle}</Text>}
    </TouchableOpacity>
  );
}
```

- [ ] **Step 2: Create PinPrompt.tsx**

```typescript
// src/components/parent/PinPrompt.tsx
/**
 * PIN Prompt - Modal for profile access authentication.
 */

import { useState, useRef } from 'react';
import { View, TextInput, Animated } from 'react-native';
import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { bgColors } from '@/lib/styles';

interface PinPromptProps {
  name: string;
  type: 'pin' | 'password';
  onSubmit: (value: string) => Promise<boolean>;
  onCancel: () => void;
}

const MAX_ATTEMPTS = 5;
const LOCK_DURATION_MS = 30_000;

export function PinPrompt({ name, type, onSubmit, onCancel }: PinPromptProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [locked, setLocked] = useState(false);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  function shake() {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  }

  async function handleSubmit() {
    if (locked || !value) return;

    const valid = await onSubmit(value);
    if (valid) return; // parent handles navigation

    setError(true);
    setValue('');
    shake();

    const newAttempts = attempts + 1;
    setAttempts(newAttempts);

    if (newAttempts >= MAX_ATTEMPTS) {
      setLocked(true);
      setTimeout(() => {
        setLocked(false);
        setAttempts(0);
      }, LOCK_DURATION_MS);
    }
  }

  return (
    <View className="flex-1 items-center justify-center bg-stone-50 dark:bg-stone-900 px-8">
      <Text variant="h3" className="mb-6">
        {type === 'pin' ? `Code de ${name}` : `Mot de passe de ${name}`}
      </Text>

      <Animated.View style={{ transform: [{ translateX: shakeAnim }] }} className="w-full max-w-xs">
        <TextInput
          value={value}
          onChangeText={(text) => { setValue(text); setError(false); }}
          secureTextEntry
          keyboardType={type === 'pin' ? 'numeric' : 'default'}
          maxLength={type === 'pin' ? 6 : 50}
          autoFocus
          editable={!locked}
          onSubmitEditing={handleSubmit}
          className="rounded-xl border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 px-4 py-4 text-center text-2xl tracking-widest text-foreground"
          placeholderTextColor="#9CA3AF"
          placeholder={type === 'pin' ? '• • • •' : '••••••••'}
        />
      </Animated.View>

      {error && (
        <Text className="mt-3 text-red-500 text-sm">
          Code incorrect{attempts >= 3 ? ` (${MAX_ATTEMPTS - attempts} essai(s) restant(s))` : ''}
        </Text>
      )}

      {locked && (
        <View className="mt-3 rounded-lg px-4 py-2" style={{ backgroundColor: bgColors.destructive[10] }}>
          <Text className="text-red-500 text-sm text-center">
            Trop de tentatives. Réessayez dans 30 secondes.
          </Text>
        </View>
      )}

      <View className="mt-8 flex-row gap-4">
        <Button variant="outline" onPress={onCancel}>
          <Text>Annuler</Text>
        </Button>
        <Button onPress={handleSubmit} disabled={!value || locked}>
          <Text className="text-white dark:text-stone-900">Valider</Text>
        </Button>
      </View>
    </View>
  );
}
```

- [ ] **Step 3: Verify**

```bash
pnpm typecheck && pnpm lint
```

- [ ] **Step 4: Commit**

```bash
git add src/components/parent/ProfileCard.tsx src/components/parent/PinPrompt.tsx
git commit -m "feat(mobile): add ProfileCard and PinPrompt components"
```

---

## Task 6: Create PronoteChildImport + ChildPinSetup components

**Files:**
- Create: `src/components/parent/PronoteChildImport.tsx`
- Create: `src/components/parent/ChildPinSetup.tsx`

- [ ] **Step 1: Create PronoteChildImport.tsx**

Multi-select children from Pronote resources. Filters out already-imported children.

```typescript
// src/components/parent/PronoteChildImport.tsx
/**
 * Pronote Child Import - Multi-select children from Pronote resources.
 */

import { useState } from 'react';
import { View, TouchableOpacity } from 'react-native';
import { Check, School } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useThemeColors } from '@/hooks';
import { bgColors } from '@/lib/styles';
import type { PronoteResource } from '@/services/pronote/pronote-types';

interface PronoteChildImportProps {
  resources: PronoteResource[];
  existingChildNames: string[];
  onImport: (selectedResources: PronoteResource[]) => void;
  isSubmitting: boolean;
}

export function PronoteChildImport({
  resources,
  existingChildNames,
  onImport,
  isSubmitting,
}: PronoteChildImportProps) {
  const colors = useThemeColors();
  const availableResources = resources.filter(
    (r) => !existingChildNames.some((name) => name.toLowerCase() === r.name.toLowerCase()),
  );
  const [selected, setSelected] = useState<Set<number>>(
    new Set(availableResources.map((_, i) => i)),
  );

  function toggleResource(index: number) {
    const next = new Set(selected);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    setSelected(next);
  }

  function toggleAll() {
    if (selected.size === availableResources.length) setSelected(new Set());
    else setSelected(new Set(availableResources.map((_, i) => i)));
  }

  function handleContinue() {
    const selectedResources = availableResources.filter((_, i) => selected.has(i));
    onImport(selectedResources);
  }

  return (
    <View className="flex-1 px-6 py-8">
      <Text variant="h2" className="mb-2">Sélectionnez les enfants</Text>
      <Text variant="muted" className="mb-6">à ajouter dans TomAI</Text>

      {availableResources.length > 1 && (
        <TouchableOpacity onPress={toggleAll} className="mb-4 flex-row items-center gap-2">
          <View
            className="h-5 w-5 items-center justify-center rounded border"
            style={{
              backgroundColor: selected.size === availableResources.length ? colors.primary : 'transparent',
              borderColor: colors.primary,
            }}
          >
            {selected.size === availableResources.length && <Check color="#fff" size={14} />}
          </View>
          <Text variant="small">Tout sélectionner</Text>
        </TouchableOpacity>
      )}

      <View className="gap-3">
        {availableResources.map((resource, index) => {
          const isSelected = selected.has(index);
          return (
            <TouchableOpacity key={resource.id} onPress={() => toggleResource(index)}>
              <Card
                className="flex-row items-center gap-4 p-4"
                style={isSelected ? { borderColor: colors.primary, borderWidth: 2 } : undefined}
              >
                <View
                  className="h-5 w-5 items-center justify-center rounded border"
                  style={{
                    backgroundColor: isSelected ? colors.primary : 'transparent',
                    borderColor: colors.primary,
                  }}
                >
                  {isSelected && <Check color="#fff" size={14} />}
                </View>
                <View className="flex-1">
                  <Text className="font-semibold">{resource.name}</Text>
                  {resource.className && (
                    <View className="mt-1 flex-row items-center gap-1">
                      <School color={colors.muted} size={14} />
                      <Text variant="muted">{resource.className}</Text>
                    </View>
                  )}
                </View>
              </Card>
            </TouchableOpacity>
          );
        })}
      </View>

      {existingChildNames.length > 0 && (
        <Text variant="tiny" className="mt-4 text-center">
          {existingChildNames.length} enfant(s) déjà importé(s)
        </Text>
      )}

      <Button
        onPress={handleContinue}
        disabled={selected.size === 0 || isSubmitting}
        isLoading={isSubmitting}
        className="mt-8"
      >
        <Text className="font-medium text-white dark:text-stone-900">
          Continuer ({selected.size})
        </Text>
      </Button>
    </View>
  );
}
```

- [ ] **Step 2: Create ChildPinSetup.tsx**

Sequential PIN/password setup for each imported child. Includes level picker fallback.

```typescript
// src/components/parent/ChildPinSetup.tsx
/**
 * Child PIN Setup - Set PIN or password for each imported child.
 */

import { useState } from 'react';
import { View, TextInput } from 'react-native';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { useThemeColors } from '@/hooks';
import { bgColors } from '@/lib/styles';
import { inferSchoolLevel } from '@/lib/infer-school-level';
import { LEVEL_LABELS, type EducationLevelType } from '@/constants/levels';
import type { PronoteResource } from '@/services/pronote/pronote-types';

interface ChildPinSetupProps {
  resource: PronoteResource;
  index: number;
  total: number;
  onComplete: (data: {
    resource: PronoteResource;
    schoolLevel: EducationLevelType;
    pinType: 'pin' | 'password';
    pinValue: string;
  }) => void;
}

export function ChildPinSetup({ resource, index, total, onComplete }: ChildPinSetupProps) {
  const colors = useThemeColors();
  const inferred = resource.className ? inferSchoolLevel(resource.className) : null;

  const [schoolLevel, setSchoolLevel] = useState<EducationLevelType | null>(inferred);
  const [pinType, setPinType] = useState<'pin' | 'password'>('pin');
  const [pinValue, setPinValue] = useState('');
  const [confirmValue, setConfirmValue] = useState('');

  const isValid = pinValue.length >= (pinType === 'pin' ? 4 : 6)
    && pinValue === confirmValue
    && schoolLevel !== null;

  function handleSubmit() {
    if (!isValid || !schoolLevel) return;
    onComplete({ resource, schoolLevel, pinType, pinValue });
  }

  const levels = Object.entries(LEVEL_LABELS) as [EducationLevelType, string][];

  return (
    <View className="flex-1 px-6 py-8">
      <Text variant="muted" className="mb-2">{index + 1} / {total}</Text>
      <Text variant="h2" className="mb-1">{resource.name}</Text>
      {resource.className && (
        <Text variant="muted" className="mb-6">{resource.className}</Text>
      )}

      {/* School level */}
      {!inferred && (
        <View className="mb-6">
          <Text className="mb-2 font-medium">Niveau scolaire</Text>
          <View className="flex-row flex-wrap gap-2">
            {levels.map(([key, label]) => (
              <Button
                key={key}
                variant={schoolLevel === key ? 'default' : 'outline'}
                size="sm"
                onPress={() => setSchoolLevel(key)}
              >
                <Text
                  className={schoolLevel === key ? 'text-white dark:text-stone-900' : ''}
                  variant="small"
                >
                  {label}
                </Text>
              </Button>
            ))}
          </View>
        </View>
      )}

      {/* PIN type toggle */}
      <View className="mb-4 flex-row gap-3">
        <Button
          variant={pinType === 'pin' ? 'default' : 'outline'}
          onPress={() => { setPinType('pin'); setPinValue(''); setConfirmValue(''); }}
          className="flex-1"
        >
          <Text className={pinType === 'pin' ? 'text-white dark:text-stone-900' : ''}>
            Code PIN
          </Text>
        </Button>
        <Button
          variant={pinType === 'password' ? 'default' : 'outline'}
          onPress={() => { setPinType('password'); setPinValue(''); setConfirmValue(''); }}
          className="flex-1"
        >
          <Text className={pinType === 'password' ? 'text-white dark:text-stone-900' : ''}>
            Mot de passe
          </Text>
        </Button>
      </View>

      {/* PIN input */}
      <View className="gap-3">
        <TextInput
          value={pinValue}
          onChangeText={setPinValue}
          secureTextEntry
          keyboardType={pinType === 'pin' ? 'numeric' : 'default'}
          maxLength={pinType === 'pin' ? 6 : 50}
          placeholder={pinType === 'pin' ? 'Code (4-6 chiffres)' : 'Mot de passe (6+ caractères)'}
          placeholderTextColor="#9CA3AF"
          className="rounded-xl border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 px-4 py-3 text-foreground"
        />
        <TextInput
          value={confirmValue}
          onChangeText={setConfirmValue}
          secureTextEntry
          keyboardType={pinType === 'pin' ? 'numeric' : 'default'}
          maxLength={pinType === 'pin' ? 6 : 50}
          placeholder="Confirmer"
          placeholderTextColor="#9CA3AF"
          className="rounded-xl border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 px-4 py-3 text-foreground"
        />
      </View>

      {pinValue && confirmValue && pinValue !== confirmValue && (
        <Text className="mt-2 text-red-500 text-sm">Les codes ne correspondent pas</Text>
      )}

      <Button onPress={handleSubmit} disabled={!isValid} className="mt-8">
        <Text className="font-medium text-white dark:text-stone-900">
          {index === total - 1 ? 'Terminer' : 'Suivant'}
        </Text>
      </Button>
    </View>
  );
}
```

- [ ] **Step 3: Verify**

```bash
pnpm typecheck && pnpm lint
```

- [ ] **Step 4: Commit**

```bash
git add src/components/parent/PronoteChildImport.tsx src/components/parent/ChildPinSetup.tsx
git commit -m "feat(mobile): add PronoteChildImport and ChildPinSetup components"
```

---

## Task 7: Implement profile-select screen (full)

**Files:**
- Modify: `src/app/(parent)/profile-select.tsx` (replace placeholder)

- [ ] **Step 1: Implement full profile selection screen**

Replace the placeholder with the full Netflix-like profile grid. Uses `ProfileCard`, `PinPrompt`, `launchChildSession()`, and `useChildAccessStore`.

Key logic:
- Show grid of children + parent profile
- On child tap → show PinPrompt → verify hash → `launchChildSession(childId)` → `refetchSession()` → Stack.Protected flips to (student)
- On parent tap → show PinPrompt → verify parent hash → `router.push('/(parent)/tabs')`
- If no parent PIN set yet → set one first (first visit after onboarding)

Refer to spec sections "Profile Selection" and "PIN Prompt" for UX details.

- [ ] **Step 2: Verify**

```bash
pnpm typecheck && pnpm lint
```

- [ ] **Step 3: Manual test on device**

- Login as parent
- Verify profile grid shows
- Tap child → PIN prompt → student dashboard
- Tap parent → PIN prompt → parent dashboard

- [ ] **Step 4: Commit**

```bash
git add src/app/\(parent\)/profile-select.tsx
git commit -m "feat(mobile): implement profile selection screen with PIN access"
```

---

## Task 8: Implement onboarding-pronote screen (full)

**Files:**
- Modify: `src/app/(parent)/onboarding-pronote.tsx` (replace placeholder)

- [ ] **Step 1: Implement full onboarding flow**

Multi-step screen:
1. Welcome + instructions + disclaimer
2. QR scanner (reuse `PronoteQrScanner`)
3. PIN entry (reuse `PronotePinEntry`)
4. Child import (`PronoteChildImport`)
5. PIN setup per child (`ChildPinSetup`, sequential)
6. Parent PIN setup
7. Redirect to profile-select

Uses `usePronote()` for QR connection and `useParentDashboard()` for child creation API.

Refer to spec sections "Onboarding Pronote", "Child Import", "Child PIN Setup" for UX details.

- [ ] **Step 2: Verify**

```bash
pnpm typecheck && pnpm lint
```

- [ ] **Step 3: Manual test on device**

- Create new parent account
- Verify forced onboarding (no skip)
- Scan QR → select children → set PINs
- Verify children created in TomAI
- Verify redirect to profile-select

- [ ] **Step 4: Commit**

```bash
git add src/app/\(parent\)/onboarding-pronote.tsx
git commit -m "feat(mobile): implement Pronote onboarding flow with child import"
```

---

## Task 9: Update pronote-connect for "add more children" flow

**Files:**
- Modify: `src/app/(parent)/tabs/(home)/pronote-connect.tsx`
- Delete: `src/components/parent/PronoteChildSelectorModal.tsx`

- [ ] **Step 1: Replace PronoteChildSelectorModal with PronoteChildImport**

In `pronote-connect.tsx`, after successful QR+PIN, show `PronoteChildImport` instead of the old `PronoteChildSelectorModal`. Filter out already-imported children by comparing `resources` names with existing children from `useParentDashboard()`.

After import, run `ChildPinSetup` for each new child, then navigate back.

- [ ] **Step 2: Delete PronoteChildSelectorModal.tsx**

```bash
rm src/components/parent/PronoteChildSelectorModal.tsx
```

- [ ] **Step 3: Verify**

```bash
pnpm typecheck && pnpm lint
```

- [ ] **Step 4: Commit**

```bash
git add src/app/\(parent\)/tabs/\(home\)/pronote-connect.tsx src/components/parent/PronoteChildSelectorModal.tsx
git commit -m "refactor(mobile): replace child selector with import flow in pronote-connect"
```

---

## Task 10: Final validation + push

- [ ] **Step 1: Full validation**

```bash
cd apps/mobile
pnpm typecheck && pnpm lint && pnpm test
```

- [ ] **Step 2: Manual E2E test**

1. Fresh parent signup → onboarding Pronote → import children → PINs
2. Relaunch app → profile select → child PIN → student dashboard
3. Return to parent → parent PIN → parent dashboard
4. Add more children from parent dashboard → pronote-connect

- [ ] **Step 3: Commit + push**

```bash
git add .
git commit -m "test(mobile): validate Pronote onboarding + profile selection"
git push origin staging
```
