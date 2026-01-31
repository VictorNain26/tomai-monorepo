/**
 * Student Grades Screen - TomAI 2026
 *
 * Displays grades from Pronote grouped by subject with actions to review with Tom.
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
  ChevronDown,
  ChevronUp,
  MessageCircle,
} from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useStudentGrades, useIconColors } from '@/hooks';
import { bgColors, borderColors, colors, shadows } from '@/lib/styles';

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

interface GradeStyle {
  textColor: string;
  bgColor: string;
  borderColor: string;
}

function getGradeStyle(value: number | null, outOf: number): GradeStyle {
  if (value === null) {
    return {
      textColor: colors.muted.foreground,
      bgColor: bgColors.muted[50],
      borderColor: borderColors.muted[20],
    };
  }
  const percent = (value / outOf) * 100;
  if (percent >= 80) {
    return {
      textColor: colors.success.DEFAULT,
      bgColor: bgColors.success[10],
      borderColor: borderColors.success[30],
    };
  }
  if (percent >= 60) {
    return {
      textColor: colors.primary.DEFAULT,
      bgColor: bgColors.primary[10],
      borderColor: borderColors.primary[30],
    };
  }
  if (percent >= 40) {
    return {
      textColor: colors.warning.DEFAULT,
      bgColor: bgColors.warning[10],
      borderColor: borderColors.warning[30],
    };
  }
  return {
    textColor: colors.destructive.DEFAULT,
    bgColor: bgColors.destructive[10],
    borderColor: borderColors.destructive[30],
  };
}

function isLowGrade(value: number | null, outOf: number): boolean {
  if (value === null) return false;
  return (value / outOf) * 100 < 50;
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function GradesScreen() {
  const router = useRouter();
  const iconColors = useIconColors();
  const [refreshing, setRefreshing] = useState(false);
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null);

  const { data: grades, isLoading, refetch } = useStudentGrades();

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // Navigate to Tom chat for revision
  const handleReviewWithTom = (subject: string, gradeId: string, description?: string) => {
    router.push({
      pathname: '/(student)/chat',
      params: {
        subject,
        context: `grade:${gradeId}`,
        prompt: `Je voudrais revoir ${description ? `"${description}"` : 'cette notion'} en ${subject} pour m'améliorer.`,
      },
    });
  };

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
        <TouchableOpacity
          onPress={() => router.back()}
          className="h-10 w-10 items-center justify-center rounded-full bg-muted"
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
            tintColor={colors.primary.DEFAULT}
          />
        }
      >
        {/* Overall average card */}
        {!isLoading && overallAverage !== null && (
          <Card
            style={[
              shadows.sm,
              {
                marginHorizontal: 16,
                marginTop: 16,
                borderWidth: 1,
                borderColor: borderColors.primary[20],
              },
            ]}
          >
            <View className="p-4">
              <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-3">
                  <View
                    className="h-12 w-12 items-center justify-center rounded-full"
                    style={{ backgroundColor: bgColors.primary[10] }}
                  >
                    <BarChart3 color={colors.primary.DEFAULT} size={24} />
                  </View>
                  <View>
                    <Text variant="muted">Moyenne générale</Text>
                    <Text className="text-2xl font-bold">
                      {overallAverage.toFixed(2)}/20
                    </Text>
                  </View>
                </View>
                {overallAverage >= 12 ? (
                  <TrendingUp color={colors.success.DEFAULT} size={24} />
                ) : overallAverage >= 10 ? (
                  <Minus color={iconColors.muted} size={24} />
                ) : (
                  <TrendingDown color={colors.destructive.DEFAULT} size={24} />
                )}
              </View>
            </View>
          </Card>
        )}

        {isLoading ? (
          // Loading skeleton
          <View className="gap-3 px-4 pt-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-xl" />
            ))}
          </View>
        ) : subjectData.length === 0 ? (
          // Empty state
          <View className="items-center py-12">
            <View
              className="mb-4 h-16 w-16 items-center justify-center rounded-full"
              style={{ backgroundColor: bgColors.muted[50] }}
            >
              <BarChart3 color={iconColors.muted} size={32} />
            </View>
            <Text variant="large" className="mb-1">
              Aucune note
            </Text>
            <Text variant="muted" className="text-center">
              Pas encore de notes ce trimestre
            </Text>
          </View>
        ) : (
          // Subjects list
          <View className="gap-3 px-4 py-4">
            {subjectData.map((subject) => {
              const isExpanded = expandedSubject === subject.subject;
              const avgStyle = getGradeStyle(subject.average, 20);

              return (
                <View key={subject.subject}>
                  {/* Subject header */}
                  <TouchableOpacity
                    onPress={() =>
                      setExpandedSubject(isExpanded ? null : subject.subject)
                    }
                    activeOpacity={0.7}
                  >
                    <Card style={shadows.xs}>
                      <View className="flex-row items-center justify-between p-4">
                        <View className="flex-1">
                          <Text className="font-semibold">{subject.subject}</Text>
                          <Text variant="tiny" className="text-muted-foreground">
                            {subject.grades.length} note
                            {subject.grades.length > 1 ? 's' : ''}
                          </Text>
                        </View>
                        <View className="flex-row items-center gap-3">
                          <View className="items-end">
                            <Text
                              className="text-xl font-bold"
                              style={{ color: avgStyle.textColor }}
                            >
                              {subject.average.toFixed(1)}
                            </Text>
                            <Text variant="tiny" className="text-muted-foreground">
                              /20
                            </Text>
                          </View>
                          {isExpanded ? (
                            <ChevronUp color={iconColors.muted} size={20} />
                          ) : (
                            <ChevronDown color={iconColors.muted} size={20} />
                          )}
                        </View>
                      </View>
                    </Card>
                  </TouchableOpacity>

                  {/* Expanded grades */}
                  {isExpanded && (
                    <View className="mt-2 gap-2 pl-4">
                      {subject.grades
                        .sort(
                          (a, b) =>
                            new Date(b.date).getTime() - new Date(a.date).getTime()
                        )
                        .map((grade) => {
                          const gradeStyle = getGradeStyle(grade.value, grade.outOf);
                          const needsReview = isLowGrade(grade.value, grade.outOf);

                          return (
                            <View
                              key={grade.id}
                              className="rounded-xl border p-3"
                              style={{
                                backgroundColor: gradeStyle.bgColor,
                                borderColor: gradeStyle.borderColor,
                              }}
                            >
                              <View className="flex-row items-center justify-between">
                                <View className="flex-1">
                                  <Text className="font-medium">
                                    {grade.description || 'Évaluation'}
                                  </Text>
                                  <Text variant="tiny" className="text-muted-foreground">
                                    {formatDate(grade.date)} • Coef. {grade.coefficient}
                                  </Text>
                                </View>
                                <Text
                                  className="text-lg font-bold"
                                  style={{ color: gradeStyle.textColor }}
                                >
                                  {grade.value !== null ? grade.value : 'N/A'}/
                                  {grade.outOf}
                                </Text>
                              </View>

                              {/* Review button for low grades */}
                              {needsReview && (
                                <TouchableOpacity
                                  onPress={() =>
                                    handleReviewWithTom(
                                      grade.subject,
                                      grade.id,
                                      grade.description
                                    )
                                  }
                                  className="mt-2 flex-row items-center justify-center gap-2 rounded-lg py-2"
                                  style={{ backgroundColor: bgColors.primary[15] }}
                                >
                                  <MessageCircle color={colors.primary.DEFAULT} size={14} />
                                  <Text variant="tiny" className="text-primary font-medium">
                                    Revoir avec Tom
                                  </Text>
                                </TouchableOpacity>
                              )}
                            </View>
                          );
                        })}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
