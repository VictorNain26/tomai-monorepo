# Auth Pages Refonte — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refonte visuelle des écrans auth mobile — épurer, unifier, rendre premium

**Architecture:** Extraction d'un composant AuthScreen partagé, suppression des Card wrappers, segmented control NativeWind, password strength indicator progressif, Google icon SVG

**Tech Stack:** React Native, NativeWind v5, Expo Router, lucide-react-native, react-native-svg

---

## Chunk 1: Foundation

### Task 1: Create AuthScreen shared component

**Files:**
- Create: `apps/mobile/src/components/auth/auth-screen.tsx`

- [ ] **Step 1: Create the AuthScreen component**

```tsx
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

interface AuthScreenProps {
  children: ReactNode;
}

export function AuthScreen({ children }: AuthScreenProps) {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-stone-50 dark:bg-stone-900"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-1 justify-center px-6 py-12">
          {children}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd apps/mobile && pnpm typecheck`

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/auth/auth-screen.tsx
git commit -m "feat(mobile): add AuthScreen shared layout component"
```

---

### Task 2: Create Google icon SVG component

**Files:**
- Create: `apps/mobile/src/components/icons/google-icon.tsx`

- [ ] **Step 1: Create the GoogleIcon component**

```tsx
import Svg, { Path } from 'react-native-svg';

interface GoogleIconProps {
  size?: number;
}

export function GoogleIcon({ size = 20 }: GoogleIconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
        fill="#4285F4"
      />
      <Path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <Path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <Path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </Svg>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd apps/mobile && pnpm typecheck`

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/icons/google-icon.tsx
git commit -m "feat(mobile): add Google icon SVG component"
```

---

## Chunk 2: Main screens refonte

### Task 3: Refonte login.tsx

**Files:**
- Modify: `apps/mobile/src/app/(auth)/login.tsx`

Changes to apply:
1. Replace `KeyboardAvoidingView > ScrollView > View` wrapper with `<AuthScreen>`
2. Remove `Card` import and wrapper around form
3. Remove `CARD_COLORS` constant
4. Remove `shadows` import (no longer needed)
5. Replace segmented control styling:
   - Container: `className="mb-6 flex-row rounded-xl bg-stone-200/50 dark:bg-stone-800/50 p-1"`
   - Active segment: `className="flex-1 rounded-lg bg-white dark:bg-stone-700 py-3"`
   - Inactive segment: `className="flex-1 rounded-lg py-3"`
   - Active text: `className="text-center font-semibold text-stone-800 dark:text-stone-100"`
   - Inactive text: `className="text-center text-stone-500 dark:text-stone-400"`
6. Remove `style` props from segmented control (no more shadows/CARD_COLORS)
7. Replace all `TouchableOpacity` with `Pressable` (forgot-password link, register link)
8. Remove `TouchableOpacity` import
9. Simplify Button children: `<Button onPress={handleLogin}>Se connecter</Button>` (string child)
10. Add GoogleIcon to Google button: `<Button variant="outline"><GoogleIcon size={20} /><Text>Continuer avec Google</Text></Button>` — keep Text wrapper here since Button has mixed children (icon + text)
11. Remove `useTheme` import and `isDark` (no longer needed — segmented control uses NativeWind)
12. Remove `Card` import

**Imports after refonte:**
```tsx
import { useState, useEffect } from 'react';
import { View, Pressable } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { signIn, signInWithUsername, signInWithGoogle, useSession } from '@/lib/auth';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { TomAvatar } from '@/components/common';
import { GoogleIcon } from '@/components/icons/google-icon';
import { AuthScreen } from '@/components/auth/auth-screen';
import { useThemeColors } from '@/hooks';
import { bgColors } from '@/lib/styles';
```

- [ ] **Step 1: Apply all changes to login.tsx**
- [ ] **Step 2: Verify typecheck**: `cd apps/mobile && pnpm typecheck`
- [ ] **Step 3: Verify lint**: `cd apps/mobile && pnpm lint`
- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/app/(auth)/login.tsx
git commit -m "refactor(mobile): refonte login — remove Card, NativeWind segmented control, Google icon"
```

---

### Task 4: Refonte register.tsx

**Files:**
- Modify: `apps/mobile/src/app/(auth)/register.tsx`

Changes to apply:
1. Replace `KeyboardAvoidingView > ScrollView > View` wrapper with `<AuthScreen>`
2. Remove `Card` import and wrapper around form
3. Remove `shadows` import
4. Replace `TouchableOpacity` with `Pressable`
5. Remove `TouchableOpacity` import
6. Simplify Button children to string where possible
7. Add GoogleIcon to Google button
8. Add password strength indicator after password input:

```tsx
{/* Password strength indicator */}
{password.length > 0 && (
  <View className="gap-1.5">
    <PasswordCriterion met={password.length >= 8} label="8 caractères minimum" />
    <PasswordCriterion met={/[A-Z]/.test(password)} label="Une majuscule" />
    <PasswordCriterion met={/[a-z]/.test(password)} label="Une minuscule" />
    <PasswordCriterion met={/[0-9]/.test(password)} label="Un chiffre" />
  </View>
)}
```

Where `PasswordCriterion` is defined locally in the same file:

```tsx
import { Check, Circle } from 'lucide-react-native';

function PasswordCriterion({ met, label }: { met: boolean; label: string }) {
  return (
    <View className="flex-row items-center gap-2">
      {met ? (
        <Check size={14} color="#059669" />
      ) : (
        <Circle size={14} color="#A8A29E" />
      )}
      <Text
        variant="tiny"
        className={met ? 'text-emerald-600 dark:text-emerald-400' : 'text-stone-400'}
      >
        {label}
      </Text>
    </View>
  );
}
```

**Imports after refonte:**
```tsx
import { useState, useEffect } from 'react';
import { View, Pressable } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Check, Circle } from 'lucide-react-native';
import { signUp, signInWithGoogle, useSession } from '@/lib/auth';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { TomAvatar } from '@/components/common';
import { GoogleIcon } from '@/components/icons/google-icon';
import { AuthScreen } from '@/components/auth/auth-screen';
import { bgColors } from '@/lib/styles';
```

- [ ] **Step 1: Apply all changes to register.tsx**
- [ ] **Step 2: Verify typecheck**: `cd apps/mobile && pnpm typecheck`
- [ ] **Step 3: Verify lint**: `cd apps/mobile && pnpm lint`
- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/app/(auth)/register.tsx
git commit -m "refactor(mobile): refonte register — remove Card, add password strength indicator"
```

---

### Task 5: Refonte forgot-password.tsx

**Files:**
- Modify: `apps/mobile/src/app/(auth)/forgot-password.tsx`

Changes to apply:
1. Replace `KeyboardAvoidingView > ScrollView > View` wrapper (form state only) with `<AuthScreen>`
2. Replace `TouchableOpacity` with `Pressable` (back button, login link)
3. Remove `TouchableOpacity` import
4. Simplify Button children to string where possible
5. Success state stays as-is (no AuthScreen — different layout without keyboard)

**Imports after refonte:**
```tsx
import { useState } from 'react';
import { View, Pressable } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Mail, CheckCircle, ArrowLeft } from 'lucide-react-native';
import { requestPasswordReset } from '@/lib/auth';
import { getBaseUrl } from '@repo/api';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { AuthScreen } from '@/components/auth/auth-screen';
import { useIconColors, useThemeColors } from '@/hooks';
import { bgColors } from '@/lib/styles';
```

- [ ] **Step 1: Apply all changes to forgot-password.tsx**
- [ ] **Step 2: Verify typecheck**: `cd apps/mobile && pnpm typecheck`
- [ ] **Step 3: Verify lint**: `cd apps/mobile && pnpm lint`
- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/app/(auth)/forgot-password.tsx
git commit -m "refactor(mobile): refonte forgot-password — use AuthScreen, Pressable"
```

---

### Task 6: Refonte reset-password.tsx

**Files:**
- Modify: `apps/mobile/src/app/(auth)/reset-password.tsx`

Changes to apply:
1. Replace `KeyboardAvoidingView > ScrollView > View` wrapper (form state only) with `<AuthScreen>`
2. Replace `TouchableOpacity` with `Pressable` (back button, login link)
3. Remove `TouchableOpacity` import
4. Simplify Button children to string where possible
5. Success and invalid-token states stay as-is (different layouts)

**Imports after refonte:**
```tsx
import { useState, useEffect } from 'react';
import { View, Pressable } from 'react-native';
import { Link, useRouter, useLocalSearchParams } from 'expo-router';
import { Lock, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react-native';
import { resetPassword } from '@/lib/auth';
import { Text } from '@/components/ui/text';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { AuthScreen } from '@/components/auth/auth-screen';
import { useIconColors, useThemeColors } from '@/hooks';
import { bgColors } from '@/lib/styles';
```

- [ ] **Step 1: Apply all changes to reset-password.tsx**
- [ ] **Step 2: Verify typecheck**: `cd apps/mobile && pnpm typecheck`
- [ ] **Step 3: Verify lint**: `cd apps/mobile && pnpm lint`
- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/app/(auth)/reset-password.tsx
git commit -m "refactor(mobile): refonte reset-password — use AuthScreen, Pressable"
```

---

## Chunk 3: Validation

### Task 7: Final typecheck + lint

- [ ] **Step 1: Run full validation**

```bash
cd apps/mobile && pnpm typecheck && pnpm lint
```

- [ ] **Step 2: Fix any issues found**
- [ ] **Step 3: Commit fixes if needed**
