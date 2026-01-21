/**
 * Student Grades Screen
 *
 * Displays grades from Pronote grouped by subject.
 */

import { useState, useCallback, useMemo } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
} from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Skeleton } from '@/components/ui/skeleton';
import { useStudentGrades } from '@/hooks';

// ============================================================================
// HELPERS
// ============================================================================

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  });
}

function getGradeColor(value: number | null, outOf: number): string {
  if (value === null) return 'text-muted-foreground';
  const percent = (value / outOf) * 100;
  if (percent >= 80) return 'text-green-600';
  if (percent >= 60) return 'text-blue-600';
  if (percent >= 40) return 'text-yellow-600';
  return 'text-red-600';
}

function getGradeBgColor(value: number | null, outOf: number): string {
  if (value === null) return 'bg-muted/50 border-border';
  const percent = (value / outOf) * 100;
  if (percent >= 80) return 'bg-green-50 border-green-200';
  if (percent >= 60) return 'bg-blue-50 border-blue-200';
  if (percent >= 40) return 'bg-yellow-50 border-yellow-200';
  return 'bg-red-50 border-red-200';
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function GradesScreen() {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null);

  const { data: grades, isLoading, refetch } = useStudentGrades();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // Group grades by subject and calculate averages
  const subjectData = useMemo(() => {
    if (!grades) return [];

    const grouped = grades.reduce(
      (acc, grade) => {
        if (!acc[grade.subject]) {
          acc[grade.subject] = {
            subject: grade.subject,
            grades: [],
            totalWeighted: 0,
            totalCoef: 0,
          };
        }
        acc[grade.subject].grades.push(grade);
        // Only count grades with actual values for average
        if (grade.value !== null) {
          acc[grade.subject].totalWeighted +=
            (grade.value / grade.outOf) * 20 * grade.coefficient;
          acc[grade.subject].totalCoef += grade.coefficient;
        }
        return acc;
      },
      {} as Record<
        string,
        {
          subject: string;
          grades: typeof grades;
          totalWeighted: number;
          totalCoef: number;
        }
      >
    );

    return Object.values(grouped)
      .map((data) => ({
        ...data,
        average: data.totalCoef > 0 ? data.totalWeighted / data.totalCoef : 0,
      }))
      .sort((a, b) => a.subject.localeCompare(b.subject));
  }, [grades]);

  // Calculate overall average
  const overallAverage = useMemo(() => {
    if (subjectData.length === 0) return null;
    const total = subjectData.reduce((sum, s) => sum + s.average, 0);
    return total / subjectData.length;
  }, [subjectData]);

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center gap-3 border-b border-border px-4 py-3">
        <TouchableOpacity onPress={() => router.back()} className="p-1">
          <ArrowLeft color="hsl(222.2, 47.4%, 11.2%)" size={24} />
        </TouchableOpacity>
        <Text variant="h3">Notes</Text>
      </View>

      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Overall average card */}
        {!isLoading && overallAverage !== null && (
          <View className="m-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-3">
                <View className="h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <BarChart3 color="hsl(222.2, 47.4%, 11.2%)" size={24} />
                </View>
                <View>
                  <Text variant="muted" className="text-sm">
                    Moyenne générale
                  </Text>
                  <Text className="text-2xl font-bold">
                    {overallAverage.toFixed(2)}/20
                  </Text>
                </View>
              </View>
              {overallAverage >= 12 ? (
                <TrendingUp color="hsl(142, 76%, 36%)" size={24} />
              ) : overallAverage >= 10 ? (
                <Minus color="hsl(215.4, 16.3%, 46.9%)" size={24} />
              ) : (
                <TrendingDown color="hsl(0, 84.2%, 60.2%)" size={24} />
              )}
            </View>
          </View>
        )}

        {isLoading ? (
          // Loading skeleton
          <View className="gap-3 px-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </View>
        ) : subjectData.length === 0 ? (
          // Empty state
          <View className="items-center py-12">
            <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-muted">
              <BarChart3 color="hsl(215.4, 16.3%, 46.9%)" size={32} />
            </View>
            <Text className="mb-1 font-semibold">Aucune note</Text>
            <Text variant="muted" className="text-center">
              Pas encore de notes ce trimestre
            </Text>
          </View>
        ) : (
          // Subjects list
          <View className="gap-3 px-4 pb-4">
            {subjectData.map((subject) => (
              <View key={subject.subject}>
                {/* Subject header */}
                <TouchableOpacity
                  onPress={() =>
                    setExpandedSubject(
                      expandedSubject === subject.subject
                        ? null
                        : subject.subject
                    )
                  }
                  className="flex-row items-center justify-between rounded-xl border border-border bg-card p-4"
                >
                  <View>
                    <Text className="font-semibold">{subject.subject}</Text>
                    <Text variant="muted" className="text-sm">
                      {subject.grades.length} note
                      {subject.grades.length > 1 ? 's' : ''}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text
                      className={`text-xl font-bold ${getGradeColor(subject.average, 20)}`}
                    >
                      {subject.average.toFixed(1)}
                    </Text>
                    <Text variant="muted" className="text-xs">
                      /20
                    </Text>
                  </View>
                </TouchableOpacity>

                {/* Expanded grades */}
                {expandedSubject === subject.subject && (
                  <View className="mt-2 gap-2 pl-4">
                    {subject.grades
                      .sort(
                        (a, b) =>
                          new Date(b.date).getTime() -
                          new Date(a.date).getTime()
                      )
                      .map((grade) => (
                        <View
                          key={grade.id}
                          className={`rounded-lg border p-3 ${getGradeBgColor(grade.value, grade.outOf)}`}
                        >
                          <View className="flex-row items-center justify-between">
                            <View className="flex-1">
                              <Text className="text-sm">
                                {grade.description || 'Évaluation'}
                              </Text>
                              <Text variant="muted" className="text-xs">
                                {formatDate(grade.date)} • Coef.{' '}
                                {grade.coefficient}
                              </Text>
                            </View>
                            <Text
                              className={`text-lg font-bold ${getGradeColor(grade.value, grade.outOf)}`}
                            >
                              {grade.value !== null ? grade.value : 'N/A'}/{grade.outOf}
                            </Text>
                          </View>
                        </View>
                      ))}
                  </View>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
