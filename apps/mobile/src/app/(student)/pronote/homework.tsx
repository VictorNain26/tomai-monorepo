/**
 * Student Homework Screen
 *
 * Displays homework list from Pronote.
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
  CheckCircle,
  Circle,
  Calendar,
} from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Skeleton } from '@/components/ui/skeleton';
import { useStudentHomework } from '@/hooks';

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

// ============================================================================
// COMPONENT
// ============================================================================

export default function HomeworkScreen() {
  const router = useRouter();
  const [weekOffset, setWeekOffset] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const { data: homework, isLoading, refetch } = useStudentHomework(weekOffset);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

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

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
        <View className="flex-row items-center gap-3">
          <TouchableOpacity onPress={() => router.back()} className="p-1">
            <ArrowLeft color="hsl(222.2, 47.4%, 11.2%)" size={24} />
          </TouchableOpacity>
          <Text variant="h3">Devoirs</Text>
        </View>

        {/* Week navigation */}
        <View className="flex-row items-center gap-2">
          <TouchableOpacity
            onPress={() => setWeekOffset((w) => w - 1)}
            className="rounded-lg bg-muted p-2"
          >
            <ChevronLeft color="hsl(222.2, 47.4%, 11.2%)" size={20} />
          </TouchableOpacity>
          <Text className="min-w-[80px] text-center text-sm">
            {weekOffset === 0
              ? 'Cette semaine'
              : weekOffset === 1
                ? 'Semaine prochaine'
                : weekOffset === -1
                  ? 'Semaine passée'
                  : `Semaine ${weekOffset > 0 ? '+' : ''}${weekOffset}`}
          </Text>
          <TouchableOpacity
            onPress={() => setWeekOffset((w) => w + 1)}
            className="rounded-lg bg-muted p-2"
          >
            <ChevronRight color="hsl(222.2, 47.4%, 11.2%)" size={20} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4 py-4"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {isLoading ? (
          // Loading skeleton
          <View className="gap-4">
            {[1, 2, 3].map((i) => (
              <View key={i}>
                <Skeleton className="mb-2 h-4 w-24 rounded" />
                <Skeleton className="h-20 w-full rounded-xl" />
              </View>
            ))}
          </View>
        ) : sortedDates.length === 0 ? (
          // Empty state
          <View className="items-center py-12">
            <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-muted">
              <CheckCircle color="hsl(142, 76%, 36%)" size={32} />
            </View>
            <Text className="mb-1 font-semibold">Aucun devoir</Text>
            <Text variant="muted" className="text-center">
              Pas de devoirs pour cette semaine
            </Text>
          </View>
        ) : (
          // Homework list grouped by date
          <View className="gap-6">
            {sortedDates.map((dateKey) => (
              <View key={dateKey}>
                {/* Date header */}
                <View className="mb-2 flex-row items-center gap-2">
                  <Calendar color="hsl(215.4, 16.3%, 46.9%)" size={16} />
                  <Text className="font-semibold">{formatDate(dateKey)}</Text>
                </View>

                {/* Homework items */}
                <View className="gap-2">
                  {groupedHomework[dateKey]?.map((hw) => {
                    const overdue = isOverdue(hw.dueDate, hw.done);

                    return (
                      <View
                        key={hw.id}
                        className={`rounded-xl border bg-card p-4 ${
                          overdue
                            ? 'border-destructive/30 bg-destructive/5'
                            : hw.done
                              ? 'border-green-200 bg-green-50'
                              : 'border-border'
                        }`}
                      >
                        <View className="flex-row items-start gap-3">
                          {hw.done ? (
                            <CheckCircle color="hsl(142, 76%, 36%)" size={20} />
                          ) : (
                            <Circle
                              color={
                                overdue
                                  ? 'hsl(0, 84.2%, 60.2%)'
                                  : 'hsl(215.4, 16.3%, 46.9%)'
                              }
                              size={20}
                            />
                          )}
                          <View className="flex-1">
                            <Text
                              className={`font-medium ${hw.done ? 'text-green-700' : ''}`}
                            >
                              {hw.subject}
                            </Text>
                            <Text
                              variant="muted"
                              className={`mt-1 text-sm ${hw.done ? 'line-through' : ''}`}
                            >
                              {hw.description}
                            </Text>
                            {overdue && (
                              <Text className="mt-1 text-xs text-destructive">
                                En retard
                              </Text>
                            )}
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
