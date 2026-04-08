# Codebase Cleanup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all dead code, fix bugs found by audit, correct anti-patterns — zero over-engineering.

**Architecture:** Sequential cleanup tasks, each independently committable. Dead code removal first (safe), then bug fixes, then anti-pattern corrections.

**Tech Stack:** Expo SDK 55, React Native 0.83, React 19.2, NativeWind v5

---

## Task 1: Delete dead files

**Files:**
- Delete: `src/db/sync.ts`
- Delete: `src/types/index.ts`
- Delete: `src/components/providers/AppProviders.tsx`
- Delete: `src/hooks/useIconColors.ts`
- Modify: `src/db/index.ts` — remove sync.ts re-exports
- Modify: `src/hooks/index.ts` — remove useIconColors re-export
- Modify: `src/components/providers/index.ts` — remove AppProviders re-export

- [ ] **Step 1: Delete the 4 dead files**

```bash
cd apps/mobile
rm src/db/sync.ts src/types/index.ts src/components/providers/AppProviders.tsx src/hooks/useIconColors.ts
```

- [ ] **Step 2: Remove re-exports from barrel files**

In `src/db/index.ts`, remove all re-exports from `./sync` (syncPendingActions, queueAction, getPendingActions, etc.).

In `src/hooks/index.ts`, remove the line:
```ts
export { useIconColors, type IconColors } from './useIconColors';
```

In `src/components/providers/index.ts`, remove:
```ts
export { AppProviders } from './AppProviders';
```

- [ ] **Step 3: Replace AppProviders with ErrorBoundary in 3 layouts**

In `src/app/(auth)/_layout.tsx`:
- Change `import { AppProviders } from '@/components/providers'` to `import { ErrorBoundary } from '@/components/common/error-boundary'`
- Change `<AppProviders>` to `<ErrorBoundary>` and `</AppProviders>` to `</ErrorBoundary>`

Same changes in `src/app/(student)/_layout.tsx` and `src/app/(parent)/_layout.tsx`.

- [ ] **Step 4: Replace useIconColors with useThemeColors at all call sites**

Find all imports of `useIconColors` and replace with `useThemeColors`. The return type is the same (useIconColors just returned useThemeColors).

```bash
grep -r "useIconColors" src/ --include="*.tsx" --include="*.ts" -l
```

For each file: replace `import { useIconColors }` with `import { useThemeColors }` (or add to existing useThemeColors import), and replace `useIconColors()` calls with `useThemeColors()`. Rename the variable from `iconColors` to `colors` if it doesn't conflict with an existing `colors` variable.

- [ ] **Step 5: Remove dead exports from db/client.ts and dev-logger.ts**

In `src/db/client.ts`: remove `clearDatabase`, `getDatabaseStats`, `checkDatabaseIntegrity` functions and their exports.

In `src/lib/dev-logger.ts`: remove `getErrors` and `clearErrors` functions and their exports.

- [ ] **Step 6: Remove dead `cacheConversations` from useOfflineCache.ts**

In `src/hooks/useOfflineCache.ts`: remove the `cacheConversations` function (lines ~83-110) and its export.

- [ ] **Step 7: Validate**

Run: `cd apps/mobile && pnpm typecheck && pnpm lint && pnpm test`
Expected: All pass

- [ ] **Step 8: Commit**

```bash
git add -A apps/mobile/src/
git commit -m "chore(mobile): remove dead code — sync.ts, AppProviders, useIconColors, unused exports"
```

---

## Task 2: Fix bugs

**Files:**
- Modify: `src/hooks/useVoiceInput.ts:304` — sizeBytes hardcoded
- Modify: `src/components/learning/viewers/LanguageViewers.tsx:264,278` — key={index} on reorderable list
- Modify: `src/app/(student)/(learning)/create.tsx:125` — light-only overlay
- Modify: `src/app/(student)/(learning)/index.tsx:129` — conflicting className + style

- [ ] **Step 1: Fix sizeBytes in useVoiceInput.ts**

At line ~304, the presign call sends `sizeBytes: 1`. Read the file to find the exact location and fix it to pass the actual file size. The audio file URI is available — use `expo-file-system` `getInfoAsync` to get the real size before calling presign.

- [ ] **Step 2: Fix key={index} in LanguageViewers.tsx**

At lines ~264 and ~278, replace `key={index}` with `key={word}` or `key={item}` (the array items are strings, use the string value as key).

Also fix other viewer files with index keys on data-driven lists:
- `MathViewers.tsx:46` — use `key={step}`
- `ConceptViewer.tsx:33` — use `key={point}`
- `HistoryViewers.tsx:187,207,285` — use `key={event.date ?? index}` or the event text
- `ScienceViewers.tsx:107` — use `key={item}`
- `chat.tsx:333` — use `key={s.prompt}` instead of `key={i}`

- [ ] **Step 3: Fix light-only overlay in create.tsx**

At line ~125, replace:
```tsx
style={{ backgroundColor: bgColors.background[90] }}
```
With a theme-aware approach using `useTheme()`:
```tsx
style={{ backgroundColor: isDark ? 'rgba(28, 25, 23, 0.9)' : 'rgba(250, 250, 249, 0.9)' }}
```

- [ ] **Step 4: Fix conflicting styles in learning/index.tsx**

At line ~129, remove the inline `style={{ backgroundColor: bgColors.muted[50] }}` — keep only the NativeWind className `bg-white dark:bg-stone-800` (or vice versa, pick one source of truth).

- [ ] **Step 5: Validate**

Run: `cd apps/mobile && pnpm typecheck && pnpm lint && pnpm test`
Expected: All pass

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/
git commit -m "fix(mobile): fix sizeBytes bypass, index keys, dark mode overlay, conflicting styles"
```

---

## Task 3: Fix anti-patterns

**Files:**
- Modify: `src/hooks/useVoiceInput.ts:246` — ref mutation during render
- Modify: `src/hooks/useParentDashboard.ts:164` — missing useCallback
- Modify: `src/components/chat/FileLibraryPicker.tsx` — missing estimatedItemSize
- Modify: `src/app/(student)/(profile)/files.tsx` — missing estimatedItemSize
- Modify: `src/app/(student)/(profile)/info.tsx:26-52` — duplicated LEVEL_LABELS
- Modify: `src/components/chat/ChatMessage.tsx:107` — dead `void confirmed`

- [ ] **Step 1: Fix ref mutation during render in useVoiceInput.ts**

At line ~246, wrap in useEffect:
```tsx
// Before (anti-pattern):
stopRecordingRef.current = stopRecording;

// After:
useEffect(() => { stopRecordingRef.current = stopRecording; }, [stopRecording]);
```

- [ ] **Step 2: Add useCallback to invalidateParentData in useParentDashboard.ts**

At line ~164:
```tsx
// Before:
const invalidateParentData = () => { ... };

// After:
const invalidateParentData = useCallback(() => { ... }, [queryClient]);
```

- [ ] **Step 3: Add estimatedItemSize to FlashList instances**

In `FileLibraryPicker.tsx` and `files.tsx`, add `estimatedItemSize={72}` to `<FlashList>`.

- [ ] **Step 4: Replace duplicated LEVEL_LABELS in info.tsx**

Remove the local `LEVEL_LABELS` constant (lines ~26-52). Import `getLevelLabel` from `@/constants/levels` instead. If legacy keys are needed, add them to the shared constant.

- [ ] **Step 5: Remove dead code in ChatMessage.tsx**

At line ~107, remove `void confirmed;` and simplify the confirm call (remove unused `const confirmed =` assignment).

- [ ] **Step 6: Validate**

Run: `cd apps/mobile && pnpm typecheck && pnpm lint && pnpm test`
Expected: All pass

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/
git commit -m "refactor(mobile): fix anti-patterns — ref mutation, useCallback, FlashList, dead code"
```

---

## Task 4: Final validation

- [ ] **Step 1: Full validation suite**

Run: `cd apps/mobile && pnpm typecheck && pnpm lint && pnpm test`

- [ ] **Step 2: Verify no dead exports remain**

```bash
grep -r "sync.ts\|AppProviders\|useIconColors\|clearDatabase\|getDatabaseStats\|checkDatabaseIntegrity\|getErrors\|clearErrors\|cacheConversations" src/ --include="*.ts" --include="*.tsx"
```
Expected: Zero matches

- [ ] **Step 3: expo-doctor**

Run: `npx expo-doctor`
Expected: 17/17 checks pass
