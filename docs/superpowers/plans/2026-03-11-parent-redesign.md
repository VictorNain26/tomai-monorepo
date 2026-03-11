# Parent Redesign Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign parent screens to show enriched child cards with Pronote data (grades, homework, activity) directly on the dashboard, simplify child detail with weekly summary + drill-down, and clean up the profile tab.

**Architecture:** Dashboard-first approach with 2 tabs. Each child gets an enriched card showing real data (average, homework count, study time, streak). Child detail page shows weekly summary, last 3 grades, next 3 homework items, and activity stats. Profile tab simplified by removing placeholder sections.

**Tech Stack:** React Native 0.83, Expo Router 7, NativeWind 5, TanStack Query 5, Zustand (Pronote store), React Native Reusables UI components.

**Spec:** `docs/superpowers/specs/2026-03-11-parent-redesign-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/components/parent/ChildCard.tsx` | Rewrite | Enriched card: avatar, name, level, average, homework count, study time, streak, Pronote badge |
| `src/app/(parent)/(home)/index.tsx` | Rewrite | Dashboard: greeting + enriched child cards list + empty state + create modal |
| `src/app/(parent)/(home)/child/[id]/index.tsx` | Rewrite | Detail: weekly summary + last grades + next homework + activity + launch Tom |
| `src/app/(parent)/(profile)/index.tsx` | Simplify | Remove placeholder sections (support, help), add Pronote link |
| `src/components/parent/ChildUsageCard.tsx` | Delete | Replaced by inline activity section in child detail |
| `src/app/(parent)/(home)/child/[id]/timetable.tsx` | Delete | Not useful for parents per spec |
| `src/components/parent/index.ts` | Modify | Remove ChildUsageCard export |
| `src/hooks/index.ts` | Check | Ensure useChildTokenUsage is still exported (used or not) |

---

## Chunk 1: Cleanup + ChildCard Rewrite

### Task 1: Delete unused files

**Files:**
- Delete: `src/app/(parent)/(home)/child/[id]/timetable.tsx`
- Delete: `src/components/parent/ChildUsageCard.tsx`
- Modify: `src/components/parent/index.ts` — remove ChildUsageCard export

- [ ] **Step 1: Delete timetable screen**

```bash
rm apps/mobile/src/app/\(parent\)/\(home\)/child/\[id\]/timetable.tsx
```

- [ ] **Step 2: Delete ChildUsageCard component**

```bash
rm apps/mobile/src/components/parent/ChildUsageCard.tsx
```

- [ ] **Step 3: Remove ChildUsageCard from parent index exports**

In `src/components/parent/index.ts`, remove the line:
```typescript
export { ChildUsageCard } from './ChildUsageCard';
```

- [ ] **Step 4: Verify no remaining imports of deleted files**

```bash
cd apps/mobile && npx tsc --noEmit 2>&1 | head -20
```

Expected: Errors in `child/[id]/index.tsx` (it imports ChildUsageCard) — this is expected, we'll fix it in Task 3.

- [ ] **Step 5: Commit cleanup**

```bash
git add -A apps/mobile/src/app/\(parent\)/\(home\)/child/\[id\]/timetable.tsx apps/mobile/src/components/parent/ChildUsageCard.tsx apps/mobile/src/components/parent/index.ts
git commit -m "chore(mobile): delete timetable screen and ChildUsageCard (parent redesign prep)"
```

---

### Task 2: Rewrite ChildCard with enriched data

**Files:**
- Rewrite: `src/components/parent/ChildCard.tsx`

The new ChildCard accepts Pronote data and metrics directly as props.

- [ ] **Step 1: Define new ChildCard props**

New interface:
```typescript
interface ChildCardProps {
  child: IChild;
  hasPronote: boolean;
  averageGrade: number | null;       // from Pronote grades
  homeworkCount: number;              // upcoming homework count
  studyTimeMinutes: number;           // from metrics
  streak: number;                     // study days streak
  onPress?: (child: IChild) => void;
}
```

- [ ] **Step 2: Implement new ChildCard**

Rewrite `src/components/parent/ChildCard.tsx` with:
- Avatar + name + level (top row)
- 2x2 grid of stats: average, homework, study time, streak
- Pronote badge (bottom)
- Icons: `BarChart3` (average), `BookOpen` (homework), `Clock` (study time), `Flame` (streak)
- Use `Card` from ui, `bgColors` for stat backgrounds
- Format study time: `<60min` show "Xmin", `>=60` show "XhYY"
- Average: show "X.X" or "—" if null
- Keep under 120 lines

- [ ] **Step 3: Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit 2>&1 | head -20
```

Expected: Errors in `(parent)/(home)/index.tsx` because ChildCard props changed — expected, fixed in Task 3.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/components/parent/ChildCard.tsx
git commit -m "feat(mobile): rewrite ChildCard with enriched Pronote + activity data"
```

---

## Chunk 2: Dashboard + Detail Rewrite

### Task 3: Rewrite parent dashboard

**Files:**
- Rewrite: `src/app/(parent)/(home)/index.tsx`

- [ ] **Step 1: Plan the data flow**

The dashboard needs per-child:
- `averageGrade`: computed from `usePronote(userId).grades` for each mapped child
- `homeworkCount`: count of upcoming homework from `usePronote(userId).homework`
- `studyTimeMinutes`: from `metrics` array (match by `studentId`)
- `streak`: from `metrics.studyDays` (approximation)

All Pronote data comes from the parent's single `usePronote(userId)` hook. Resource mappings tell us which child maps to which Pronote resource.

- [ ] **Step 2: Implement new dashboard**

Rewrite `src/app/(parent)/(home)/index.tsx`:
- Remove the 4-stat grid (childrenCount, activeChildren, totalStudyTime, totalSessions)
- Keep: header "Bonjour [Prenom]" + subtitle
- Keep: "+" button to add child
- Replace children section: render enriched `<ChildCard>` with computed props
- Keep: empty state when no children
- Keep: `<CreateChildModal>`
- Compute per-child stats by matching `metrics[].studentId === child.id`
- Compute per-child Pronote data: average from grades, count from homework
- Helper `computeAverageGrade(grades)`: sum(grade.value) / count, return null if empty
- Helper `countUpcomingHomework(homework)`: filter `!done`, return count
- Keep `formatStudyTime` helper
- Target: ~200 lines max

- [ ] **Step 3: Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit 2>&1 | head -20
```

Expected: Errors in `child/[id]/index.tsx` only (ChildUsageCard import removed next).

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/app/\(parent\)/\(home\)/index.tsx
git commit -m "feat(mobile): rewrite parent dashboard with enriched child cards"
```

---

### Task 4: Rewrite child detail screen

**Files:**
- Rewrite: `src/app/(parent)/(home)/child/[id]/index.tsx`

- [ ] **Step 1: Plan the new layout**

Sections (top to bottom):
1. Header: back + avatar + name + edit button
2. Weekly summary band: average | homework count | study time
3. Last 3 grades section with "Voir toutes" link
4. Next 3 homework section with "Voir tous" link
5. Activity section: progress bar + sessions + streak
6. "Lancer Tom" button
7. Delete child (bottom, subtle)

- [ ] **Step 2: Implement new child detail**

Rewrite `src/app/(parent)/(home)/child/[id]/index.tsx`:
- Remove: ChildUsageCard import and usage
- Remove: token usage section entirely
- Remove: Pronote connection status section (complex, confusing)
- Add: Weekly summary band (3 stats in a row)
- Add: Recent grades section — get last 3 from `pronoteHook.grades`, show subject + note/20 + trend arrow
- Add: Upcoming homework section — get next 3 non-done from `pronoteHook.homework`, show date + subject + description
- Add: Activity section — study time progress bar + sessions count + streak
- Keep: "Lancer Tom" button
- Keep: DeleteChildModal
- Keep: edit navigation
- If Pronote not connected: show CTA "Connecter Pronote" instead of grades/homework sections
- Target: ~350 lines max (split into sub-components if needed)

- [ ] **Step 3: Typecheck + test**

```bash
cd apps/mobile && npx tsc --noEmit 2>&1 | head -20
cd apps/mobile && npx jest --passWithNoTests 2>&1 | tail -10
```

Expected: Both pass with 0 errors.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/app/\(parent\)/\(home\)/child/\[id\]/index.tsx
git commit -m "feat(mobile): rewrite child detail with grades, homework, activity sections"
```

---

## Chunk 3: Profile Simplification + Final Validation

### Task 5: Simplify profile screen

**Files:**
- Modify: `src/app/(parent)/(profile)/index.tsx`

- [ ] **Step 1: Simplify profile**

Changes to `src/app/(parent)/(profile)/index.tsx`:
- Remove "Support" section (placeholder with disabled onPress)
- Add "Pronote" section between "Abonnement" and "Preferences":
  - Icon: `School`
  - Label: "Pronote"
  - Sublabel: "Connecte" or "Non connecte" (based on `usePronote().isConnected`)
  - onPress: navigate to `/(parent)/(profile)/pronote-connect`
  - showChevron: true
- Remove `HelpCircle` import (unused after support removal)
- Add `School` import from lucide
- Add `usePronote` hook import
- Target: ~220 lines

- [ ] **Step 2: Typecheck**

```bash
cd apps/mobile && npx tsc --noEmit 2>&1 | head -20
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/app/\(parent\)/\(profile\)/index.tsx
git commit -m "feat(mobile): simplify parent profile, add Pronote shortcut"
```

---

### Task 6: Final validation + cleanup

- [ ] **Step 1: Full typecheck**

```bash
cd apps/mobile && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 2: Run all tests**

```bash
cd apps/mobile && npx jest --passWithNoTests
```

Expected: 105/105 pass (no parent-specific tests exist, but no regressions).

- [ ] **Step 3: Lint check**

```bash
cd apps/mobile && npx eslint . --max-warnings 0 2>&1 | tail -10
```

Expected: 0 warnings, 0 errors.

- [ ] **Step 4: Verify no orphaned imports**

```bash
cd apps/mobile && grep -r "ChildUsageCard" src/ --include="*.tsx" --include="*.ts"
cd apps/mobile && grep -r "timetable" src/app/\(parent\)/ --include="*.tsx" --include="*.ts"
```

Expected: No matches for either.

- [ ] **Step 5: Final commit if any cleanup needed**

```bash
git add -A apps/mobile/
git commit -m "chore(mobile): parent redesign final cleanup"
```

- [ ] **Step 6: Push to staging**

```bash
git push
```
