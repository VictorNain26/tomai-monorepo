/**
 * Parent Child Grades Screen - TomAI 2026
 *
 * Uses shared GradesView component in read-only mode (no "Review with Tom").
 */

import { useState, useCallback } from 'react';
import { View, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { GradesView } from '@/components/pronote';
import { useChildGrades, useParentDashboard, useIconColors, useThemeColors } from '@/hooks';

export default function ChildGradesScreen() {
  const router = useRouter();
  const iconColors = useIconColors();
  const colors = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [refreshing, setRefreshing] = useState(false);

  const { children } = useParentDashboard();
  const child = children.find((c) => c.id === id);

  const { data: grades, isLoading, refetch } = useChildGrades(id);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

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
        <View>
          <Text variant="h3">Notes</Text>
          {child && (
            <Text variant="muted" className="text-sm">
              {child.firstName}
            </Text>
          )}
        </View>
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
          subtitle={child?.firstName}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
