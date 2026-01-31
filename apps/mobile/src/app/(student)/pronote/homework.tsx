/**
 * Student Homework Screen - TomAI 2026
 *
 * Displays homework list from Pronote with actions to get help from Tom.
 */

import { useState, useCallback } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Circle,
  Calendar,
  MessageCircle,
  AlertCircle,
} from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useStudentHomework, useIconColors } from '@/hooks';
import { bgColors, borderColors, colors, shadows } from '@/lib/styles';

// ============================================================================
// HELPERS
// ============================================================================

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

function isOverdue(dateStr: string, done: boolean): boolean {
  if (done) return false;
  const dueDate = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return dueDate < today;
}

function getDaysUntil(dateStr: string): number {
  const dueDate = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);
  return Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function HomeworkScreen() {
  const router = useRouter();
  const iconColors = useIconColors();
  const [weekOffset, setWeekOffset] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const { data: homework, isLoading, refetch } = useStudentHomework(weekOffset);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // Navigate to Tom chat with homework context
  const handleAskTom = (subject: string, description: string, homeworkId: string) => {
    router.push({
      pathname: '/(student)/chat',
      params: {
        subject,
        context: `homework:${homeworkId}`,
        prompt: `Aide-moi avec ce devoir de ${subject} : ${description}`,
      },
    });
  };

  // Group homework by due date
  const groupedHomework = (homework ?? []).reduce(
    (acc, hw) => {
      const dateKey = hw.dueDate;
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(hw);
      return acc;
    },
    {} as Record<string, typeof homework>
  );

  const sortedDates = Object.keys(groupedHomework).sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  );

  // Stats
  const totalCount = homework?.length ?? 0;
  const doneCount = homework?.filter((h) => h.done).length ?? 0;
  const overdueCount = homework?.filter((h) => isOverdue(h.dueDate, h.done)).length ?? 0;

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
        <View className="flex-row items-center gap-3">
          <TouchableOpacity
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-full bg-muted"
          >
            <ArrowLeft color={iconColors.foreground} size={20} />
          </TouchableOpacity>
          <Text variant="h3">Devoirs</Text>
        </View>

        {/* Week navigation */}
        <View className="flex-row items-center gap-2">
          <TouchableOpacity
            onPress={() => setWeekOffset((w) => w - 1)}
            className="h-9 w-9 items-center justify-center rounded-lg bg-muted"
          >
            <ChevronLeft color={iconColors.foreground} size={18} />
          </TouchableOpacity>
          <Text variant="small" className="min-w-[90px] text-center">
            {weekOffset === 0
              ? 'Cette semaine'
              : weekOffset === 1
                ? 'Semaine +1'
                : weekOffset === -1
                  ? 'Semaine -1'
                  : `Semaine ${weekOffset > 0 ? '+' : ''}${weekOffset}`}
          </Text>
          <TouchableOpacity
            onPress={() => setWeekOffset((w) => w + 1)}
            className="h-9 w-9 items-center justify-center rounded-lg bg-muted"
          >
            <ChevronRight color={iconColors.foreground} size={18} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4 py-4"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary.DEFAULT}
          />
        }
      >
        {/* Stats summary */}
        {!isLoading && totalCount > 0 && (
          <View className="mb-4 flex-row gap-2">
            <View
              className="flex-1 rounded-xl p-3"
              style={{ backgroundColor: bgColors.primary[10] }}
            >
              <Text variant="tiny" className="text-muted-foreground">
                Total
              </Text>
              <Text variant="large">{totalCount}</Text>
            </View>
            <View
              className="flex-1 rounded-xl p-3"
              style={{ backgroundColor: bgColors.success[10] }}
            >
              <Text variant="tiny" className="text-muted-foreground">
                Faits
              </Text>
              <Text variant="large" className="text-success">
                {doneCount}
              </Text>
            </View>
            {overdueCount > 0 && (
              <View
                className="flex-1 rounded-xl p-3"
                style={{ backgroundColor: bgColors.destructive[10] }}
              >
                <Text variant="tiny" className="text-muted-foreground">
                  En retard
                </Text>
                <Text variant="large" className="text-destructive">
                  {overdueCount}
                </Text>
              </View>
            )}
          </View>
        )}

        {isLoading ? (
          // Loading skeleton
          <View className="gap-4">
            {[1, 2, 3].map((i) => (
              <View key={i}>
                <Skeleton className="mb-2 h-4 w-24 rounded" />
                <Skeleton className="h-24 w-full rounded-xl" />
              </View>
            ))}
          </View>
        ) : sortedDates.length === 0 ? (
          // Empty state
          <View className="items-center py-12">
            <View
              className="mb-4 h-16 w-16 items-center justify-center rounded-full"
              style={{ backgroundColor: bgColors.success[10] }}
            >
              <CheckCircle2 color={colors.success.DEFAULT} size={32} />
            </View>
            <Text variant="large" className="mb-1">
              Aucun devoir
            </Text>
            <Text variant="muted" className="text-center">
              Pas de devoirs pour cette semaine
            </Text>
          </View>
        ) : (
          // Homework list grouped by date
          <View className="gap-6">
            {sortedDates.map((dateKey) => {
              const daysUntil = getDaysUntil(dateKey);
              const isUrgent = daysUntil <= 1 && daysUntil >= 0;

              return (
                <View key={dateKey}>
                  {/* Date header */}
                  <View className="mb-2 flex-row items-center gap-2">
                    <Calendar color={iconColors.muted} size={16} />
                    <Text className="font-semibold">{formatDate(dateKey)}</Text>
                    {isUrgent && (
                      <View
                        className="rounded-full px-2 py-0.5"
                        style={{ backgroundColor: bgColors.warning[10] }}
                      >
                        <Text variant="tiny" style={{ color: colors.warning.DEFAULT }}>
                          {daysUntil === 0 ? "Aujourd'hui" : 'Demain'}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Homework items */}
                  <View className="gap-2">
                    {groupedHomework[dateKey]?.map((hw) => {
                      const overdue = isOverdue(hw.dueDate, hw.done);

                      return (
                        <Card
                          key={hw.id}
                          style={[
                            shadows.xs,
                            overdue
                              ? {
                                  borderWidth: 1,
                                  borderColor: borderColors.destructive[30],
                                  backgroundColor: bgColors.destructive[5],
                                }
                              : hw.done
                                ? {
                                    borderWidth: 1,
                                    borderColor: borderColors.success[30],
                                    backgroundColor: bgColors.success[5],
                                  }
                                : undefined,
                          ]}
                        >
                          <View className="p-4">
                            <View className="flex-row items-start gap-3">
                              {hw.done ? (
                                <CheckCircle2 color={colors.success.DEFAULT} size={20} />
                              ) : overdue ? (
                                <AlertCircle color={colors.destructive.DEFAULT} size={20} />
                              ) : (
                                <Circle color={iconColors.muted} size={20} />
                              )}
                              <View className="flex-1">
                                <Text
                                  className={`font-medium ${hw.done ? 'text-success' : ''}`}
                                >
                                  {hw.subject}
                                </Text>
                                <Text
                                  variant="muted"
                                  className={`mt-1 ${hw.done ? 'line-through' : ''}`}
                                  numberOfLines={2}
                                >
                                  {hw.description}
                                </Text>
                                {overdue && (
                                  <Text variant="tiny" className="mt-1 text-destructive">
                                    En retard
                                  </Text>
                                )}
                              </View>
                            </View>

                            {/* Action button - only for incomplete homework */}
                            {!hw.done && (
                              <TouchableOpacity
                                onPress={() => handleAskTom(hw.subject, hw.description, hw.id)}
                                className="mt-3 flex-row items-center justify-center gap-2 rounded-lg py-2"
                                style={{ backgroundColor: bgColors.primary[10] }}
                              >
                                <MessageCircle color={colors.primary.DEFAULT} size={16} />
                                <Text variant="small" className="text-primary font-medium">
                                  Demander de l'aide à Tom
                                </Text>
                              </TouchableOpacity>
                            )}
                          </View>
                        </Card>
                      );
                    })}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
