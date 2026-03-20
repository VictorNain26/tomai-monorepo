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
import { usePronote, useParentDashboard, useIconColors, useThemeColors } from '@/hooks';
import { useUser } from '@/lib/auth';

export default function ChildGradesScreen() {
  const router = useRouter();
  const iconColors = useIconColors();
  const colors = useThemeColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [refreshing, setRefreshing] = useState(false);

  const user = useUser();
  const pronote = usePronote(user?.id ?? '');
  const { children } = useParentDashboard();
  const child = children.find((c) => c.id === id);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await pronote.fetchGrades();
    setRefreshing(false);
  }, [pronote]);

  return (
    <SafeAreaView className="flex-1 bg-stone-50 dark:bg-stone-900">
      {/* Header */}
      <View className="flex-row items-center gap-3 border-b border-stone-200 dark:border-stone-700 px-4 py-3">
        <TouchableOpacity
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full bg-stone-100 dark:bg-stone-800"
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
          grades={pronote.grades}
          isLoading={false}
          subtitle={child?.firstName}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
