/**
 * Student Grades Screen - TomAI 2026
 *
 * Uses shared GradesView component with "Review with Tom" actions enabled.
 */

import { useState, useCallback } from 'react';
import { View, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { useRouter } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { GradesView } from '@/components/pronote';
import { useStudentGrades, useIconColors, useThemeColors } from '@/hooks';

export default function GradesScreen() {
  const router = useRouter();
  const iconColors = useIconColors();
  const colors = useThemeColors();
  const [refreshing, setRefreshing] = useState(false);

  const { data: grades, isLoading, refetch } = useStudentGrades();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // Navigate to Tom chat for revision
  const handleReviewWithTom = (subject: string, gradeId: string, description?: string) => {
    router.push({
      pathname: '/(student)/(chat)',
      params: {
        context: `grade:${gradeId}`,
        prompt: `Je voudrais revoir ${description ? `"${description}"` : 'cette notion'} en ${subject} pour m'améliorer.`,
      },
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50 dark:bg-slate-900">
      {/* Header */}
      <View className="flex-row items-center gap-3 border-b border-slate-200 dark:border-slate-700 px-4 py-3">
        <TouchableOpacity
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800"
        >
          <ArrowLeft color={iconColors.foreground} size={20} />
        </TouchableOpacity>
        <Text variant="h3">Notes</Text>
      </View>

      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      >
        <GradesView
          grades={grades}
          isLoading={isLoading}
          onReviewWithTom={handleReviewWithTom}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
