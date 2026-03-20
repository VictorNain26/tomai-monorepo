# Mobile Modernisation 2026 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the mobile app with 2026 best practices: React Compiler, Hermes bytecode diffing, and React 19 patterns (no forwardRef, use(), simplified providers).

**Architecture:** Config-level changes first (Phase 1), then incremental refactoring of React patterns (Phase 2). Each task is independently committable and validated by typecheck + lint + tests.

**Tech Stack:** Expo SDK 55, React Native 0.83, React 19.2, NativeWind v5, babel-plugin-react-compiler

**Spec:** `docs/superpowers/specs/2026-03-20-mobile-modernisation-2026-design.md`

---

## Task 1: Enable React Compiler

**Files:**
- Modify: `babel.config.js`
- Modify: `package.json` (new devDependency)

- [ ] **Step 1: Install babel-plugin-react-compiler**

Run: `cd apps/mobile && pnpm add -D babel-plugin-react-compiler`
Expected: Package added to devDependencies

- [ ] **Step 2: Add React Compiler plugin to babel config**

In `babel.config.js`, insert `'babel-plugin-react-compiler'` as the first plugin, before `react-native-reanimated/plugin` (which must stay last):

```js
module.exports = function (api) {
  api.cache(true);

  const plugins = [
    'babel-plugin-react-compiler',
    ['react-native-reanimated/plugin', {}, 'react-native-reanimated'],
  ];

  if (process.env.NODE_ENV === 'production') {
    plugins.push(['transform-remove-console', { exclude: ['error', 'warn'] }]);
  }

  return {
    presets: ['babel-preset-expo'],
    plugins,
  };
};
```

- [ ] **Step 3: Clear Metro cache and validate**

Run: `cd apps/mobile && npx expo start --clear --dev-client 2>&1 | head -20`
Expected: Metro bundler starts without errors. Kill after confirming.

- [ ] **Step 4: Run typecheck + lint + tests**

Run: `cd apps/mobile && pnpm typecheck && pnpm lint && pnpm test`
Expected: All pass. If React Compiler causes issues with Reanimated worklets, add `"use no memo"` directive to affected files.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/ordiv/Tom/tomai-monorepo
git add apps/mobile/babel.config.js apps/mobile/package.json pnpm-lock.yaml
git commit -m "feat(mobile): enable React Compiler for automatic memoization"
```

---

## Task 2: Enable Hermes Bytecode Diffing

**Files:**
- Modify: `app.config.ts:117-128` (expo-build-properties plugin)

- [ ] **Step 1: Verify the correct flag name and add bytecode optimization**

First, check the Expo SDK 55 docs for the exact property name:
Run: `cd apps/mobile && npx expo config --type public 2>&1 | grep -i hermes || echo "Check expo-build-properties docs"`

Then in `app.config.ts`, update the `expo-build-properties` plugin config. Try `hermesBytecodeOptimizations: true` first:

```ts
[
  'expo-build-properties',
  {
    android: {
      minSdkVersion: 24,
      usesCleartextTraffic: false,
      hermesBytecodeOptimizations: true,
    },
    ios: {
      deploymentTarget: '15.1',
    },
  },
],
```

If `hermesBytecodeOptimizations` is not recognized by the plugin, try `enableBsdiffPatchSupport: true` instead. Verify with `npx expo-doctor`. The flag only affects EAS builds, not local dev.

- [ ] **Step 2: Run typecheck to validate config**

Run: `cd apps/mobile && pnpm typecheck`
Expected: PASS (config type-checks)

- [ ] **Step 3: Commit**

```bash
cd /c/Users/ordiv/Tom/tomai-monorepo
git add apps/mobile/app.config.ts
git commit -m "perf(mobile): enable Hermes bytecode optimizations for smaller OTA updates"
```

---

## Task 3: Remove forwardRef from Input component

**Files:**
- Modify: `src/components/ui/input.tsx:1,56-139,141`

- [ ] **Step 1: Refactor Input to use ref as regular prop**

Replace the current `forwardRef` pattern with a plain function component that accepts `ref` as a prop (React 19 pattern):

```tsx
import { useState } from 'react';
import { TextInput, View, Pressable, type TextInputProps } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';
import { Text } from './text';
import { useThemeColors } from '@/hooks/useThemeColors';
```

Change the component signature from:

```tsx
const Input = forwardRef<TextInput, InputProps>(
  (
    {
      className,
      variant,
      ...props
    },
    ref
  ) => {
```

To:

```tsx
function Input({
  className,
  variant,
  disabled,
  errorMessage,
  label,
  helperText,
  placeholderTextColor,
  accessibilityLabel,
  accessibilityHint,
  secureTextEntry,
  ref,
  ...props
}: InputProps & { ref?: React.Ref<TextInput> }) {
```

Remove `Input.displayName = 'Input';` (no longer needed without forwardRef).

- [ ] **Step 2: Run typecheck + tests**

Run: `cd apps/mobile && pnpm typecheck && pnpm test`
Expected: All pass

- [ ] **Step 3: Commit**

```bash
cd /c/Users/ordiv/Tom/tomai-monorepo
git add apps/mobile/src/components/ui/input.tsx
git commit -m "refactor(mobile): remove forwardRef from Input (React 19 ref-as-prop)"
```

---

## Task 4: Replace useContext with use() — UI components

**Files:**
- Modify: `src/components/ui/text.tsx:1,97`
- Modify: `src/components/ui/toast.tsx:1,42`
- Modify: `src/components/ui/confirm-dialog.tsx:8,47`

- [ ] **Step 1: Update text.tsx**

Line 1: Replace `import { createContext, useContext } from 'react'` with `import { createContext, use } from 'react'`
Line 97: Replace `const textClass = useContext(TextClassContext)` with `const textClass = use(TextClassContext)`

- [ ] **Step 2: Update toast.tsx**

Line 1: Replace `import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react'` with `import { createContext, use, useState, useCallback, useRef, useEffect, type ReactNode } from 'react'`
Line 42: Replace `const context = useContext(ToastContext)` with `const context = use(ToastContext)`

- [ ] **Step 3: Update confirm-dialog.tsx**

Line 8: Replace `import { createContext, useContext, useState, useCallback, useRef, type ReactNode } from 'react'` with `import { createContext, use, useState, useCallback, useRef, type ReactNode } from 'react'`
Line 47: Replace `const ctx = useContext(ConfirmContext)` with `const ctx = use(ConfirmContext)`

- [ ] **Step 4: Run typecheck + tests**

Run: `cd apps/mobile && pnpm typecheck && pnpm test`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
cd /c/Users/ordiv/Tom/tomai-monorepo
git add apps/mobile/src/components/ui/text.tsx apps/mobile/src/components/ui/toast.tsx apps/mobile/src/components/ui/confirm-dialog.tsx
git commit -m "refactor(mobile): replace useContext with use() in UI components (React 19)"
```

---

## Task 5: Replace useContext with use() — hooks and providers

**Files:**
- Modify: `src/hooks/useTheme.ts:11,55`
- Modify: `src/components/providers/RevenueCatProvider.tsx:7,62`

- [ ] **Step 1: Update useTheme.ts**

Line 11: Replace `import { useState, useEffect, useCallback, createContext, useContext } from 'react'` with `import { useState, useEffect, useCallback, createContext, use } from 'react'`
Line 55: Replace `const context = useContext(ThemeContext)` with `const context = use(ThemeContext)`

- [ ] **Step 2: Update RevenueCatProvider.tsx**

Line 7: Replace `import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react'` with `import { createContext, use, useEffect, useState, type ReactNode } from 'react'`
Line 62: Replace `return useContext(RevenueCatContext)` with `return use(RevenueCatContext)`

- [ ] **Step 3: Run typecheck + tests**

Run: `cd apps/mobile && pnpm typecheck && pnpm test`
Expected: All pass

- [ ] **Step 4: Commit**

```bash
cd /c/Users/ordiv/Tom/tomai-monorepo
git add apps/mobile/src/hooks/useTheme.ts apps/mobile/src/components/providers/RevenueCatProvider.tsx
git commit -m "refactor(mobile): replace useContext with use() in hooks/providers (React 19)"
```

---

## Task 6: Simplify Context Providers (remove .Provider)

**Files:**
- Modify: `src/components/ui/toast.tsx:240`
- Modify: `src/components/ui/confirm-dialog.tsx:153,230`
- Modify: `src/components/ui/button.tsx:142,169`
- Modify: `src/components/providers/ThemeProvider.tsx:18,20`
- Modify: `src/components/providers/RevenueCatProvider.tsx:55,57`

- [ ] **Step 1: Update toast.tsx**

Line 240: Replace `<ToastContext.Provider value={{ toasts, addToast, removeToast }}>` with `<ToastContext value={{ toasts, addToast, removeToast }}>`
Line 260: Replace `</ToastContext.Provider>` with `</ToastContext>`

- [ ] **Step 2: Update confirm-dialog.tsx**

Line 153: Replace `<ConfirmContext.Provider value={{ confirm, info }}>` with `<ConfirmContext value={{ confirm, info }}>`
Line 230: Replace `</ConfirmContext.Provider>` with `</ConfirmContext>`

- [ ] **Step 3: Update button.tsx**

Line 142: Replace `<TextClassContext.Provider value={textClass}>` with `<TextClassContext value={textClass}>`
Line 169: Replace `</TextClassContext.Provider>` with `</TextClassContext>`

- [ ] **Step 4: Update ThemeProvider.tsx**

Line 18: Replace `<ThemeContext.Provider value={theme}>` with `<ThemeContext value={theme}>`
Line 20: Replace `</ThemeContext.Provider>` with `</ThemeContext>`

- [ ] **Step 5: Update RevenueCatProvider.tsx**

Line 55: Replace `<RevenueCatContext.Provider value={{ isInitialized, error }}>` with `<RevenueCatContext value={{ isInitialized, error }}>`
Line 57: Replace `</RevenueCatContext.Provider>` with `</RevenueCatContext>`

- [ ] **Step 6: Run typecheck + lint + tests**

Run: `cd apps/mobile && pnpm typecheck && pnpm lint && pnpm test`
Expected: All pass

- [ ] **Step 7: Commit**

```bash
cd /c/Users/ordiv/Tom/tomai-monorepo
git add apps/mobile/src/components/ui/toast.tsx apps/mobile/src/components/ui/confirm-dialog.tsx apps/mobile/src/components/ui/button.tsx apps/mobile/src/components/providers/ThemeProvider.tsx apps/mobile/src/components/providers/RevenueCatProvider.tsx
git commit -m "refactor(mobile): simplify Context.Provider to Context (React 19)"
```

---

## Task 7: Final validation

- [ ] **Step 1: Run full validation suite**

Run: `cd apps/mobile && pnpm typecheck && pnpm lint && pnpm test`
Expected: All pass with zero warnings

- [ ] **Step 2: Verify no remaining legacy patterns**

Run these greps to confirm cleanup is complete:

```bash
cd apps/mobile
# Should return 0 matches:
grep -r "forwardRef" src/ --include="*.tsx" --include="*.ts" | grep -v node_modules || echo "OK: no forwardRef"
grep -r "useContext" src/ --include="*.tsx" --include="*.ts" | grep -v node_modules || echo "OK: no useContext"
grep -r "\.Provider" src/ --include="*.tsx" --include="*.ts" | grep -v node_modules || echo "OK: no .Provider"
```

Expected: All three return "OK" (zero matches). If any remain, they are in files not identified in this plan — evaluate and fix if appropriate.
