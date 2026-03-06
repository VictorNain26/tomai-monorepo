/**
 * GradesView - Shared grades display component
 *
 * Used by both student and parent screens.
 * Props control whether "Review with Tom" actions are available.
 */

import { useState, useMemo } from 'react';
import { View, TouchableOpacity } from 'react-native';
import {
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
import { useIconColors, useThemeColors } from '@/hooks';
import { bgColors, borderColors, shadows } from '@/lib/styles';
import { formatDateShort, getGradeStyle, isLowGrade } from '@/lib/pronote-helpers';

// ============================================================================
// TYPES
// ============================================================================

export interface Grade {
  id: string;
  subject: string;
  value: number | null;
  outOf: number;
  coefficient: number;
  date: string;
  description: string;
}

interface GradesViewProps {
  /** Array of grades to display */
  grades: Grade[] | undefined;
  /** Loading state */
  isLoading: boolean;
  /** Optional subtitle (e.g., child name for parent view) */
  subtitle?: string;
  /** Callback when "Review with Tom" is pressed (if undefined, button is hidden) */
  onReviewWithTom?: (subject: string, gradeId: string, description?: string) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function GradesView({ grades, isLoading, subtitle, onReviewWithTom }: GradesViewProps) {
  const iconColors = useIconColors();
  const colors = useThemeColors();
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null);

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
          grades: Grade[];
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

  // Loading skeleton
  if (isLoading) {
    return (
      <View className="gap-3 px-4 pt-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-20 w-full rounded-xl" />
        ))}
      </View>
    );
  }

  // Empty state
  if (subjectData.length === 0) {
    return (
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
    );
  }

  return (
    <View>
      {/* Overall average card */}
      {overallAverage !== null && (
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
                  <BarChart3 color={colors.primary} size={24} />
                </View>
                <View>
                  <Text variant="muted">
                    Moyenne générale{subtitle ? ` - ${subtitle}` : ''}
                  </Text>
                  <Text className="text-2xl font-bold">
                    {overallAverage.toFixed(2)}/20
                  </Text>
                </View>
              </View>
              {overallAverage >= 12 ? (
                <TrendingUp color={colors.success} size={24} />
              ) : overallAverage >= 10 ? (
                <Minus color={iconColors.muted} size={24} />
              ) : (
                <TrendingDown color={colors.destructive} size={24} />
              )}
            </View>
          </View>
        </Card>
      )}

      {/* Subjects list */}
      <View className="gap-3 px-4 py-4">
        {subjectData.map((subject) => {
          const isExpanded = expandedSubject === subject.subject;
          const avgStyle = getGradeStyle(subject.average, 20, colors);

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
                      <Text variant="tiny" className="text-slate-500 dark:text-slate-400">
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
                        <Text variant="tiny" className="text-slate-500 dark:text-slate-400">
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
                      const gradeStyle = getGradeStyle(grade.value, grade.outOf, colors);
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
                              <Text variant="tiny" className="text-slate-500 dark:text-slate-400">
                                {formatDateShort(grade.date)} • Coef. {grade.coefficient}
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

                          {/* Review button for low grades (only if callback provided) */}
                          {needsReview && onReviewWithTom && (
                            <TouchableOpacity
                              onPress={() =>
                                onReviewWithTom(
                                  grade.subject,
                                  grade.id,
                                  grade.description
                                )
                              }
                              className="mt-2 flex-row items-center justify-center gap-2 rounded-lg py-2"
                              style={{ backgroundColor: bgColors.primary[15] }}
                            >
                              <MessageCircle color={colors.primary} size={14} />
                              <Text variant="tiny" className="text-blue-600 dark:text-blue-400 font-medium">
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
    </View>
  );
}
