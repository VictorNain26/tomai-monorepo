/**
 * HomeworkView - Shared homework display component
 *
 * Used by both student and parent screens.
 * Props control whether "Ask Tom" actions are available.
 */

import { View, TouchableOpacity } from 'react-native';
import {
  CheckCircle2,
  Circle,
  Calendar,
  MessageCircle,
  AlertCircle,
} from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useThemeColors } from '@/hooks';
import { bgColors, borderColors, shadows } from '@/lib/styles';
import { formatDateWithDay, isOverdue, getDaysUntil } from '@/lib/pronote-helpers';

// ============================================================================
// TYPES
// ============================================================================

export interface Homework {
  id: string;
  subject: string;
  description: string;
  dueDate: string;
  done: boolean;
}

interface HomeworkViewProps {
  /** Array of homework to display */
  homework: Homework[] | undefined;
  /** Loading state */
  isLoading: boolean;
  /** Callback when "Ask Tom" is pressed (if undefined, button is hidden) */
  onAskTom?: (subject: string, description: string, homeworkId: string) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function HomeworkView({ homework, isLoading, onAskTom }: HomeworkViewProps) {
  const colors = useThemeColors();

  // Group homework by due date
  const groupedHomework = (homework ?? []).reduce(
    (acc, hw) => {
      const dateKey = hw.dueDate;
      if (!acc[dateKey]) {
        acc[dateKey] = [];
      }
      acc[dateKey].push(hw);
      return acc;
    },
    {} as Record<string, Homework[]>
  );

  const sortedDates = Object.keys(groupedHomework).sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  );

  // Stats
  const totalCount = homework?.length ?? 0;
  const doneCount = homework?.filter((h) => h.done).length ?? 0;
  const overdueCount = homework?.filter((h) => isOverdue(h.dueDate, h.done)).length ?? 0;

  // Loading skeleton
  if (isLoading) {
    return (
      <View className="gap-4">
        {[1, 2, 3].map((i) => (
          <View key={i}>
            <Skeleton className="mb-2 h-4 w-24 rounded" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </View>
        ))}
      </View>
    );
  }

  // Empty state
  if (sortedDates.length === 0) {
    return (
      <View className="items-center py-12">
        <View
          className="mb-4 h-16 w-16 items-center justify-center rounded-full"
          style={{ backgroundColor: bgColors.success[10] }}
        >
          <CheckCircle2 color={colors.success} size={32} />
        </View>
        <Text variant="large" className="mb-1">
          Aucun devoir
        </Text>
        <Text variant="muted" className="text-center">
          Pas de devoirs pour cette semaine
        </Text>
      </View>
    );
  }

  return (
    <View>
      {/* Stats summary */}
      {totalCount > 0 && (
        <View className="mb-4 flex-row gap-2">
          <View
            className="flex-1 rounded-xl p-3"
            style={{ backgroundColor: bgColors.primary[10] }}
          >
            <Text variant="tiny" className="text-stone-600 dark:text-stone-400">
              Total
            </Text>
            <Text variant="large">{totalCount}</Text>
          </View>
          <View
            className="flex-1 rounded-xl p-3"
            style={{ backgroundColor: bgColors.success[10] }}
          >
            <Text variant="tiny" className="text-stone-600 dark:text-stone-400">
              Faits
            </Text>
            <Text variant="large" className="text-emerald-600 dark:text-emerald-400">
              {doneCount}
            </Text>
          </View>
          {overdueCount > 0 && (
            <View
              className="flex-1 rounded-xl p-3"
              style={{ backgroundColor: bgColors.destructive[10] }}
            >
              <Text variant="tiny" className="text-stone-600 dark:text-stone-400">
                En retard
              </Text>
              <Text variant="large" className="text-red-600 dark:text-red-400">
                {overdueCount}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Homework list grouped by date */}
      <View className="gap-6">
        {sortedDates.map((dateKey) => {
          const daysUntil = getDaysUntil(dateKey);
          const isUrgent = daysUntil <= 1 && daysUntil >= 0;

          return (
            <View key={dateKey}>
              {/* Date header */}
              <View className="mb-2 flex-row items-center gap-2">
                <Calendar color={colors.muted} size={16} />
                <Text className="font-semibold">{formatDateWithDay(dateKey)}</Text>
                {isUrgent && (
                  <View
                    className="rounded-full px-2 py-0.5"
                    style={{ backgroundColor: bgColors.warning[10] }}
                  >
                    <Text variant="tiny" style={{ color: colors.warning }}>
                      {daysUntil === 0 ? "Aujourd'hui" : 'Demain'}
                    </Text>
                  </View>
                )}
              </View>

              {/* Homework items */}
              <View className="gap-2">
                {groupedHomework[dateKey]?.map((hw) => {
                  const overdue = isOverdue(hw.dueDate, hw.done);

                  return (
                    <Card
                      key={hw.id}
                      style={[
                        shadows.xs,
                        overdue
                          ? {
                              borderWidth: 1,
                              borderColor: borderColors.destructive[30],
                              backgroundColor: bgColors.destructive[5],
                            }
                          : hw.done
                            ? {
                                borderWidth: 1,
                                borderColor: borderColors.success[30],
                                backgroundColor: bgColors.success[5],
                              }
                            : undefined,
                      ]}
                    >
                      <View className="p-4">
                        <View className="flex-row items-start gap-3">
                          {hw.done ? (
                            <CheckCircle2 color={colors.success} size={20} />
                          ) : overdue ? (
                            <AlertCircle color={colors.destructive} size={20} />
                          ) : (
                            <Circle color={colors.muted} size={20} />
                          )}
                          <View className="flex-1">
                            <Text
                              className={`font-medium ${hw.done ? 'text-emerald-600 dark:text-emerald-400' : ''}`}
                            >
                              {hw.subject}
                            </Text>
                            <Text
                              variant="muted"
                              className={`mt-1 ${hw.done ? 'line-through' : ''}`}
                              numberOfLines={2}
                            >
                              {hw.description}
                            </Text>
                            {overdue && (
                              <Text variant="tiny" className="mt-1 text-red-600 dark:text-red-400">
                                En retard
                              </Text>
                            )}
                          </View>
                        </View>

                        {/* Action button - only for incomplete homework and if callback provided */}
                        {!hw.done && onAskTom && (
                          <TouchableOpacity
                            onPress={() => onAskTom(hw.subject, hw.description, hw.id)}
                            className="mt-3 flex-row items-center justify-center gap-2 rounded-lg py-2"
                            style={{ backgroundColor: bgColors.primary[10] }}
                          >
                            <MessageCircle color={colors.primary} size={16} />
                            <Text variant="small" className="text-blue-600 dark:text-blue-400 font-medium">
                              Demander de l'aide à Tom
                            </Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </Card>
                  );
                })}
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
