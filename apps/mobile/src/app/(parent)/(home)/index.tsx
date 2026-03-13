/**
 * Parent Dashboard Screen - TomAI 2026
 *
 * Instagram-style swipeable tabs: one full page per child.
 * Header with "+" button always visible. Tab bar with child names.
 */

import { useState, useCallback, useMemo, useRef } from 'react';
import { View, FlatList, useWindowDimensions } from 'react-native';
import type { ViewToken } from 'react-native';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { useRouter } from 'expo-router';
import { Plus, Users } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChildTabBar } from '@/components/parent';
import { ChildPage } from '@/components/parent/ChildPage';
import {
  useParentDashboard,
  useIconColors,
  useThemeColors,
  usePronote,
  type IChild,
} from '@/hooks';
import type { ChildMetrics } from '@/hooks/useParentDashboard';
import { useUser } from '@/lib/auth';
import { computeAverageGrade } from '@/lib/formatters';
import { bgColors } from '@/lib/styles';
import type { PronoteHomework } from '@/services/pronote/pronote-types';

// ============================================================================
// HELPERS
// ============================================================================

function countUpcomingHomework(homework: PronoteHomework[]): number {
  return homework.filter((h) => !h.done).length;
}

function getChildMetrics(metrics: ChildMetrics[], childId: string) {
  const m = metrics.find((metric) => metric.studentId === childId);
  return { studyTimeMinutes: m?.totalStudyTime ?? 0, streak: m?.studyDays ?? 0 };
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function ParentDashboard() {
  const router = useRouter();
  const iconColors = useIconColors();
  const colors = useThemeColors();
  const { width: screenWidth } = useWindowDimensions();

  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList<IChild>>(null);

  const { children, metrics, isLoading, userName } = useParentDashboard();
  const user = useUser();
  const pronote = usePronote(user?.id ?? '');

  const childPronoteData = useMemo(() => {
    const data: Record<
      string,
      { hasPronote: boolean; averageGrade: number | null; homeworkCount: number }
    > = {};
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

  const handleAddChild = useCallback(() => {
    router.push('/(parent)/(home)/add-child');
  }, [router]);

  const handleViewDetail = useCallback(
    (child: IChild) => {
      router.push(`/(parent)/(home)/child/${child.id}`);
    },
    [router]
  );

  const handleTabPress = useCallback((index: number) => {
    flatListRef.current?.scrollToIndex({ index, animated: true });
    setActiveIndex(index);
  }, []);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setActiveIndex(viewableItems[0].index);
      }
    },
    []
  );

  const viewabilityConfig = useMemo(
    () => ({ viewAreaCoveragePercentThreshold: 50 }),
    []
  );

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
            <Text className="font-medium text-white dark:text-slate-900">
              Ajouter un enfant
            </Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900">
      {/* Header with + button */}
      <View className="flex-row items-center justify-between px-5 pt-4 pb-2">
        <View>
          <Text variant="h2">Bonjour, {userName}</Text>
          <Text variant="muted" className="mt-0.5">
            {children.length} enfant{children.length > 1 ? 's' : ''}
          </Text>
        </View>
        <Button
          variant="ghost"
          size="icon"
          onPress={handleAddChild}
          accessibilityLabel="Ajouter un enfant"
        >
          <Plus color={colors.primary} size={22} />
        </Button>
      </View>

      {/* Tab bar with child names */}
      <ChildTabBar
        items={children}
        activeIndex={activeIndex}
        onTabPress={handleTabPress}
      />

      {/* Swipeable full-page content */}
      <FlatList
        ref={flatListRef}
        data={children}
        keyExtractor={(child) => child.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        renderItem={({ item: child }) => {
          const pd = childPronoteData[child.id];
          const cm = getChildMetrics(metrics, child.id);
          return (
            <ChildPage
              child={child}
              hasPronote={pd?.hasPronote ?? false}
              isConnected={pronote.isConnected}
              averageGrade={pd?.averageGrade ?? null}
              homeworkCount={pd?.homeworkCount ?? 0}
              studyTimeMinutes={cm.studyTimeMinutes}
              streak={cm.streak}
              width={screenWidth}
              onViewDetail={handleViewDetail}
            />
          );
        }}
      />
    </SafeAreaView>
  );
}
