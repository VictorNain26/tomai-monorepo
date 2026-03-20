# Parent Dashboard + Child Creation Redesign — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the modal-based child creation with a dedicated screen, refactor dashboard to a horizontal carousel, and redesign the child detail screen.

**Architecture:** File-based Expo Router screen (`add-child.tsx`) replaces `CreateChildModal`. Dashboard switches from vertical `ScrollView` list to horizontal `FlatList` carousel with snap. Child detail gets a hero header with gradient + reorganized sections.

**Tech Stack:** Expo Router, React Native FlatList, react-hook-form + Zod, NativeWind, React Native Reusables, React Query

**Spec:** `docs/superpowers/specs/2026-03-13-parent-dashboard-child-creation-redesign.md`

---

## Chunk 1: Infrastructure + Small Components

### Task 1: Register add-child screen in layout

**Files:**
- Modify: `apps/mobile/src/app/(parent)/(home)/_layout.tsx`

- [ ] **Step 1: Add Stack.Screen registration**

```tsx
// In _layout.tsx, add inside <Stack>:
<Stack.Screen name="add-child" options={{ title: 'Nouvel enfant' }} />
```

The full file becomes:

```tsx
import { Stack } from 'expo-router';
import { useStackScreenOptions } from '@/lib/navigation';

export default function HomeLayout() {
  const screenOptions = useStackScreenOptions();

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" />
      <Stack.Screen name="add-child" options={{ title: 'Nouvel enfant' }} />
      <Stack.Screen name="child" />
      <Stack.Screen name="pronote-connect" />
    </Stack>
  );
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `cd apps/mobile && pnpm typecheck`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/app/\(parent\)/\(home\)/_layout.tsx
git commit -m "feat(mobile): register add-child screen in parent home layout"
```

---

### Task 2: Create PaginationDots component

**Files:**
- Create: `apps/mobile/src/components/parent/PaginationDots.tsx`

- [ ] **Step 1: Write the component**

```tsx
import { View } from 'react-native';
import { useThemeColors } from '@/hooks';

interface PaginationDotsProps {
  total: number;
  activeIndex: number;
}

export function PaginationDots({ total, activeIndex }: PaginationDotsProps) {
  const colors = useThemeColors();

  if (total <= 1) return null;

  return (
    <View className="flex-row items-center justify-center gap-1.5 py-3">
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          className="rounded-full"
          style={{
            width: i === activeIndex ? 20 : 6,
            height: 6,
            backgroundColor: i === activeIndex ? colors.primary : 'rgba(107, 114, 128, 0.3)',
          }}
        />
      ))}
    </View>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd apps/mobile && pnpm typecheck`

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/parent/PaginationDots.tsx
git commit -m "feat(mobile): add PaginationDots component for carousel"
```

---

### Task 3: Create AddChildCard component

**Files:**
- Create: `apps/mobile/src/components/parent/AddChildCard.tsx`

- [ ] **Step 1: Write the component**

```tsx
import { View, TouchableOpacity } from 'react-native';
import { Plus } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { useThemeColors } from '@/hooks';

interface AddChildCardProps {
  onPress: () => void;
}

export function AddChildCard({ onPress }: AddChildCardProps) {
  const colors = useThemeColors();

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <View
        className="items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-800/50"
        style={{ minHeight: 220 }}
      >
        <View
          className="mb-3 h-14 w-14 items-center justify-center rounded-full"
          style={{ backgroundColor: 'rgba(37, 99, 235, 0.1)' }}
        >
          <Plus color={colors.primary} size={28} />
        </View>
        <Text className="font-semibold" style={{ color: colors.primary }}>
          Ajouter un enfant
        </Text>
      </View>
    </TouchableOpacity>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd apps/mobile && pnpm typecheck`

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/parent/AddChildCard.tsx
git commit -m "feat(mobile): add AddChildCard dashed CTA for carousel"
```

---

### Task 4: Create LevelPickerSheet component

**Files:**
- Create: `apps/mobile/src/components/parent/LevelPickerSheet.tsx`

Uses React Native `Modal` primitive (React Native Reusables constraint — no @gorhom/bottom-sheet).

- [ ] **Step 1: Write the component**

```tsx
import { View, TouchableOpacity, Modal, ScrollView, Pressable } from 'react-native';
import { X, Check } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { useIconColors, useThemeColors } from '@/hooks';
import { LEVEL_LABELS, type EducationLevelType } from '@/constants/levels';

interface LevelPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (level: EducationLevelType) => void;
  selectedLevel?: string;
}

const LEVEL_GROUPS: { title: string; levels: EducationLevelType[] }[] = [
  { title: 'Primaire', levels: ['cp', 'ce1', 'ce2', 'cm1', 'cm2'] },
  { title: 'College', levels: ['sixieme', 'cinquieme', 'quatrieme', 'troisieme'] },
  { title: 'Lycee', levels: ['seconde', 'premiere', 'terminale'] },
];

export function LevelPickerSheet({ visible, onClose, onSelect, selectedLevel }: LevelPickerSheetProps) {
  const iconColors = useIconColors();
  const colors = useThemeColors();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable className="flex-1 justify-end" style={{ backgroundColor: 'rgba(0,0,0,0.4)' }} onPress={onClose}>
        <Pressable
          className="rounded-t-3xl bg-white dark:bg-slate-900 pb-8"
          onPress={(e) => e.stopPropagation()}
        >
          {/* Handle bar */}
          <View className="items-center pt-3 pb-2">
            <View className="h-1 w-10 rounded-full bg-slate-300 dark:bg-slate-600" />
          </View>

          {/* Header */}
          <View className="flex-row items-center justify-between px-5 pb-3">
            <Text className="text-lg font-semibold">Niveau scolaire</Text>
            <TouchableOpacity onPress={onClose} className="p-1">
              <X color={iconColors.muted} size={20} />
            </TouchableOpacity>
          </View>

          {/* Level list */}
          <ScrollView className="max-h-96 px-5" showsVerticalScrollIndicator={false}>
            {LEVEL_GROUPS.map((group) => (
              <View key={group.title} className="mb-4">
                <Text variant="muted" className="mb-2 text-xs font-semibold uppercase tracking-wider">
                  {group.title}
                </Text>
                {group.levels.map((level) => {
                  const isSelected = selectedLevel === level;
                  return (
                    <TouchableOpacity
                      key={level}
                      onPress={() => { onSelect(level); onClose(); }}
                      className="flex-row items-center justify-between rounded-xl px-4 py-3 mb-1"
                      style={isSelected ? { backgroundColor: 'rgba(37, 99, 235, 0.08)' } : undefined}
                    >
                      <Text className={isSelected ? 'font-semibold' : ''}>
                        {LEVEL_LABELS[level]}
                      </Text>
                      {isSelected && <Check color={colors.primary} size={18} />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
```

- [ ] **Step 2: Verify typecheck**

Run: `cd apps/mobile && pnpm typecheck`

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/parent/LevelPickerSheet.tsx
git commit -m "feat(mobile): add LevelPickerSheet bottom sheet component"
```

---

### Task 5: Update barrel exports

**Files:**
- Modify: `apps/mobile/src/components/parent/index.ts`

- [ ] **Step 1: Update exports**

Replace the full file with:

```ts
// Parent Components

export { ChildCard } from './ChildCard';
export { AddChildCard } from './AddChildCard';
export { PaginationDots } from './PaginationDots';
export { LevelPickerSheet } from './LevelPickerSheet';
export { DeleteChildModal } from './DeleteChildModal';
export { PronoteChildSelectorModal } from './PronoteChildSelectorModal';
export { PronoteQrScanner } from './PronoteQrScanner';
export { PronotePinEntry } from './PronotePinEntry';
```

Note: `CreateChildModal` and `LevelPickerModal` exports are removed. The files themselves will be deleted in Task 7.

- [ ] **Step 2: Verify typecheck** (will fail until dashboard is updated in Task 6 — expected)

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/parent/index.ts
git commit -m "refactor(mobile): update parent barrel exports for redesign"
```

---

## Chunk 2: Dashboard Carousel Refactor

### Task 6: Rewrite parent dashboard with carousel

**Files:**
- Modify: `apps/mobile/src/app/(parent)/(home)/index.tsx`
- Modify: `apps/mobile/src/components/parent/ChildCard.tsx`

**Important:** The ChildCard component stays mostly the same but gets a "Ouvrir" button replacing the ChevronRight. The dashboard switches from vertical ScrollView to horizontal FlatList carousel.

- [ ] **Step 1: Update ChildCard — replace ChevronRight with "Ouvrir" button**

In `ChildCard.tsx`, make these changes:

1. Remove `ChevronRight` from imports, add `ArrowRight`
2. Replace the chevron icon in the top row with the "Ouvrir" button at the bottom
3. Keep all existing props and stats grid unchanged

Updated component (full file):

```tsx
/**
 * ChildCard Component - TomAI 2026
 *
 * Enriched card for carousel: avatar, stats grid, Pronote badge, open button.
 */

import { View, TouchableOpacity } from 'react-native';
import {
  GraduationCap,
  BarChart3,
  BookOpen,
  Clock,
  Flame,
  CheckCircle2,
  Link2,
  ArrowRight,
} from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Card } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { getLevelLabel } from '@/constants/levels';
import { useIconColors, useThemeColors } from '@/hooks';
import type { IChild } from '@/hooks/useParentDashboard';
import { bgColors } from '@/lib/styles';

interface ChildCardProps {
  child: IChild;
  hasPronote: boolean;
  averageGrade: number | null;
  homeworkCount: number;
  studyTimeMinutes: number;
  streak: number;
  onPress?: (child: IChild) => void;
}

function formatStudyTime(minutes: number): string {
  if (minutes === 0) return '0min';
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h${String(mins).padStart(2, '0')}` : `${hours}h`;
}

export function ChildCard({
  child,
  hasPronote,
  averageGrade,
  homeworkCount,
  studyTimeMinutes,
  streak,
  onPress,
}: ChildCardProps) {
  const iconColors = useIconColors();
  const colors = useThemeColors();
  const fullName = `${child.firstName} ${child.lastName}`;
  const levelLabel = getLevelLabel(child.schoolLevel);

  return (
    <Card>
      <View className="p-4">
        {/* Top row: avatar + name + Pronote badge */}
        <View className="flex-row items-center">
          <Avatar fallback={fullName} size="lg" className="mr-3" />
          <View className="flex-1">
            <Text className="text-lg font-semibold">{child.firstName}</Text>
            <View className="flex-row items-center gap-1.5 mt-0.5">
              <GraduationCap color={iconColors.muted} size={13} />
              <Text variant="muted" className="text-xs">{levelLabel}</Text>
            </View>
          </View>
          {/* Pronote badge top-right */}
          <View
            className="flex-row items-center gap-1 rounded-full px-2 py-0.5"
            style={{
              backgroundColor: hasPronote ? bgColors.success[10] : bgColors.warning[10],
            }}
          >
            {hasPronote ? (
              <>
                <CheckCircle2 color={colors.success} size={12} />
                <Text className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">Pronote</Text>
              </>
            ) : (
              <>
                <Link2 color={colors.warning} size={12} />
                <Text className="text-[10px]" style={{ color: colors.warning }}>Non connecte</Text>
              </>
            )}
          </View>
        </View>

        {/* Stats grid 2x2 */}
        <View className="mt-3 flex-row gap-2 border-t border-slate-200 dark:border-slate-700 pt-3">
          <View className="flex-1 flex-row items-center gap-1.5 rounded-lg px-2 py-1.5" style={{ backgroundColor: bgColors.primary[5] }}>
            <BarChart3 color={colors.primary} size={14} />
            <Text className="text-xs font-medium">{averageGrade !== null ? averageGrade.toFixed(1) : '—'}</Text>
          </View>
          <View className="flex-1 flex-row items-center gap-1.5 rounded-lg px-2 py-1.5" style={{ backgroundColor: bgColors.warning[5] }}>
            <BookOpen color={colors.warning} size={14} />
            <Text className="text-xs font-medium">{homeworkCount} devoir{homeworkCount !== 1 ? 's' : ''}</Text>
          </View>
        </View>
        <View className="mt-2 flex-row gap-2">
          <View className="flex-1 flex-row items-center gap-1.5 rounded-lg px-2 py-1.5" style={{ backgroundColor: bgColors.success[5] }}>
            <Clock color={colors.success} size={14} />
            <Text className="text-xs font-medium">{formatStudyTime(studyTimeMinutes)}</Text>
          </View>
          <View className="flex-1 flex-row items-center gap-1.5 rounded-lg px-2 py-1.5" style={{ backgroundColor: bgColors.destructive[5] }}>
            <Flame color={colors.destructive} size={14} />
            <Text className="text-xs font-medium">{streak}j</Text>
          </View>
        </View>

        {/* Open button */}
        <TouchableOpacity
          onPress={() => onPress?.(child)}
          activeOpacity={0.7}
          className="mt-3 flex-row items-center justify-center gap-2 rounded-xl py-2.5"
          style={{ backgroundColor: bgColors.primary[10] }}
        >
          <Text className="font-semibold text-sm" style={{ color: colors.primary }}>Ouvrir</Text>
          <ArrowRight color={colors.primary} size={16} />
        </TouchableOpacity>
      </View>
    </Card>
  );
}
```

- [ ] **Step 2: Rewrite dashboard index.tsx**

Full rewrite of `apps/mobile/src/app/(parent)/(home)/index.tsx`:

```tsx
/**
 * Parent Dashboard Screen - TomAI 2026
 *
 * Horizontal carousel of child cards + add-child CTA.
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import { View, FlatList, RefreshControl, useWindowDimensions } from 'react-native';
import type { ViewToken } from 'react-native';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { useRouter } from 'expo-router';
import { Users } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { ChildCard, AddChildCard, PaginationDots } from '@/components/parent';
import {
  useParentDashboard,
  useIconColors,
  useThemeColors,
  usePronote,
  type IChild,
} from '@/hooks';
import type { ChildMetrics } from '@/hooks/useParentDashboard';
import { useUser } from '@/lib/auth';
import { bgColors } from '@/lib/styles';
import type { PronoteGrade, PronoteHomework } from '@/services/pronote/pronote-types';

// ============================================================================
// HELPERS
// ============================================================================

function computeAverageGrade(grades: PronoteGrade[]): number | null {
  if (grades.length === 0) return null;
  const validGrades = grades.filter((g): g is PronoteGrade & { value: number } => g.value !== null && g.outOf > 0);
  if (validGrades.length === 0) return null;
  const normalized = validGrades.map((g) => (g.value / g.outOf) * 20);
  return normalized.reduce((sum, v) => sum + v, 0) / normalized.length;
}

function countUpcomingHomework(homework: PronoteHomework[]): number {
  return homework.filter((h) => !h.done).length;
}

function getChildMetrics(metrics: ChildMetrics[], childId: string) {
  const m = metrics.find((metric) => metric.studentId === childId);
  return {
    studyTimeMinutes: m?.totalStudyTime ?? 0,
    streak: m?.studyDays ?? 0,
  };
}

// ============================================================================
// CAROUSEL ITEM TYPE
// ============================================================================

type CarouselItem = { type: 'child'; child: IChild } | { type: 'add' };

// ============================================================================
// COMPONENT
// ============================================================================

export default function ParentDashboard() {
  const router = useRouter();
  const iconColors = useIconColors();
  const colors = useThemeColors();
  const toast = useToast();
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = screenWidth * 0.85;

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const {
    children,
    metrics,
    isLoading,
    userName,
  } = useParentDashboard();

  const user = useUser();
  const pronote = usePronote(user?.id ?? '');

  const childPronoteData = useMemo(() => {
    const data: Record<string, { hasPronote: boolean; averageGrade: number | null; homeworkCount: number }> = {};
    for (const child of children) {
      const isMapped = pronote.resourceMappings[child.id] !== undefined;
      data[child.id] = {
        hasPronote: isMapped,
        averageGrade: isMapped ? computeAverageGrade(pronote.grades) : null,
        homeworkCount: isMapped ? countUpcomingHomework(pronote.homework) : 0,
      };
    }
    return data;
  }, [children, pronote.resourceMappings, pronote.grades, pronote.homework]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      // Pull-to-refresh is not natively supported on horizontal FlatList,
      // but we keep the state for potential future use
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const handleChildPress = (child: IChild) => {
    router.push(`/(parent)/(home)/child/${child.id}`);
  };

  const handleAddChild = () => {
    router.push('/(parent)/(home)/add-child');
  };

  // Build carousel data: children cards + add card
  const carouselData: CarouselItem[] = useMemo(() => {
    const items: CarouselItem[] = children.map((child) => ({ type: 'child' as const, child }));
    items.push({ type: 'add' as const });
    return items;
  }, [children]);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      setActiveIndex(viewableItems[0].index);
    }
  }).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  // Loading
  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900">
        <View className="px-5 py-5 gap-4">
          <Skeleton className="h-8 w-48 rounded" />
          <Skeleton className="h-4 w-32 rounded" />
          <Skeleton className="h-56 w-full rounded-2xl" />
        </View>
      </SafeAreaView>
    );
  }

  // Empty state
  if (children.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900">
        <View className="px-5 py-5">
          <Text variant="h2">Bonjour, {userName}</Text>
          <Text variant="muted" className="mt-1">0 enfant</Text>
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <View
            className="mb-4 h-20 w-20 items-center justify-center rounded-full"
            style={{ backgroundColor: bgColors.muted[50] }}
          >
            <Users color={iconColors.muted} size={40} />
          </View>
          <Text variant="large" className="mb-2 text-center">
            Commencez par ajouter votre premier enfant
          </Text>
          <Button onPress={handleAddChild} className="mt-4">
            <Text className="font-medium text-white dark:text-slate-900">Ajouter un enfant</Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <View className="px-5 py-5">
        <Text variant="h2">Bonjour, {userName}</Text>
        <Text variant="muted" className="mt-1">
          {children.length} enfant{children.length > 1 ? 's' : ''}
        </Text>
      </View>

      {/* Carousel */}
      <FlatList
        data={carouselData}
        keyExtractor={(item, index) => item.type === 'child' ? item.child.id : `add-${index}`}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={cardWidth + 12}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: (screenWidth - cardWidth) / 2 }}
        ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        renderItem={({ item }) => (
          <View style={{ width: cardWidth }}>
            {item.type === 'child' ? (
              <ChildCard
                child={item.child}
                hasPronote={childPronoteData[item.child.id]?.hasPronote ?? false}
                averageGrade={childPronoteData[item.child.id]?.averageGrade ?? null}
                homeworkCount={childPronoteData[item.child.id]?.homeworkCount ?? 0}
                studyTimeMinutes={getChildMetrics(metrics, item.child.id).studyTimeMinutes}
                streak={getChildMetrics(metrics, item.child.id).streak}
                onPress={handleChildPress}
              />
            ) : (
              <AddChildCard onPress={handleAddChild} />
            )}
          </View>
        )}
      />

      {/* Pagination dots */}
      <PaginationDots total={carouselData.length} activeIndex={activeIndex} />
    </SafeAreaView>
  );
}
```

- [ ] **Step 3: Verify typecheck + lint**

Run: `cd apps/mobile && pnpm typecheck && pnpm lint`

- [ ] **Step 4: Test on device** — open the app, verify carousel swipes, cards display, add-child card navigates

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/components/parent/ChildCard.tsx apps/mobile/src/app/\(parent\)/\(home\)/index.tsx
git commit -m "feat(mobile): rewrite parent dashboard with horizontal carousel"
```

---

## Chunk 3: Add Child Screen

### Task 7: Create add-child screen with react-hook-form

**Files:**
- Create: `apps/mobile/src/app/(parent)/(home)/add-child.tsx`

**Dependencies:** `react-hook-form` must be installed. Check if already present:

Run: `grep react-hook-form apps/mobile/package.json`

If not present: `cd apps/mobile && pnpm add react-hook-form @hookform/resolvers`

- [ ] **Step 1: Install react-hook-form if needed**

Run: `cd apps/mobile && pnpm add react-hook-form @hookform/resolvers`

- [ ] **Step 2: Write add-child.tsx**

```tsx
/**
 * Add Child Screen - TomAI 2026
 *
 * Dedicated route replacing CreateChildModal.
 * Uses react-hook-form + Zod for validation.
 */

import { useState } from 'react';
import { View, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { useRouter } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Wand2, Eye, EyeOff, ChevronDown } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { LevelPickerSheet } from '@/components/parent';
import { useParentDashboard, useIconColors, useThemeColors } from '@/hooks';
import {
  createChildFormSchema,
  type CreateChildFormData,
  formatDateInput,
  toIsoDate,
  generateUsername,
  generatePassword,
} from '@/lib/child-form-schema';
import { getLevelLabel } from '@/constants/levels';
import type { EducationLevelType } from '@/constants/levels';

export default function AddChildScreen() {
  const router = useRouter();
  const toast = useToast();
  const iconColors = useIconColors();
  const colors = useThemeColors();
  const { createChild, isCreating } = useParentDashboard();

  const [showLevelPicker, setShowLevelPicker] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isValid },
  } = useForm<CreateChildFormData>({
    resolver: zodResolver(createChildFormSchema),
    mode: 'onChange',
    defaultValues: {
      firstName: '',
      lastName: '',
      dateOfBirth: '',
      schoolLevel: '' as EducationLevelType,
      username: '',
      password: '',
    },
  });

  const firstName = watch('firstName');
  const lastName = watch('lastName');
  const selectedLevel = watch('schoolLevel');

  const handleGenerate = () => {
    if (firstName && lastName) {
      setValue('username', generateUsername(firstName, lastName), { shouldValidate: true });
    }
    setValue('password', generatePassword(), { shouldValidate: true });
    setShowPassword(true);
  };

  const onSubmit = async (data: CreateChildFormData) => {
    try {
      await createChild({
        firstName: data.firstName,
        lastName: data.lastName,
        username: data.username,
        password: data.password,
        schoolLevel: data.schoolLevel,
        dateOfBirth: toIsoDate(data.dateOfBirth),
      });
      toast.success('Enfant cree', `${data.firstName} peut maintenant utiliser Tom !`);
      router.back();
    } catch (error) {
      toast.error('Erreur', error instanceof Error ? error.message : 'Erreur lors de la creation');
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900" edges={['bottom']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={100}
      >
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-5 py-5 gap-6"
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Section: Identite */}
          <View>
            <Text className="mb-3 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Identite
            </Text>

            {/* Prenom */}
            <View className="mb-3">
              <Text className="mb-1 text-sm font-medium">Prenom</Text>
              <Controller
                control={control}
                name="firstName"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="Prenom de l'enfant"
                    autoFocus
                    autoCapitalize="words"
                    className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-base text-slate-900 dark:text-slate-100"
                    placeholderTextColor="#9ca3af"
                  />
                )}
              />
              {errors.firstName && <Text className="mt-1 text-xs text-red-500">{errors.firstName.message}</Text>}
            </View>

            {/* Nom */}
            <View className="mb-3">
              <Text className="mb-1 text-sm font-medium">Nom</Text>
              <Controller
                control={control}
                name="lastName"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="Nom de famille"
                    autoCapitalize="words"
                    className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-base text-slate-900 dark:text-slate-100"
                    placeholderTextColor="#9ca3af"
                  />
                )}
              />
              {errors.lastName && <Text className="mt-1 text-xs text-red-500">{errors.lastName.message}</Text>}
            </View>

            {/* Date de naissance */}
            <View className="mb-3">
              <Text className="mb-1 text-sm font-medium">Date de naissance</Text>
              <Controller
                control={control}
                name="dateOfBirth"
                render={({ field: { onChange, value } }) => (
                  <TextInput
                    value={value}
                    onChangeText={(raw) => onChange(formatDateInput(raw, value))}
                    placeholder="JJ/MM/AAAA"
                    keyboardType="number-pad"
                    maxLength={10}
                    className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-base text-slate-900 dark:text-slate-100"
                    placeholderTextColor="#9ca3af"
                  />
                )}
              />
              {errors.dateOfBirth && <Text className="mt-1 text-xs text-red-500">{errors.dateOfBirth.message}</Text>}
            </View>

            {/* Niveau scolaire */}
            <View className="mb-3">
              <Text className="mb-1 text-sm font-medium">Niveau scolaire</Text>
              <TouchableOpacity
                onPress={() => setShowLevelPicker(true)}
                className="flex-row items-center justify-between rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3"
              >
                <Text className={selectedLevel ? 'text-base text-slate-900 dark:text-slate-100' : 'text-base text-slate-400'}>
                  {selectedLevel ? getLevelLabel(selectedLevel) : 'Selectionner le niveau'}
                </Text>
                <ChevronDown color={iconColors.muted} size={18} />
              </TouchableOpacity>
              {errors.schoolLevel && <Text className="mt-1 text-xs text-red-500">{errors.schoolLevel.message}</Text>}
            </View>
          </View>

          {/* Section: Identifiants */}
          <View>
            <Text className="mb-1 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Identifiants de connexion
            </Text>
            <Text variant="muted" className="mb-3 text-xs">
              Ces identifiants permettront a votre enfant de se connecter a Tom.
            </Text>

            {/* Generate button */}
            <TouchableOpacity
              onPress={handleGenerate}
              className="mb-3 flex-row items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-600 py-2.5"
            >
              <Wand2 color={colors.primary} size={16} />
              <Text className="font-medium text-sm" style={{ color: colors.primary }}>
                Generer automatiquement
              </Text>
            </TouchableOpacity>

            {/* Username */}
            <View className="mb-3">
              <Text className="mb-1 text-sm font-medium">Nom d'utilisateur</Text>
              <Controller
                control={control}
                name="username"
                render={({ field: { onChange, onBlur, value } }) => (
                  <TextInput
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    placeholder="Nom d'utilisateur"
                    autoCapitalize="none"
                    autoCorrect={false}
                    className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-base text-slate-900 dark:text-slate-100"
                    placeholderTextColor="#9ca3af"
                  />
                )}
              />
              {errors.username && <Text className="mt-1 text-xs text-red-500">{errors.username.message}</Text>}
            </View>

            {/* Password */}
            <View className="mb-1">
              <Text className="mb-1 text-sm font-medium">Mot de passe</Text>
              <View className="flex-row items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                <Controller
                  control={control}
                  name="password"
                  render={({ field: { onChange, onBlur, value } }) => (
                    <TextInput
                      value={value}
                      onChangeText={onChange}
                      onBlur={onBlur}
                      placeholder="Mot de passe"
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      autoCorrect={false}
                      className="flex-1 px-4 py-3 text-base text-slate-900 dark:text-slate-100"
                      placeholderTextColor="#9ca3af"
                    />
                  )}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} className="px-3">
                  {showPassword ? (
                    <EyeOff color={iconColors.muted} size={20} />
                  ) : (
                    <Eye color={iconColors.muted} size={20} />
                  )}
                </TouchableOpacity>
              </View>
              {errors.password && <Text className="mt-1 text-xs text-red-500">{errors.password.message}</Text>}
              <Text variant="muted" className="mt-1 text-xs">
                Min. 8 caracteres, 1 majuscule, 1 minuscule, 1 chiffre
              </Text>
            </View>
          </View>
        </ScrollView>

        {/* Sticky submit button */}
        <View className="border-t border-slate-200 dark:border-slate-700 px-5 py-4">
          <Button
            onPress={handleSubmit(onSubmit)}
            disabled={!isValid || isCreating}
            style={{ opacity: !isValid || isCreating ? 0.5 : 1 }}
          >
            <Text className="font-semibold text-white dark:text-slate-900">
              {isCreating ? 'Creation en cours...' : 'Creer le compte'}
            </Text>
          </Button>
        </View>
      </KeyboardAvoidingView>

      <LevelPickerSheet
        visible={showLevelPicker}
        onClose={() => setShowLevelPicker(false)}
        onSelect={(level) => setValue('schoolLevel', level, { shouldValidate: true })}
        selectedLevel={selectedLevel}
      />
    </SafeAreaView>
  );
}
```

- [ ] **Step 3: Verify typecheck + lint**

Run: `cd apps/mobile && pnpm typecheck && pnpm lint`

- [ ] **Step 4: Test on device** — navigate to add-child, fill form, generate credentials, submit, verify toast + navigation back

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/app/\(parent\)/\(home\)/add-child.tsx
git commit -m "feat(mobile): add dedicated add-child screen with react-hook-form"
```

---

## Chunk 4: Child Detail Redesign + Cleanup

### Task 8: Rewrite child detail screen

**Files:**
- Modify: `apps/mobile/src/app/(parent)/(home)/child/[id]/index.tsx`

The current file is 343 lines. The redesign adds a hero header with gradient, keeps the existing sections but reorganizes layout. The code below is a full rewrite.

- [ ] **Step 1: Rewrite child detail**

Rewrite `apps/mobile/src/app/(parent)/(home)/child/[id]/index.tsx` with:
- Hero header: gradient background + large avatar + name + badges
- Stats band: 3 horizontal cards (Moyenne, Devoirs, Temps)
- Same sections as current (grades, homework, activity) but with consistent styling
- "Lancer Tom" sticky at bottom
- "Supprimer ce profil" subtle link at bottom of scroll
- Keep using existing `DeleteChildModal` via import from `@/components/parent`
- Keep using `useParentDashboard`, `usePronote`, `launchChildSession` etc.
- Keep all existing helpers (`computeAverage`, `formatStudyTime`, `formatDate`)
- Add `LinearGradient` from `expo-linear-gradient` for hero header background
- Add week activity bar: 7 dots for Mon-Sun, colored if active

Key changes from current:
- Remove manual back button header (use Stack header from layout)
- Add gradient hero section
- Add weekly activity bar in Activity section
- "Supprimer" becomes a subtle text link instead of icon+text

The file should remain under 400 lines. If it exceeds, extract the hero header into `ChildDetailHero.tsx`.

- [ ] **Step 2: Verify typecheck + lint**

Run: `cd apps/mobile && pnpm typecheck && pnpm lint`

- [ ] **Step 3: Test on device** — tap a child card, verify hero header, stats, grades, homework, activity, launch Tom, delete

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/app/\(parent\)/\(home\)/child/\[id\]/index.tsx
git commit -m "feat(mobile): redesign child detail with hero header + activity bar"
```

---

### Task 9: Delete old modal files

**Files:**
- Delete: `apps/mobile/src/components/parent/CreateChildModal.tsx`
- Delete: `apps/mobile/src/components/parent/LevelPickerModal.tsx`

- [ ] **Step 1: Delete old files**

```bash
rm apps/mobile/src/components/parent/CreateChildModal.tsx
rm apps/mobile/src/components/parent/LevelPickerModal.tsx
```

- [ ] **Step 2: Verify no remaining imports**

Run: `grep -r "CreateChildModal\|LevelPickerModal" apps/mobile/src/ --include="*.ts" --include="*.tsx"`
Expected: No matches (barrel export was already updated in Task 5)

- [ ] **Step 3: Verify typecheck + lint + tests**

Run: `cd apps/mobile && pnpm typecheck && pnpm lint && pnpm test`

- [ ] **Step 4: Commit**

```bash
git add -u apps/mobile/src/components/parent/CreateChildModal.tsx apps/mobile/src/components/parent/LevelPickerModal.tsx
git commit -m "chore(mobile): delete CreateChildModal + LevelPickerModal (replaced by screen)"
```

---

### Task 10: Final validation

- [ ] **Step 1: Full validation pipeline**

```bash
cd apps/mobile && pnpm typecheck && pnpm lint && pnpm test
```

- [ ] **Step 2: Test complete flow on device**

1. Open dashboard → see carousel (or empty state if no children)
2. Swipe between child cards + add card
3. Tap add card → navigate to add-child screen
4. Fill form, tap "Generer automatiquement"
5. Submit → toast + back to dashboard
6. Tap child card "Ouvrir" → detail screen
7. Verify hero header, stats, grades, homework
8. Tap "Lancer Tom" → student interface
9. Navigate back, tap "Supprimer ce profil" → delete modal

- [ ] **Step 3: Final commit if any fixes needed**

```bash
git add -A apps/mobile/src/
git commit -m "fix(mobile): final adjustments for parent dashboard redesign"
```
