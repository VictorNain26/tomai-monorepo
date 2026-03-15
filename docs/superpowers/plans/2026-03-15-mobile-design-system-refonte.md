# Mobile Design System Refonte "Warm Minimal" — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refonte complete du design system mobile — migration Slate→Stone, nouvelle typographie (Nunito Sans + Poppins), nettoyage du code mort (~300 lignes), simplification des composants, dark mode par defaut.

**Architecture:** Migration par couches — d'abord le theming (couleurs + fonts), puis les composants UI, puis le search & replace mecanique Slate→Stone sur tout le codebase. Chaque tache est independante et commitee separement.

**Tech Stack:** NativeWind v5, CVA, React Native Reusables, @expo-google-fonts, Tailwind CSS 4

**Spec:** `docs/superpowers/specs/2026-03-15-mobile-design-system-refonte-design.md`

---

## Chunk 1: Theme Foundation (couleurs, fonts, dark mode)

### Task 1: Migrate useThemeColors.ts — Slate hex → Stone hex

**Files:**
- Modify: `apps/mobile/src/hooks/useThemeColors.ts`

- [ ] **Step 1: Update ThemeColors interface — remove `white` token**

Remove the `white` field from the interface (0 usage).

```typescript
// BEFORE (line 12)
  white: string;
// REMOVE this line
```

- [ ] **Step 2: Update LIGHT constant with Stone hex values**

```typescript
const LIGHT: ThemeColors = {
  primary: '#3B82F6',        // blue-500 (was #2563EB blue-600)
  primaryForeground: '#FFFFFF',
  success: '#059669',        // emerald-600 (unchanged)
  successForeground: '#FFFFFF',
  warning: '#D97706',        // amber-600 (unchanged)
  warningForeground: '#FFFFFF',
  destructive: '#DC2626',    // red-600 (unchanged)
  destructiveForeground: '#FFFFFF',
  info: '#0EA5E9',           // sky-500 (unchanged)
  infoForeground: '#FFFFFF',
  foreground: '#1C1917',     // stone-900 (was #1E293B slate-800)
  muted: '#78716C',          // stone-500 (was #64748B slate-500)
  background: '#FAFAF9',     // stone-50 (was #F8FAFC slate-50)
  border: '#E7E5E4',         // stone-200 (was #E2E8F0 slate-200)
  card: '#FFFFFF',           // unchanged
};
```

- [ ] **Step 3: Update DARK constant with Stone hex values**

```typescript
const DARK: ThemeColors = {
  primary: '#60A5FA',        // blue-400 (unchanged)
  primaryForeground: '#1C1917', // stone-900 (was #1E293B)
  success: '#34D399',        // emerald-400 (unchanged)
  successForeground: '#1C1917',
  warning: '#FBBF24',        // amber-400 (unchanged)
  warningForeground: '#1C1917',
  destructive: '#F87171',    // red-400 (unchanged)
  destructiveForeground: '#1C1917',
  info: '#38BDF8',           // sky-400 (unchanged)
  infoForeground: '#1C1917',
  foreground: '#F5F5F4',     // stone-100 (was #F1F5F9 slate-100)
  muted: '#A8A29E',          // stone-400 (was #94A3B8 slate-400)
  background: '#1C1917',     // stone-900 (was #0F172A slate-900)
  border: '#44403C',         // stone-700 (was #334155 slate-700)
  card: '#292524',           // stone-800 (was #374151 gray-700)
};
```

- [ ] **Step 4: Verify typecheck**

Run: `cd apps/mobile && pnpm typecheck`
Expected: PASS (or errors pointing to consumers of `white` — should be 0)

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/hooks/useThemeColors.ts
git commit -m "refactor(mobile): migrate useThemeColors Slate→Stone hex values"
```

---

### Task 2: Clean up styles.ts — remove dead opacity scales

**Files:**
- Modify: `apps/mobile/src/lib/styles.ts`

- [ ] **Step 1: Remove `shadows.none`**

Delete lines 3-7 (the `none` key in `shadows` object).

- [ ] **Step 2: Remove dead bgColors scales**

Remove:
- `bgColors.white` (entire object — lines 55-57)
- `bgColors.background[5]`, `[10]`, `[20]` (keep only `[90]`)
- `bgColors.info[15]`, `[20]` (keep only `[5]`, `[10]`)
- `bgColors.primary[30]` (keep `[5]`, `[10]`, `[15]`, `[20]`)
- `bgColors.success[15]` (keep `[5]`, `[10]`, `[20]`)
- `bgColors.warning[15]` (keep `[5]`, `[10]`, `[20]`)
- `bgColors.destructive[15]` (keep `[5]`, `[10]`, `[20]`)

- [ ] **Step 3: Remove dead borderColors scales**

Remove:
- `borderColors.info` (entire object — lines 71-73)
- `borderColors.success` — remove if only `[50]` is defined and unused; keep `[20]` and `[30]`

- [ ] **Step 4: Update surviving rgba base values to match new palette**

The remaining rgba values must match the new Stone/blue-500 palette:

**`bgColors.primary` / `borderColors.primary`**: `rgba(37, 99, 235, …)` (blue-600) → `rgba(59, 130, 246, …)` (blue-500)
**`bgColors.muted` / `borderColors.muted`**: `rgba(107, 114, 128, …)` (gray-500) → `rgba(120, 113, 108, …)` (stone-500)

Apply this to ALL surviving opacity entries for `primary` and `muted` in both `bgColors` and `borderColors`.

- [ ] **Step 5: Verify typecheck**

Run: `cd apps/mobile && pnpm typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/lib/styles.ts
git commit -m "refactor(mobile): clean styles.ts — remove dead scales, update rgba to Stone/blue-500"
```

---

### Task 3: Dark mode par defaut

**Files:**
- Modify: `apps/mobile/src/hooks/useTheme.ts`

- [ ] **Step 1: Change default themeMode from 'system' to 'dark'**

```typescript
// Line 56 — change initial state
const [themeMode, setThemeModeState] = useState<ThemeMode>('dark');
```

- [ ] **Step 2: Apply dark mode on mount when no saved preference**

In the `loadTheme` function (line 65-72), add an else branch to apply dark default:

```typescript
async function loadTheme() {
  try {
    const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
    if (saved && ['light', 'dark', 'system'].includes(saved)) {
      const mode = saved as ThemeMode;
      setThemeModeState(mode);
      Appearance.setColorScheme(mode === 'system' ? 'unspecified' : mode);
    } else {
      // No saved preference — apply dark default
      Appearance.setColorScheme('dark');
    }
  } catch {
    // Ignore errors, apply dark default
    Appearance.setColorScheme('dark');
  } finally {
    setIsLoading(false);
  }
}
```

- [ ] **Step 3: Verify typecheck**

Run: `cd apps/mobile && pnpm typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/hooks/useTheme.ts
git commit -m "feat(mobile): dark mode as default theme for new users"
```

---

### Task 4: Font migration — Nunito Sans + Poppins

**Files:**
- Modify: `apps/mobile/package.json`
- Modify: `apps/mobile/src/app/_layout.tsx`
- Modify: `apps/mobile/src/global.css`

- [ ] **Step 1: Install new font packages, remove old ones**

```bash
cd apps/mobile && pnpm add @expo-google-fonts/nunito-sans @expo-google-fonts/poppins && pnpm remove @expo-google-fonts/inter @expo-google-fonts/plus-jakarta-sans
```

- [ ] **Step 2: Update _layout.tsx font imports**

Replace the font import block (lines 11-21 in the original, the 3 import statements for inter, plus-jakarta-sans, and jetbrains-mono):

```typescript
import {
  useFonts,
  NunitoSans_400Regular,
  NunitoSans_500Medium,
  NunitoSans_600SemiBold,
} from '@expo-google-fonts/nunito-sans';
import {
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import { JetBrainsMono_400Regular } from '@expo-google-fonts/jetbrains-mono';
```

- [ ] **Step 3: Update useFonts() call**

Replace the `useFonts()` call (the object passed to `useFonts` listing Inter/PlusJakartaSans/JetBrainsMono):

```typescript
const [fontsLoaded] = useFonts({
  NunitoSans_400Regular,
  NunitoSans_500Medium,
  NunitoSans_600SemiBold,
  Poppins_600SemiBold,
  Poppins_700Bold,
  JetBrainsMono_400Regular,
});
```

- [ ] **Step 4: Add font theme tokens to global.css**

Add inside the `@theme` block in `global.css`:

```css
@theme {
  /* Fonts */
  --font-sans: 'NunitoSans';
  --font-heading: 'Poppins';
  --font-mono: 'JetBrainsMono';

  /* Border Radius */
  --radius-2xl: 16px;
  /* ... rest unchanged ... */
}
```

- [ ] **Step 5: Verify typecheck**

Run: `cd apps/mobile && pnpm typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/package.json apps/mobile/src/app/_layout.tsx apps/mobile/src/global.css pnpm-lock.yaml
git commit -m "feat(mobile): migrate fonts to Nunito Sans (body) + Poppins (headings)"
```

> **Note:** Native rebuild required (`pnpm build:dev`) to test fonts visually. Typecheck will pass without rebuild.

---

## Chunk 2: Component Cleanup

### Task 5: Delete Badge component

**Files:**
- Delete: `apps/mobile/src/components/ui/badge.tsx`

- [ ] **Step 1: Verify 0 imports**

```bash
cd apps/mobile && grep -r "badge" src/ --include="*.tsx" --include="*.ts" -l
```

Expected: Only `badge.tsx` itself (and possibly an index re-export).

- [ ] **Step 2: Delete the file**

```bash
rm apps/mobile/src/components/ui/badge.tsx
```

- [ ] **Step 3: Remove re-export if any index file exports it**

Search for and remove any `export * from './badge'` or `export { Badge }` in `src/components/ui/index.ts` or similar.

- [ ] **Step 4: Verify typecheck**

Run: `cd apps/mobile && pnpm typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add -u apps/mobile/src/components/ui/badge.tsx
git commit -m "refactor(mobile): delete unused Badge component (0 imports)"
```

---

### Task 6: Clean up Skeleton — remove unused presets

**Files:**
- Modify: `apps/mobile/src/components/ui/skeleton.tsx`

- [ ] **Step 1: Remove preset components and their exports**

Delete lines 59-104 (SkeletonText, SkeletonAvatar, SkeletonCard, SkeletonButton functions).

Update exports (line 99-104) to only:

```typescript
export { Skeleton };
export type { SkeletonProps };
```

- [ ] **Step 2: Migrate Slate→Stone in Skeleton base**

Line 46: Replace `bg-slate-100 dark:bg-slate-800` with `bg-stone-100 dark:bg-stone-800`.

- [ ] **Step 3: Verify typecheck**

Run: `cd apps/mobile && pnpm typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/components/ui/skeleton.tsx
git commit -m "refactor(mobile): remove unused Skeleton presets, migrate to Stone"
```

---

### Task 7: Simplify Button component

**Files:**
- Modify: `apps/mobile/src/components/ui/button.tsx`
- Modify: `apps/mobile/src/components/dashboard/HomeworkUrgentCard.tsx`
- Modify: `apps/mobile/src/components/dashboard/GradesRecentCard.tsx`

- [ ] **Step 1: Migrate `subtle` → `ghost` in consumers**

In `HomeworkUrgentCard.tsx` (~line 223): change `variant="subtle"` to `variant="ghost"`
In `GradesRecentCard.tsx` (~line 259): change `variant="subtle"` to `variant="ghost"`

- [ ] **Step 2: Remove dead CVA variants from buttonVariants**

Remove `secondary`, `link`, `subtle` from the variant object. Keep `default`, `destructive`, `outline`, `ghost`.

Also migrate Slate→Stone in remaining variants:
- `outline`: `border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900` → `border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900`

- [ ] **Step 3: Remove dead size variants**

Remove `lg` and `icon-lg` from size object. Keep `default`, `sm`, `icon`, `icon-sm`.

- [ ] **Step 4: Clean buttonTextVariants**

Remove `secondary`, `link`, `subtle` from variant object. Remove `lg`, `icon-lg` from size object.
Migrate Slate→Stone:
- `default`/`destructive` text: `text-slate-900` → `text-stone-900`
- `outline`/`ghost` text: `text-slate-800 dark:text-slate-100` → `text-stone-800 dark:text-stone-100`

- [ ] **Step 5: Narrow HapticFeedback type and simplify switch**

```typescript
type HapticFeedback = 'none' | 'light' | 'heavy';
```

Replace the switch block (lines 135-154) with:

```typescript
if (hapticType === 'light') {
  haptics.light();
} else if (hapticType === 'heavy') {
  haptics.heavy();
}
```

- [ ] **Step 6: Clean getSpinnerColor**

Remove `subtle`, `link`, `secondary` cases:

```typescript
const getSpinnerColor = () => {
  switch (variant) {
    case 'default':
      return colors.primaryForeground;
    case 'destructive':
      return colors.destructiveForeground;
    case 'outline':
    case 'ghost':
      return colors.primary;
    default:
      return colors.primaryForeground;
  }
};
```

- [ ] **Step 7: Clean needsActiveOpacity**

Remove `secondary` and `subtle`:

```typescript
const needsActiveOpacity = variant === 'default' || variant === 'destructive';
```

- [ ] **Step 8: Remove ButtonText component and useButtonTextClass export**

Delete the `ButtonText` function (lines 220-231), `useButtonTextClass` export (lines 85-87).

Update exports:

```typescript
export { Button, buttonVariants, buttonTextVariants };
export type { ButtonProps, HapticFeedback };
```

- [ ] **Step 9: Migrate web ring-offset Slate→Stone in base class**

Line 26: Replace `ring-offset-slate-50 dark:web:ring-offset-slate-900` with `ring-offset-stone-50 dark:web:ring-offset-stone-900`.

- [ ] **Step 10: Verify typecheck**

Run: `cd apps/mobile && pnpm typecheck`
Expected: PASS

- [ ] **Step 11: Commit**

```bash
git add apps/mobile/src/components/ui/button.tsx apps/mobile/src/components/dashboard/HomeworkUrgentCard.tsx apps/mobile/src/components/dashboard/GradesRecentCard.tsx
git commit -m "refactor(mobile): simplify Button — remove dead variants, narrow haptics, migrate Stone"
```

---

### Task 8: Simplify Text component + font integration

**Files:**
- Modify: `apps/mobile/src/components/ui/text.tsx`

- [ ] **Step 1: Remove dead variants and add font classes**

Replace the `textVariants` definition with:

```typescript
const textVariants = cva(
  cn('text-base text-stone-800 dark:text-stone-100 font-sans', Platform.select({ web: 'select-text' })),
  {
    variants: {
      variant: {
        default: '',
        // Headings - Poppins via font-heading token
        h1: 'text-3xl font-bold tracking-tight font-heading',
        h2: 'text-2xl font-bold tracking-tight font-heading',
        h3: 'text-xl font-semibold tracking-tight font-heading',
        h4: 'text-lg font-semibold tracking-tight font-heading',
        // Body variants
        large: 'text-lg font-semibold',
        small: 'text-sm font-medium',
        muted: 'text-sm text-stone-500 dark:text-stone-400',
        tiny: 'text-xs font-medium text-stone-500 dark:text-stone-400',
        // Semantic variants
        error: 'text-sm text-red-600 dark:text-red-400',
        success: 'text-sm text-emerald-600 dark:text-emerald-400',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
);
```

Removed: `heading`, `lead`, `label`, `caption`.

- [ ] **Step 2: Update getAccessibilityRole — remove 'heading' variant**

```typescript
function getAccessibilityRole(
  variant: TextProps['variant']
): AccessibilityRole | undefined {
  if (
    variant === 'h1' ||
    variant === 'h2' ||
    variant === 'h3' ||
    variant === 'h4'
  ) {
    return 'header';
  }
  return undefined;
}
```

- [ ] **Step 3: Remove 'heading' from ARIA_LEVEL**

Already correct — the existing ARIA_LEVEL only has h1-h4. No change needed.

- [ ] **Step 4: Migrate `caption` usages to `muted` or `tiny`**

Replace `variant="caption"` with `variant="muted"` in these 2 files:
- `apps/mobile/src/app/(parent)/(profile)/index.tsx` (line ~243)
- `apps/mobile/src/app/(student)/(profile)/index.tsx` (line ~334)

- [ ] **Step 5: Update docstring**

Replace the typography scale comment to reflect the new fonts (Poppins for headings, Nunito Sans for body).

- [ ] **Step 6: Verify typecheck**

Run: `cd apps/mobile && pnpm typecheck`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/components/ui/text.tsx "apps/mobile/src/app/(parent)/(profile)/index.tsx" "apps/mobile/src/app/(student)/(profile)/index.tsx"
git commit -m "refactor(mobile): simplify Text — remove dead variants, add font-heading/font-sans, migrate caption→muted"
```

---

### Task 9: Simplify Progress — remove unused `success` variant

**Files:**
- Modify: `apps/mobile/src/components/ui/progress.tsx`

- [ ] **Step 1: Remove `success` from progressIndicatorVariants**

```typescript
const progressIndicatorVariants = cva('h-full rounded-full', {
  variants: {
    variant: {
      default: 'bg-blue-600 dark:bg-blue-400',
      warning: 'bg-amber-600 dark:bg-amber-400',
      destructive: 'bg-red-600 dark:bg-red-400',
    },
  },
  defaultVariants: {
    variant: 'default',
  },
});
```

- [ ] **Step 2: Migrate Slate→Stone in progressVariants base**

```typescript
const progressVariants = cva('w-full overflow-hidden rounded-full bg-stone-100 dark:bg-stone-800', {
```

- [ ] **Step 3: Verify typecheck**

Run: `cd apps/mobile && pnpm typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/components/ui/progress.tsx
git commit -m "refactor(mobile): simplify Progress — remove unused success variant, migrate Stone"
```

---

## Chunk 3: Mechanical Slate → Stone Migration

### Task 10: Search & replace all Slate Tailwind classes → Stone

**Files:**
- Modify: All `.tsx` and `.ts` files in `apps/mobile/src/`

This task is purely mechanical. Replace every occurrence of `slate-` with `stone-` in Tailwind class strings across the entire mobile source tree.

- [ ] **Step 1: Run search to count occurrences**

```bash
cd apps/mobile && grep -r "slate-" src/ --include="*.tsx" --include="*.ts" -c | grep -v ":0$"
```

Note the count for validation.

- [ ] **Step 2: Perform the replacement**

```bash
cd apps/mobile && find src/ -type f \( -name "*.tsx" -o -name "*.ts" \) -exec sed -i 's/slate-/stone-/g' {} +
```

- [ ] **Step 3: Verify no remaining `slate-` references**

```bash
cd apps/mobile && grep -r "slate-" src/ --include="*.tsx" --include="*.ts"
```

Expected: 0 results.

- [ ] **Step 4: Verify typecheck + lint**

Run: `cd apps/mobile && pnpm typecheck && pnpm lint`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/
git commit -m "refactor(mobile): migrate all Tailwind classes Slate→Stone across codebase"
```

---

### Task 11: Final validation

- [ ] **Step 1: Full typecheck**

```bash
cd apps/mobile && pnpm typecheck
```

Expected: PASS

- [ ] **Step 2: Full lint**

```bash
cd apps/mobile && pnpm lint
```

Expected: PASS (0 warnings)

- [ ] **Step 3: Run tests**

```bash
cd apps/mobile && pnpm test
```

Expected: All tests pass.

- [ ] **Step 4: Verify no remaining slate references**

```bash
cd apps/mobile && grep -r "slate" src/ --include="*.tsx" --include="*.ts"
```

Expected: 0 results.

- [ ] **Step 5: Verify no dead Badge imports**

```bash
cd apps/mobile && grep -r "Badge" src/ --include="*.tsx" --include="*.ts"
```

Expected: 0 results.

- [ ] **Step 6: Verify no dead Skeleton preset imports**

```bash
cd apps/mobile && grep -r "SkeletonText\|SkeletonAvatar\|SkeletonCard\|SkeletonButton" src/ --include="*.tsx" --include="*.ts"
```

Expected: 0 results.
