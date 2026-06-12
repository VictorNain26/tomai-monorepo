/**
 * Parent Child Homework Screen - TomAI 2026
 *
 * Uses shared HomeworkView component in read-only mode (no "Ask Tom").
 */

import { useState, useCallback, useMemo } from 'react';
import { View, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { HomeworkView } from '@/components/pronote';
import { usePronote, useParentDashboard, useThemeColors } from '@/hooks';
import { useUser } from '@/lib/auth';
import { getWeekLabel, getWeekBounds } from '@/lib/pronote-helpers';

export default function ChildHomeworkScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [weekOffset, setWeekOffset] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const user = useUser();
  const pronote = usePronote(user?.id ?? '');
  const { children } = useParentDashboard();
  const child = children.find((c) => c.id === id);

  const filteredHomework = useMemo(() => {
    const { start, end } = getWeekBounds(weekOffset);
    return pronote.homework.filter((h) => {
      const due = new Date(h.dueDate);
      return due >= start && due <= end;
    });
  }, [pronote.homework, weekOffset]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await pronote.fetchHomework();
    setRefreshing(false);
  }, [pronote]);

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center justify-between border-b border-border px-4 py-3">
        <View className="flex-row items-center gap-3">
          <TouchableOpacity
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-full bg-muted"
          >
            <ArrowLeft color={colors.foreground} size={20} />
          </TouchableOpacity>
          <View>
            <Text variant="h3">Devoirs</Text>
            {child && (
              <Text variant="muted" className="text-sm">
                {child.firstName}
              </Text>
            )}
          </View>
        </View>

        {/* Week navigation */}
        <View className="flex-row items-center gap-2">
          <TouchableOpacity
            onPress={() => setWeekOffset((w) => w - 1)}
            className="h-9 w-9 items-center justify-center rounded-lg bg-muted"
          >
            <ChevronLeft color={colors.foreground} size={18} />
          </TouchableOpacity>
          <Text variant="small" className="min-w-[90px] text-center">
            {getWeekLabel(weekOffset)}
          </Text>
          <TouchableOpacity
            onPress={() => setWeekOffset((w) => w + 1)}
            className="h-9 w-9 items-center justify-center rounded-lg bg-muted"
          >
            <ChevronRight color={colors.foreground} size={18} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        className="flex-1 px-4 py-4"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <HomeworkView homework={filteredHomework} isLoading={refreshing} />
      </ScrollView>
    </SafeAreaView>
  );
}
