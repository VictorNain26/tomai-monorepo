/**
 * Student Dashboard - TomAI 2026
 *
 * Pronote-centered engagement: real school data drives the experience.
 * No artificial gamification - the motivation comes from actual schoolwork.
 *
 * Hierarchy:
 * 1. Urgent homework → immediate action
 * 2. Recent grades → diagnostic and review
 */

import { View, ScrollView, RefreshControl, Pressable } from 'react-native';
import { SafeAreaView } from '@/components/ui/safe-area-view';
import { useState, useCallback, useMemo } from 'react';
import { Link2, Brain } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';

import { Text } from '@/components/ui/text';
import {
  HomeworkUrgentCard,
  GradesRecentCard,
  type HomeworkItem,
  type GradeItem,
} from '@/components/dashboard';
import { ChatErrorBanner } from '@/components/chat';
import { useStudentDashboard, usePronote, useThemeColors, useDueSummary } from '@/hooks';
import { useUser } from '@/lib/auth';
import { bgColors } from '@/lib/styles';
import { enrichSubjectKey } from '@/constants/subjects';

// ============================================================================
// HELPERS - Transform Pronote data to component interfaces
// ============================================================================

/** Calculate days until a date */
function daysUntil(dateStr: string): number {
  const date = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function StudentDashboard() {
  const colors = useThemeColors();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  // Data hooks
  const user = useUser();
  const { userName } = useStudentDashboard();
  const pronote = usePronote(user?.id ?? '');
  const { data: dueSummary } = useDueSummary();

  // Refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        pronote.fetchHomework(),
        pronote.fetchGrades(),
        queryClient.refetchQueries({ queryKey: ['learning', 'due-summary'] }),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [pronote, queryClient]);

  // Transform homework data
  const homeworkItems: HomeworkItem[] = useMemo(() => {
    return pronote.homework.map((h) => ({
      id: h.id,
      subject: h.subject,
      subjectEmoji: enrichSubjectKey(h.subject).name,
      title: h.description,
      dueDate: new Date(h.dueDate),
      daysUntilDue: daysUntil(h.dueDate),
      isDone: h.done,
    }));
  }, [pronote.homework]);

  // Transform grades data
  const gradeItems: GradeItem[] = useMemo(() => {
    return pronote.grades
      .filter((g) => g.value !== null)
      .map((g) => ({
        id: g.id,
        subject: g.subject,
        subjectEmoji: enrichSubjectKey(g.subject).name,
        title: g.description,
        grade: g.value as number,
        maxGrade: g.outOf,
        classAverage: g.average,
        date: new Date(g.date),
      }));
  }, [pronote.grades]);

  // Calculate grade trend (simplified: compare recent vs older)
  const gradeTrend = useMemo(() => {
    if (gradeItems.length < 4) return undefined;

    const sorted = [...gradeItems].sort((a, b) => b.date.getTime() - a.date.getTime());
    const recent = sorted.slice(0, Math.ceil(sorted.length / 2));
    const older = sorted.slice(Math.ceil(sorted.length / 2));

    const recentAvg = recent.reduce((sum, g) => sum + (g.grade / g.maxGrade) * 20, 0) / recent.length;
    const olderAvg = older.reduce((sum, g) => sum + (g.grade / g.maxGrade) * 20, 0) / older.length;

    if (recentAvg > olderAvg + 0.5) return 'up' as const;
    if (recentAvg < olderAvg - 0.5) return 'down' as const;
    return 'stable' as const;
  }, [gradeItems]);

  // Contextual message from Tom (Step 4)
  const tomMessage = useMemo(() => {
    const hour = new Date().getHours();

    // Urgent homework
    const urgentHomework = homeworkItems.filter((h) => !h.isDone && h.daysUntilDue <= 1);
    if (urgentHomework.length > 0) {
      const hw = urgentHomework[0];
      return `Tu as un devoir de ${hw.subject} pour ${hw.daysUntilDue === 0 ? "aujourd'hui" : 'demain'}. On s'y met ?`;
    }

    // Due cards
    const dueCount = dueSummary?.totalDue ?? 0;
    if (dueCount > 0) {
      return `Tu as ${dueCount} carte${dueCount > 1 ? 's' : ''} a reviser. C'est le moment !`;
    }

    // Time of day
    if (hour < 12) return 'Bonne matinee ! Pret a apprendre ?';
    if (hour < 18) return "Bon apres-midi ! Besoin d'aide pour tes cours ?";
    return 'Bonne soiree ! Derniere revision avant demain ?';
  }, [homeworkItems, dueSummary?.totalDue]);

  // First name only for greeting
  const firstName = userName?.split(' ')[0] ?? 'Élève';

  return (
    <SafeAreaView testID="student-dashboard" className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 py-5 gap-5"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View>
          <Text variant="h2">Bonjour {firstName}</Text>
          {pronote.isConnected && pronote.resources[0]?.className && (
            <Text variant="muted">{pronote.resources[0].className}</Text>
          )}
          <Text variant="muted" className="mt-0.5">{tomMessage}</Text>
        </View>

        {pronote.error && (
          <ChatErrorBanner error={pronote.error} onRetry={onRefresh} />
        )}

        {/* Due Cards */}
        {(dueSummary?.totalDue ?? 0) > 0 && (
          <Pressable
            onPress={() => router.push('/(student)/(learning)')}
            className="flex-row items-center gap-3 rounded-xl bg-card p-4 active:opacity-80"
            accessibilityRole="button"
            accessibilityLabel={`${dueSummary?.totalDue ?? 0} cartes à réviser, appuyez pour commencer`}
          >
            <View
              className="h-10 w-10 items-center justify-center rounded-lg"
              style={{ backgroundColor: bgColors.primary[10] }}
            >
              <Brain color={colors.primary} size={20} />
            </View>
            <View className="flex-1">
              <Text className="font-semibold">
                {dueSummary?.totalDue} carte{(dueSummary?.totalDue ?? 0) > 1 ? 's' : ''} a reviser
              </Text>
              <Text variant="muted">Appuie pour commencer</Text>
            </View>
          </Pressable>
        )}

        {/* Pronote sections - only when connected */}
        {pronote.isConnected ? (
          <>
            <HomeworkUrgentCard
              homework={homeworkItems}
              isLoading={false}
              maxItems={3}
            />
            <GradesRecentCard
              grades={gradeItems}
              averageGrade={pronote.averageGrade}
              trend={gradeTrend}
              isLoading={false}
              maxItems={3}
            />
          </>
        ) : (
          <View className="flex-row items-center gap-3 rounded-xl bg-card p-4">
            <View
              className="h-10 w-10 items-center justify-center rounded-lg"
              style={{ backgroundColor: bgColors.primary[10] }}
            >
              <Link2 color={colors.primary} size={20} />
            </View>
            <View className="flex-1">
              <Text className="font-semibold">Pronote non connecte</Text>
              <Text variant="muted">Demande a ton parent de connecter Pronote pour voir tes devoirs et notes ici</Text>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
