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
import { ChatErrorBanner } from '@/components/chat';
import { usePronote, useThemeColors } from '@/hooks';
import { useUser } from '@/lib/auth';

export default function GradesScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const user = useUser();
  const pronote = usePronote(user?.id ?? '');
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await pronote.fetchGrades();
    setRefreshing(false);
  }, [pronote]);

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
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center gap-3 border-b border-border px-4 py-3">
        <TouchableOpacity
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full bg-muted"
        >
          <ArrowLeft color={colors.foreground} size={20} />
        </TouchableOpacity>
        <Text variant="h3">Notes</Text>
      </View>

      {pronote.error && (
        <ChatErrorBanner error={pronote.error} onRetry={onRefresh} />
      )}

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
          isLoading={refreshing}
          onReviewWithTom={handleReviewWithTom}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
