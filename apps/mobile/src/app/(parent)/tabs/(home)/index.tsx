/**
 * Parent Dashboard Screen - TomAI 2026
 *
 * Vertical scrollable list of compact child cards.
 * Parent sees all children at a glance. Tap card → detail.
 */

import { useCallback, useMemo } from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { useRouter } from 'expo-router';
import { Users } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChildSummaryCard } from '@/components/parent/ChildSummaryCard';
import {
  useParentDashboard,
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
  const colors = useThemeColors();

  const { children, metrics, isLoading, userName } = useParentDashboard();
  const user = useUser();
  const pronote = usePronote(user?.id ?? '');

  const childPronoteData = useMemo(() => {
    const data: Record<
      string,
      { hasPronote: boolean; averageGrade: number | null; homeworkCount: number }
    > = {};
    for (const child of children) {
      data[child.id] = {
        hasPronote: child.hasPronote,
        averageGrade: child.hasPronote ? computeAverageGrade(pronote.grades) : null,
        homeworkCount: child.hasPronote ? countUpcomingHomework(pronote.homework) : 0,
      };
    }
    return data;
  }, [children, pronote.grades, pronote.homework]);

  const handleViewDetail = useCallback(
    (child: IChild) => {
      router.push(`/(parent)/tabs/(home)/child/${child.id}`);
    },
    [router]
  );

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="px-5 py-5 gap-4">
          <Skeleton className="h-8 w-48 rounded" />
          <Skeleton className="h-4 w-32 rounded" />
          <Skeleton className="h-40 w-full rounded-2xl" />
          <Skeleton className="h-40 w-full rounded-2xl" />
        </View>
      </SafeAreaView>
    );
  }

  if (children.length === 0) {
    return (
      <SafeAreaView className="flex-1 bg-background">
        <View className="px-5 py-5">
          <Text variant="h2">Bonjour, {userName}</Text>
          <Text variant="muted" className="mt-1">0 enfant</Text>
        </View>
        <View className="flex-1 items-center justify-center px-8">
          <View
            className="mb-4 h-20 w-20 items-center justify-center rounded-full"
            style={{ backgroundColor: bgColors.muted[50] }}
          >
            <Users color={colors.foreground} size={40} style={{ opacity: 0.4 }} />
          </View>
          <Text variant="large" className="mb-2 text-center">
            Ajoutez un enfant pour commencer
          </Text>
          <Button onPress={() => router.push('/(parent)/add-child')} className="mt-4">
            <Text className="font-medium text-primary-foreground">
              Ajouter un enfant
            </Text>
          </Button>
          <Button
            variant="outline"
            onPress={() => router.push('/(parent)/pronote-connect')}
            className="mt-3"
            accessibilityLabel="Connecter Pronote"
          >
            <Text className="font-medium">
              Connecter Pronote
            </Text>
          </Button>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView testID="parent-dashboard" className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 pt-4 pb-2">
        <View>
          <Text variant="h2">Bonjour, {userName}</Text>
          <Text variant="muted" className="mt-0.5">
            {children.length} enfant{children.length > 1 ? 's' : ''}
          </Text>
        </View>
        {/* TODO(Task 14): route to manage screen once pronote-manage is built */}
        <Button
          variant="ghost"
          size="sm"
          onPress={() => router.push('/(parent)/pronote-connect')}
          accessibilityLabel="Gérer Pronote"
        >
          <Text className="text-sm">Gérer Pronote</Text>
        </Button>
      </View>

      {/* Child cards list */}
      <ScrollView
        className="flex-1 px-4"
        contentContainerClassName="gap-3 pb-6 pt-2"
        showsVerticalScrollIndicator={false}
      >
        {children.map((child) => {
          const pd = childPronoteData[child.id];
          const cm = getChildMetrics(metrics, child.id);
          return (
            <ChildSummaryCard
              key={child.id}
              child={child}
              hasPronote={pd?.hasPronote ?? false}
              averageGrade={pd?.averageGrade ?? null}
              homeworkCount={pd?.homeworkCount ?? 0}
              studyTimeMinutes={cm.studyTimeMinutes}
              streak={cm.streak}
              onPress={handleViewDetail}
            />
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}
