/**
 * HomeworkUrgentCard Component
 *
 * Displays urgent homework from Pronote with direct action to study with Tom.
 * This is the PRIMARY engagement driver - real school work, not gamification.
 */

import { View, TouchableOpacity } from 'react-native';
import { FileText, ChevronRight, AlertCircle, Clock } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { CardCompact, CardCompactContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useThemeColors } from '@/hooks';
import { bgColors, shadows } from '@/lib/styles';

// ============================================================================
// TYPES
// ============================================================================

export interface HomeworkItem {
  id: string;
  subject: string;
  subjectEmoji: string;
  title: string;
  dueDate: Date;
  /** Days until due: 0 = today, 1 = tomorrow, etc. */
  daysUntilDue: number;
  /** Is this homework marked as done in Pronote */
  isDone: boolean;
}

interface HomeworkUrgentCardProps {
  homework: HomeworkItem[];
  isLoading?: boolean;
  /** Max items to show (default: 3) */
  maxItems?: number;
  onViewAll?: () => void;
}

// ============================================================================
// HELPERS
// ============================================================================

function getDueLabel(daysUntilDue: number): string {
  if (daysUntilDue < 0) return 'En retard';
  if (daysUntilDue === 0) return "Aujourd'hui";
  if (daysUntilDue === 1) return 'Demain';
  return `Dans ${daysUntilDue} jours`;
}

function getDueUrgency(daysUntilDue: number): 'urgent' | 'soon' | 'normal' {
  if (daysUntilDue <= 0) return 'urgent';
  if (daysUntilDue <= 2) return 'soon';
  return 'normal';
}

// ============================================================================
// COMPONENT
// ============================================================================

export function HomeworkUrgentCard({
  homework,
  isLoading = false,
  maxItems = 3,
  onViewAll,
}: HomeworkUrgentCardProps) {
  const router = useRouter();
  const colors = useThemeColors();

  // Filter to show only undone homework, sorted by due date
  const urgentHomework = homework
    .filter((h) => !h.isDone)
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue)
    .slice(0, maxItems);

  const hasMore = homework.filter((h) => !h.isDone).length > maxItems;

  // Navigate to chat with homework context
  function handleStudyWithTom(item: HomeworkItem) {
    router.push({
      pathname: '/(student)/(chat)',
      params: {
        context: `homework:${item.id}`,
        prompt: `Aide-moi avec mon devoir de ${item.subject} : ${item.title}`,
      },
    });
  }

  // Loading state
  if (isLoading) {
    return (
      <View style={shadows.sm} className="rounded-xl bg-white dark:bg-stone-800 p-4">
        <View className="mb-4 flex-row items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <View className="flex-1">
            <Skeleton className="mb-1 h-5 w-32 rounded" />
            <Skeleton className="h-3 w-20 rounded" />
          </View>
        </View>
        <View className="gap-3">
          <Skeleton className="h-16 w-full rounded-lg" />
          <Skeleton className="h-16 w-full rounded-lg" />
        </View>
      </View>
    );
  }

  // Empty state
  if (urgentHomework.length === 0) {
    return (
      <View style={shadows.sm} className="rounded-xl bg-white dark:bg-stone-800 p-5">
        <View className="flex-row items-center gap-3 mb-3">
          <View
            className="h-10 w-10 items-center justify-center rounded-lg"
            style={{ backgroundColor: bgColors.success[10] }}
          >
            <FileText color={colors.success} size={20} />
          </View>
          <View>
            <Text variant="large">Devoirs</Text>
            <Text variant="muted">Tout est fait !</Text>
          </View>
        </View>
        <Text variant="muted" className="text-center py-2">
          Tu n'as pas de devoirs en attente.
        </Text>
      </View>
    );
  }

  return (
    <View style={shadows.sm} className="rounded-xl bg-white dark:bg-stone-800">
      {/* Header */}
      <View className="flex-row items-center justify-between p-4 pb-2">
        <View className="flex-row items-center gap-3">
          <View
            className="h-10 w-10 items-center justify-center rounded-lg"
            style={{ backgroundColor: bgColors.warning[10] }}
          >
            <FileText color={colors.warning} size={20} />
          </View>
          <View>
            <Text variant="large">À faire</Text>
            <Text variant="muted">
              {urgentHomework.length} devoir{urgentHomework.length > 1 ? 's' : ''} en attente
            </Text>
          </View>
        </View>
        {hasMore && onViewAll && (
          <TouchableOpacity
            onPress={onViewAll}
            className="flex-row items-center"
            accessibilityRole="button"
            accessibilityLabel="Voir tous les devoirs"
          >
            <Text variant="small" className="text-blue-600 dark:text-blue-400">
              Tout voir
            </Text>
            <ChevronRight color={colors.primary} size={16} />
          </TouchableOpacity>
        )}
      </View>

      {/* Homework list */}
      <View className="gap-2 p-4 pt-2">
        {urgentHomework.map((item) => {
          const urgency = getDueUrgency(item.daysUntilDue);
          const dueLabel = getDueLabel(item.daysUntilDue);

          return (
            <CardCompact
              key={item.id}
              style={
                urgency === 'urgent'
                  ? { backgroundColor: bgColors.destructive[5] }
                  : urgency === 'soon'
                    ? { backgroundColor: bgColors.warning[5] }
                    : undefined
              }
            >
              <CardCompactContent>
                <View className="flex-row items-start gap-3">
                  {/* Subject emoji */}
                  <Text className="text-2xl">{item.subjectEmoji}</Text>

                  {/* Content */}
                  <View className="flex-1">
                    <Text variant="small" className="text-stone-600 dark:text-stone-400">
                      {item.subject}
                    </Text>
                    <Text className="font-medium" numberOfLines={2}>
                      {item.title}
                    </Text>

                    {/* Due date badge */}
                    <View
                      className="mt-2 flex-row items-center gap-1"
                      accessible
                      accessibilityLabel={
                        urgency === 'urgent'
                          ? `En retard ou dû aujourd'hui: ${dueLabel}`
                          : dueLabel
                      }
                    >
                      {urgency === 'urgent' ? (
                        <AlertCircle color={colors.destructive} size={12} />
                      ) : (
                        <Clock color={colors.mutedForeground} size={12} />
                      )}
                      <Text
                        variant="tiny"
                        className={
                          urgency === 'urgent'
                            ? 'text-red-600 dark:text-red-400'
                            : urgency === 'soon'
                              ? 'text-amber-600 dark:text-amber-400'
                              : ''
                        }
                      >
                        {dueLabel}
                      </Text>
                    </View>
                  </View>

                  {/* Action button */}
                  <Button
                    size="sm"
                    variant="ghost"
                    onPress={() => handleStudyWithTom(item)}
                    accessibilityLabel={`Réviser ${item.subject} avec Tom`}
                  >
                    Réviser
                  </Button>
                </View>
              </CardCompactContent>
            </CardCompact>
          );
        })}
      </View>
    </View>
  );
}
