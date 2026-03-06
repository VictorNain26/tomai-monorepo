/**
 * Student Homework Screen - TomAI 2026
 *
 * Uses shared HomeworkView component with "Ask Tom" actions enabled.
 */

import { useState, useCallback } from 'react';
import { View, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { useRouter } from 'expo-router';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { HomeworkView } from '@/components/pronote';
import { useStudentHomework, useIconColors, useThemeColors } from '@/hooks';
import { getWeekLabel } from '@/lib/pronote-helpers';

export default function HomeworkScreen() {
  const router = useRouter();
  const iconColors = useIconColors();
  const colors = useThemeColors();
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
      pathname: '/(student)/(chat)',
      params: {
        context: `homework:${homeworkId}`,
        prompt: `Aide-moi avec ce devoir de ${subject} : ${description}`,
      },
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <View className="flex-row items-center justify-between border-b border-slate-200 dark:border-slate-700 px-4 py-3">
        <View className="flex-row items-center gap-3">
          <TouchableOpacity
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800"
          >
            <ArrowLeft color={iconColors.foreground} size={20} />
          </TouchableOpacity>
          <Text variant="h3">Devoirs</Text>
        </View>

        {/* Week navigation */}
        <View className="flex-row items-center gap-2">
          <TouchableOpacity
            onPress={() => setWeekOffset((w) => w - 1)}
            className="h-9 w-9 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800"
          >
            <ChevronLeft color={iconColors.foreground} size={18} />
          </TouchableOpacity>
          <Text variant="small" className="min-w-[90px] text-center">
            {getWeekLabel(weekOffset)}
          </Text>
          <TouchableOpacity
            onPress={() => setWeekOffset((w) => w + 1)}
            className="h-9 w-9 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800"
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
            tintColor={colors.primary}
          />
        }
      >
        <HomeworkView
          homework={homework}
          isLoading={isLoading}
          onAskTom={handleAskTom}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
