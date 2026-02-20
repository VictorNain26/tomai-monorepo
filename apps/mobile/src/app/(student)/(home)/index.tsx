/**
 * Student Dashboard - TomAI 2026
 *
 * Pronote-centered engagement: real school data drives the experience.
 * No artificial gamification - the motivation comes from actual schoolwork.
 *
 * Hierarchy:
 * 1. Urgent homework → immediate action
 * 2. Recent grades → diagnostic and review
 * 3. Upcoming tests → preparation
 * 4. Quick access to Tom → always available
 */

import { View, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useState, useCallback, useMemo } from 'react';
import { Settings } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import {
  HomeworkUrgentCard,
  GradesRecentCard,
  UpcomingTestsCard,
  QuickAskCard,
  TokenUsageCard,
  type HomeworkItem,
  type GradeItem,
  type TestItem,
} from '@/components/dashboard';
import { useStudentDashboard, useStudentPronote, useIconColors } from '@/hooks';

// ============================================================================
// HELPERS - Transform Pronote data to component interfaces
// ============================================================================

/** Map subject name to emoji */
function getSubjectEmoji(subject: string): string {
  const subjectLower = subject.toLowerCase();

  if (subjectLower.includes('math')) return '📐';
  if (subjectLower.includes('français') || subjectLower.includes('francais')) return '📖';
  if (subjectLower.includes('anglais')) return '🇬🇧';
  if (subjectLower.includes('espagnol')) return '🇪🇸';
  if (subjectLower.includes('allemand')) return '🇩🇪';
  if (subjectLower.includes('histoire') || subjectLower.includes('géo')) return '🌍';
  if (subjectLower.includes('physique') || subjectLower.includes('chimie')) return '⚗️';
  if (subjectLower.includes('svt') || subjectLower.includes('biologie')) return '🧬';
  if (subjectLower.includes('techno')) return '⚙️';
  if (subjectLower.includes('sport') || subjectLower.includes('eps')) return '🏃';
  if (subjectLower.includes('musique')) return '🎵';
  if (subjectLower.includes('arts') || subjectLower.includes('plastiques')) return '🎨';
  if (subjectLower.includes('philo')) return '🤔';
  if (subjectLower.includes('ses') || subjectLower.includes('économie')) return '📊';
  if (subjectLower.includes('info') || subjectLower.includes('nsi')) return '💻';

  return '📚';
}

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
  const router = useRouter();
  const iconColors = useIconColors();
  const [refreshing, setRefreshing] = useState(false);

  // Data hooks
  const { usage, isLoadingUsage, userName } = useStudentDashboard();
  const pronote = useStudentPronote();

  // Refresh handler
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Queries will refetch automatically due to staleTime
    setTimeout(() => setRefreshing(false), 1000);
  }, []);

  // Transform homework data
  const homeworkItems: HomeworkItem[] = useMemo(() => {
    return pronote.homework.map((h) => ({
      id: h.id,
      subject: h.subject,
      subjectEmoji: getSubjectEmoji(h.subject),
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
        subjectEmoji: getSubjectEmoji(g.subject),
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

  // TODO: Tests would come from a separate Pronote endpoint (agenda/evaluations)
  // For now, this is a placeholder - would need backend support
  const testItems: TestItem[] = [];

  // Navigation handlers - updated paths for new structure
  function handleViewAllHomework() {
    router.push('/(student)/(profile)/pronote/homework');
  }

  function handleViewAllGrades() {
    router.push('/(student)/(profile)/pronote/grades');
  }

  // First name only for greeting
  const firstName = userName?.split(' ')[0] ?? 'Élève';

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 py-5 gap-5"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between">
          <View>
            <Text variant="h2">Bonjour {firstName}</Text>
            {pronote.isConnected && pronote.className && (
              <Text variant="muted">{pronote.className}</Text>
            )}
          </View>
          <Button
            variant="ghost"
            size="icon-sm"
            onPress={() => router.push('/(student)/(profile)/settings')}
            accessibilityLabel="Paramètres"
          >
            <Settings color={iconColors.muted} size={22} />
          </Button>
        </View>

        {/* 1. Homework - Primary engagement driver */}
        <HomeworkUrgentCard
          homework={homeworkItems}
          isConnected={pronote.isConnected}
          isLoading={pronote.isLoadingData}
          maxItems={3}
          onViewAll={handleViewAllHomework}
        />

        {/* 2. Upcoming Tests - If any */}
        {testItems.length > 0 && (
          <UpcomingTestsCard
            tests={testItems}
            isConnected={pronote.isConnected}
            isLoading={pronote.isLoadingData}
            maxItems={2}
          />
        )}

        {/* 3. Recent Grades - Diagnostic */}
        {pronote.isConnected && (
          <GradesRecentCard
            grades={gradeItems}
            averageGrade={pronote.averageGrade}
            trend={gradeTrend}
            isConnected={pronote.isConnected}
            isLoading={pronote.isLoadingData}
            maxItems={3}
            onViewAll={handleViewAllGrades}
          />
        )}

        {/* 4. Quick Ask - Always available */}
        <QuickAskCard userName={firstName} />

        {/* 5. Token Usage - Secondary info (collapsed style) */}
        <View className="mt-2">
          <TokenUsageCard usage={usage} isLoading={isLoadingUsage} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
