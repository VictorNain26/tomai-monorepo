/**
 * GradesRecentCard Component
 *
 * Displays recent grades from Pronote with diagnostic suggestions.
 * Low grades prompt the student to review the topic with Tom.
 */

import { View, TouchableOpacity } from 'react-native';
import { BarChart3, TrendingUp, TrendingDown, Minus, ChevronRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { CardCompact, CardCompactContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useIconColors } from '@/hooks';
import { bgColors, shadows } from '@/lib/styles';

// ============================================================================
// TYPES
// ============================================================================

export interface GradeItem {
  id: string;
  subject: string;
  subjectEmoji: string;
  title: string;
  grade: number;
  maxGrade: number;
  /** Average of the class for comparison */
  classAverage?: number;
  /** Date the grade was received */
  date: Date;
  /** Chapter/topic for context */
  chapter?: string;
}

interface GradesRecentCardProps {
  grades: GradeItem[];
  /** Overall average */
  averageGrade: number | null;
  /** Trend compared to previous period */
  trend?: 'up' | 'down' | 'stable';
  isConnected: boolean;
  isLoading?: boolean;
  /** Max items to show (default: 3) */
  maxItems?: number;
  onViewAll?: () => void;
}

// ============================================================================
// HELPERS
// ============================================================================

function getGradeStatus(grade: number, maxGrade: number, classAverage?: number): 'good' | 'average' | 'needs-work' {
  const normalized = (grade / maxGrade) * 20; // Normalize to /20

  // If we have class average, compare to it
  if (classAverage !== undefined) {
    const normalizedAvg = (classAverage / maxGrade) * 20;
    if (normalized >= normalizedAvg + 2) return 'good';
    if (normalized <= normalizedAvg - 2) return 'needs-work';
    return 'average';
  }

  // Otherwise use absolute thresholds
  if (normalized >= 14) return 'good';
  if (normalized >= 10) return 'average';
  return 'needs-work';
}

function formatGrade(grade: number, maxGrade: number): string {
  // Format nicely: 15/20 or 8.5/10
  const gradeStr = grade % 1 === 0 ? grade.toString() : grade.toFixed(1);
  return `${gradeStr}/${maxGrade}`;
}

function formatDate(date: Date): string {
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return "Aujourd'hui";
  if (diffDays === 1) return 'Hier';
  if (diffDays < 7) return `Il y a ${diffDays} jours`;

  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

// ============================================================================
// COMPONENT
// ============================================================================

export function GradesRecentCard({
  grades,
  averageGrade,
  trend,
  isConnected,
  isLoading = false,
  maxItems = 3,
  onViewAll,
}: GradesRecentCardProps) {
  const router = useRouter();
  const iconColors = useIconColors();

  const recentGrades = grades
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .slice(0, maxItems);

  const hasMore = grades.length > maxItems;

  // Navigate to chat with grade context for review
  function handleReviewWithTom(item: GradeItem) {
    router.push({
      pathname: '/(student)/chat',
      params: {
        subject: item.subject,
        context: `grade:${item.id}`,
        prompt: item.chapter
          ? `J'ai eu ${formatGrade(item.grade, item.maxGrade)} sur "${item.chapter}". Peux-tu m'aider à revoir ce chapitre ?`
          : `J'ai eu ${formatGrade(item.grade, item.maxGrade)} en ${item.subject}. Peux-tu m'aider à comprendre mes erreurs ?`,
      },
    });
  }

  // Loading state
  if (isLoading) {
    return (
      <View style={shadows.sm} className="rounded-xl bg-card p-4">
        <View className="mb-4 flex-row items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <View className="flex-1">
            <Skeleton className="mb-1 h-5 w-24 rounded" />
            <Skeleton className="h-3 w-16 rounded" />
          </View>
          <Skeleton className="h-8 w-16 rounded" />
        </View>
        <View className="gap-3">
          <Skeleton className="h-14 w-full rounded-lg" />
          <Skeleton className="h-14 w-full rounded-lg" />
        </View>
      </View>
    );
  }

  // Not connected state
  if (!isConnected) {
    return (
      <View style={shadows.sm} className="rounded-xl bg-card p-5">
        <View className="items-center py-4">
          <View
            className="mb-3 h-12 w-12 items-center justify-center rounded-xl"
            style={{ backgroundColor: bgColors.muted[30] }}
          >
            <BarChart3 color={iconColors.muted} size={24} />
          </View>
          <Text variant="large" className="mb-1 text-center">
            Notes non disponibles
          </Text>
          <Text variant="muted" className="text-center">
            Connecte Pronote pour voir tes notes.
          </Text>
        </View>
      </View>
    );
  }

  // Empty state
  if (recentGrades.length === 0) {
    return (
      <View style={shadows.sm} className="rounded-xl bg-card p-5">
        <View className="flex-row items-center gap-3 mb-3">
          <View
            className="h-10 w-10 items-center justify-center rounded-lg"
            style={{ backgroundColor: bgColors.primary[10] }}
          >
            <BarChart3 color={iconColors.primary} size={20} />
          </View>
          <View>
            <Text variant="large">Notes</Text>
            <Text variant="muted">Aucune note récente</Text>
          </View>
        </View>
      </View>
    );
  }

  // Trend icon
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? iconColors.success : trend === 'down' ? iconColors.destructive : iconColors.muted;

  return (
    <View style={shadows.sm} className="rounded-xl bg-card">
      {/* Header with average */}
      <View className="flex-row items-center justify-between p-4 pb-2">
        <View className="flex-row items-center gap-3">
          <View
            className="h-10 w-10 items-center justify-center rounded-lg"
            style={{ backgroundColor: bgColors.primary[10] }}
          >
            <BarChart3 color={iconColors.primary} size={20} />
          </View>
          <View>
            <Text variant="large">Notes récentes</Text>
            {averageGrade !== null && (
              <View className="flex-row items-center gap-1">
                <Text variant="muted">
                  Moyenne: {averageGrade.toFixed(1)}/20
                </Text>
                {trend && <TrendIcon color={trendColor} size={14} />}
              </View>
            )}
          </View>
        </View>
        {hasMore && onViewAll && (
          <TouchableOpacity
            onPress={onViewAll}
            className="flex-row items-center"
            accessibilityRole="button"
            accessibilityLabel="Voir toutes les notes"
          >
            <Text variant="small" className="text-primary">
              Tout voir
            </Text>
            <ChevronRight color={iconColors.primary} size={16} />
          </TouchableOpacity>
        )}
      </View>

      {/* Grades list */}
      <View className="gap-2 p-4 pt-2">
        {recentGrades.map((item) => {
          const status = getGradeStatus(item.grade, item.maxGrade, item.classAverage);
          const needsReview = status === 'needs-work';

          return (
            <CardCompact
              key={item.id}
              style={
                needsReview
                  ? { backgroundColor: bgColors.warning[5] }
                  : undefined
              }
            >
              <CardCompactContent>
                <View className="flex-row items-center gap-3">
                  {/* Subject emoji */}
                  <Text className="text-2xl">{item.subjectEmoji}</Text>

                  {/* Content */}
                  <View className="flex-1">
                    <Text variant="small" className="text-muted-foreground">
                      {item.subject} • {formatDate(item.date)}
                    </Text>
                    <Text className="font-medium" numberOfLines={1}>
                      {item.title}
                    </Text>
                  </View>

                  {/* Grade display */}
                  <View className="items-end">
                    <Text
                      variant="large"
                      className={
                        status === 'good'
                          ? 'text-success'
                          : status === 'needs-work'
                            ? 'text-warning'
                            : ''
                      }
                    >
                      {formatGrade(item.grade, item.maxGrade)}
                    </Text>
                    {item.classAverage !== undefined && (
                      <Text variant="tiny">
                        Classe: {item.classAverage.toFixed(1)}
                      </Text>
                    )}
                  </View>

                  {/* Review button for low grades */}
                  {needsReview && (
                    <Button
                      size="sm"
                      variant="subtle"
                      onPress={() => handleReviewWithTom(item)}
                      accessibilityLabel={`Revoir ${item.subject} avec Tom`}
                    >
                      Revoir
                    </Button>
                  )}
                </View>
              </CardCompactContent>
            </CardCompact>
          );
        })}
      </View>
    </View>
  );
}
