/**
 * Parent Dashboard Screen - TomAI 2026
 *
 * Horizontal carousel of child cards + add-child CTA.
 */

import { useState, useCallback, useMemo } from 'react';
import { View, FlatList, useWindowDimensions } from 'react-native';
import type { ViewToken } from 'react-native';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { useRouter } from 'expo-router';
import { Users } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChildCard, AddChildCard, PaginationDots } from '@/components/parent';
import {
  useParentDashboard,
  useIconColors,
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
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = screenWidth * 0.85;

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

  const handleChildPress = useCallback((child: IChild) => {
    router.push(`/(parent)/(home)/child/${child.id}`);
  }, [router]);

  const handleAddChild = useCallback(() => {
    router.push('/(parent)/(home)/add-child');
  }, [router]);

  // Build carousel data: children cards + add card
  const carouselData: CarouselItem[] = useMemo(() => {
    const items: CarouselItem[] = children.map((child) => ({ type: 'child' as const, child }));
    items.push({ type: 'add' as const });
    return items;
  }, [children]);

  const onViewableItemsChanged = useCallback(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      setActiveIndex(viewableItems[0].index);
    }
  }, []);

  const viewabilityConfig = useMemo(() => ({ viewAreaCoveragePercentThreshold: 50 }), []);

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
