/**
 * Parent Dashboard Screen - TomAI 2026
 *
 * Enriched child cards with Pronote data + activity stats.
 */

import { useState, useCallback, useMemo } from 'react';
import { View, ScrollView, RefreshControl } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { useRouter } from 'expo-router';
import { Plus, Users } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/toast';
import { ChildCard, CreateChildModal } from '@/components/parent';
import {
  useParentDashboard,
  useIconColors,
  useThemeColors,
  usePronote,
  type IChild,
  type ICreateChildData,
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
// COMPONENT
// ============================================================================

export default function ParentDashboard() {
  const router = useRouter();
  const iconColors = useIconColors();
  const colors = useThemeColors();
  const toast = useToast();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const {
    children,
    metrics,
    levels,
    isLoading,
    isCreating,
    userName,
    createChild,
  } = useParentDashboard();

  const user = useUser();
  const pronote = usePronote(user?.id ?? '');

  // Compute per-child Pronote data
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

  const queryClient = useQueryClient();
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      await queryClient.refetchQueries({ queryKey: ['parent'] });
    } finally {
      setIsRefreshing(false);
    }
  }, [queryClient]);

  const handleChildPress = (child: IChild) => {
    router.push(`/(parent)/(home)/child/${child.id}`);
  };

  const handleCreateChild = useCallback(
    async (data: ICreateChildData) => {
      try {
        await createChild(data);
        setShowCreateModal(false);
        toast.success('Enfant cree', `${data.firstName} peut maintenant utiliser Tom !`);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Erreur lors de la creation';
        toast.error('Erreur', message);
      }
    },
    [createChild, toast]
  );

  if (isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900">
        <ScrollView className="flex-1" contentContainerClassName="px-4 py-5 gap-4">
          <Skeleton className="h-8 w-48 rounded" />
          <Skeleton className="h-4 w-64 rounded" />
          <Skeleton className="h-36 w-full rounded-xl" />
          <Skeleton className="h-36 w-full rounded-xl" />
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 py-5 gap-5"
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between">
          <View>
            <Text variant="h2">Bonjour, {userName}</Text>
            <Text variant="muted" className="mt-1">
              Suivez la progression de vos enfants
            </Text>
          </View>
          {children.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              onPress={() => setShowCreateModal(true)}
              accessibilityLabel="Ajouter un enfant"
            >
              <Plus color={colors.primary} size={22} />
            </Button>
          )}
        </View>

        {/* Children Cards */}
        {children.length > 0 ? (
          <View className="gap-3">
            {children.map((child) => {
              const pd = childPronoteData[child.id];
              const cm = getChildMetrics(metrics, child.id);
              return (
                <ChildCard
                  key={child.id}
                  child={child}
                  hasPronote={pd?.hasPronote ?? false}
                  averageGrade={pd?.averageGrade ?? null}
                  homeworkCount={pd?.homeworkCount ?? 0}
                  studyTimeMinutes={cm.studyTimeMinutes}
                  streak={cm.streak}
                  onPress={handleChildPress}
                />
              );
            })}
          </View>
        ) : (
          <Card>
            <View className="items-center p-6">
              <View
                className="mb-4 h-16 w-16 items-center justify-center rounded-full"
                style={{ backgroundColor: bgColors.muted[50] }}
              >
                <Users color={iconColors.muted} size={32} />
              </View>
              <Text variant="large" className="mb-1">
                Aucun enfant
              </Text>
              <Text variant="muted" className="mb-4 text-center">
                Ajoutez votre premier enfant pour commencer
              </Text>
              <Button onPress={() => setShowCreateModal(true)}>
                <Plus color={colors.primaryForeground} size={18} />
                <Text className="ml-2 text-white dark:text-slate-900 font-medium">
                  Ajouter un enfant
                </Text>
              </Button>
            </View>
          </Card>
        )}
      </ScrollView>

      <CreateChildModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateChild}
        isSubmitting={isCreating}
        levels={levels}
      />
    </SafeAreaView>
  );
}
