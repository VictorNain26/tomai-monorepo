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

import { View, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState, useCallback, useMemo } from 'react';
import { Link2 } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import {
  HomeworkUrgentCard,
  GradesRecentCard,
  ResumeCard,
  type HomeworkItem,
  type GradeItem,
} from '@/components/dashboard';
import { useStudentDashboard, useStudentPronote, useIconColors, useDueSummary } from '@/hooks';
import { bgColors } from '@/lib/styles';

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
  const iconColors = useIconColors();
  const [refreshing, setRefreshing] = useState(false);

  // Data hooks
  const { userName, latestSession, isLoadingSession } = useStudentDashboard();
  const pronote = useStudentPronote();
  const { data: dueSummary, isLoading: isLoadingDue } = useDueSummary();

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
        <View>
          <Text variant="h2">Bonjour {firstName}</Text>
          {pronote.isConnected && pronote.className && (
            <Text variant="muted">{pronote.className}</Text>
          )}
          <Text variant="muted" className="mt-0.5">{tomMessage}</Text>
        </View>

        {/* Resume card - continuity */}
        <ResumeCard
          latestSession={latestSession}
          totalDueCards={dueSummary?.totalDue ?? 0}
          isLoading={isLoadingSession || isLoadingDue}
        />

        {/* 1. Homework - Primary engagement driver */}
        <HomeworkUrgentCard
          homework={homeworkItems}
          isConnected={pronote.isConnected}
          isLoading={pronote.isLoadingData}
          maxItems={3}
        />

        {/* 2. Recent Grades - Diagnostic */}
        {pronote.isConnected && (
          <GradesRecentCard
            grades={gradeItems}
            averageGrade={pronote.averageGrade}
            trend={gradeTrend}
            isConnected={pronote.isConnected}
            isLoading={pronote.isLoadingData}
            maxItems={3}
          />
        )}

        {/* Fallback: Pronote not connected */}
        {!pronote.isConnected && (
          <View className="flex-row items-center gap-3 rounded-xl border border-border bg-card p-4">
            <View
              className="h-10 w-10 items-center justify-center rounded-lg"
              style={{ backgroundColor: bgColors.primary[10] }}
            >
              <Link2 color={iconColors.primary} size={20} />
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
