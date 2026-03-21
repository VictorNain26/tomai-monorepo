/**
 * Student Timetable Screen
 *
 * Displays weekly timetable from Pronote.
 */

import { useState, useCallback, useMemo } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  User,
  AlertCircle,
} from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Skeleton } from '@/components/ui/skeleton';
import { usePronote, useThemeColors } from '@/hooks';
import { useUser } from '@/lib/auth';
import { bgColors, borderColors } from '@/lib/styles';

// ============================================================================
// HELPERS
// ============================================================================

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getDayName(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-FR', { weekday: 'long' });
}

function getDateStr(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  });
}

function groupByDay(
  entries: Array<{
    id: string;
    subject?: string;
    teacherNames: string[];
    classrooms: string[];
    startDate: string;
    endDate: string;
    canceled: boolean;
    status?: string;
  }>
) {
  return entries.reduce(
    (acc, entry) => {
      const dayKey = new Date(entry.startDate).toDateString();
      if (!acc[dayKey]) {
        acc[dayKey] = {
          dayName: getDayName(entry.startDate),
          date: getDateStr(entry.startDate),
          entries: [],
        };
      }
      acc[dayKey].entries.push(entry);
      return acc;
    },
    {} as Record<
      string,
      { dayName: string; date: string; entries: typeof entries }
    >
  );
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function TimetableScreen() {
  const router = useRouter();
  const [weekOffset, setWeekOffset] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const user = useUser();
  const pronote = usePronote(user?.id ?? '');
  const colors = useThemeColors();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await pronote.fetchTimetable();
    setRefreshing(false);
  }, [pronote]);

  // Group by day and sort
  const timetable = pronote.timetable;
  const dayData = useMemo(() => {
    if (timetable.length === 0) return [];

    const grouped = groupByDay(timetable);
    return Object.entries(grouped)
      .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
      .map(([, data]) => ({
        ...data,
        entries: data.entries.sort(
          (a, b) =>
            new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
        ),
      }));
  }, [timetable]);

  return (
    <SafeAreaView className="flex-1 bg-stone-50 dark:bg-stone-900">
      {/* Header */}
      <View className="flex-row items-center justify-between border-b border-stone-200 dark:border-stone-700 px-4 py-3">
        <View className="flex-row items-center gap-3">
          <TouchableOpacity onPress={() => router.back()} className="h-10 w-10 items-center justify-center rounded-full">
            <ArrowLeft color={colors.foreground} size={24} />
          </TouchableOpacity>
          <Text variant="h3">Emploi du temps</Text>
        </View>

        {/* Week navigation */}
        <View className="flex-row items-center gap-2">
          <TouchableOpacity
            onPress={() => setWeekOffset((w) => w - 1)}
            className="rounded-lg bg-stone-100 dark:bg-stone-800 p-2"
          >
            <ChevronLeft color={colors.foreground} size={20} />
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
            className="rounded-lg bg-stone-100 dark:bg-stone-800 p-2"
          >
            <ChevronRight color={colors.foreground} size={20} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {timetable.length === 0 && !pronote.isConnected ? (
          // Loading skeleton
          <View className="gap-4 p-4">
            {[1, 2, 3].map((i) => (
              <View key={i}>
                <Skeleton className="mb-2 h-5 w-32 rounded" />
                <Skeleton className="mb-2 h-20 w-full rounded-xl" />
                <Skeleton className="h-20 w-full rounded-xl" />
              </View>
            ))}
          </View>
        ) : dayData.length === 0 ? (
          // Empty state
          <View className="items-center py-12">
            <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-stone-100 dark:bg-stone-800">
              <Clock color={colors.muted} size={32} />
            </View>
            <Text className="mb-1 font-semibold">Aucun cours</Text>
            <Text variant="muted" className="text-center">
              Pas de cours cette semaine
            </Text>
          </View>
        ) : (
          // Timetable by day
          <View className="gap-6 p-4">
            {dayData.map((day) => (
              <View key={day.dayName + day.date}>
                {/* Day header */}
                <View className="mb-3 flex-row items-center gap-2">
                  <Text className="font-semibold capitalize">{day.dayName}</Text>
                  <Text variant="muted" className="text-sm">
                    {day.date}
                  </Text>
                </View>

                {/* Entries */}
                <View className="gap-2">
                  {day.entries.map((entry) => {
                    const isCancelled = entry.canceled;
                    const hasStatus = entry.status && entry.status !== '';
                    const teacher = entry.teacherNames.join(', ');
                    const room = entry.classrooms.join(', ');

                    return (
                      <View
                        key={entry.id}
                        className="rounded-xl bg-white dark:bg-stone-800 p-4"
                        style={
                          isCancelled
                            ? { backgroundColor: bgColors.destructive[5], borderColor: borderColors.destructive[20] }
                            : hasStatus
                              ? { backgroundColor: bgColors.warning[5], borderColor: borderColors.warning[20] }
                              : undefined
                        }
                      >
                        <View className="flex-row items-start gap-3">
                          {/* Time column */}
                          <View className="items-center">
                            <Text className="text-sm font-medium">
                              {formatTime(entry.startDate)}
                            </Text>
                            <View className="my-1 h-4 w-px bg-stone-200 dark:bg-stone-700" />
                            <Text variant="muted" className="text-xs">
                              {formatTime(entry.endDate)}
                            </Text>
                          </View>

                          {/* Content */}
                          <View className="flex-1">
                            <View className="flex-row items-center gap-2">
                              <Text
                                className="font-semibold"
                                style={isCancelled ? { textDecorationLine: 'line-through', color: colors.destructive } : undefined}
                              >
                                {entry.subject ?? 'Cours'}
                              </Text>
                              {isCancelled && (
                                <View className="rounded-full px-2 py-0.5" style={{ backgroundColor: colors.destructive }}>
                                  <Text className="text-xs font-medium text-white">
                                    Annulé
                                  </Text>
                                </View>
                              )}
                              {hasStatus && !isCancelled && (
                                <AlertCircle
                                  color={colors.warning}
                                  size={16}
                                />
                              )}
                            </View>

                            <View className="mt-1 flex-row flex-wrap gap-3">
                              {teacher && (
                                <View className="flex-row items-center gap-1">
                                  <User
                                    color={colors.muted}
                                    size={14}
                                  />
                                  <Text variant="muted" className="text-sm">
                                    {teacher}
                                  </Text>
                                </View>
                              )}
                              {room && (
                                <View className="flex-row items-center gap-1">
                                  <MapPin
                                    color={colors.muted}
                                    size={14}
                                  />
                                  <Text variant="muted" className="text-sm">
                                    {room}
                                  </Text>
                                </View>
                              )}
                            </View>
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
