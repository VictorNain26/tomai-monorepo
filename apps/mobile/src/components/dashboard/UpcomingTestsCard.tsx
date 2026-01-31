/**
 * UpcomingTestsCard Component
 *
 * Displays upcoming tests/exams from Pronote to help students prepare.
 * Proactive engagement: "You have a test in 3 days, want to prepare?"
 */

import { View, TouchableOpacity } from 'react-native';
import { Calendar, AlertTriangle, ChevronRight, BookOpen } from 'lucide-react-native';
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

export interface TestItem {
  id: string;
  subject: string;
  subjectEmoji: string;
  title: string;
  date: Date;
  /** Days until test */
  daysUntil: number;
  /** Topics/chapters covered */
  topics?: string[];
}

interface UpcomingTestsCardProps {
  tests: TestItem[];
  isConnected: boolean;
  isLoading?: boolean;
  /** Max items to show (default: 2) */
  maxItems?: number;
  onViewAll?: () => void;
}

// ============================================================================
// HELPERS
// ============================================================================

function formatTestDate(date: Date, daysUntil: number): string {
  if (daysUntil === 0) return "Aujourd'hui";
  if (daysUntil === 1) return 'Demain';

  const dayName = date.toLocaleDateString('fr-FR', { weekday: 'long' });
  const dayMonth = date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

  if (daysUntil <= 7) {
    return `${dayName.charAt(0).toUpperCase() + dayName.slice(1)} (${daysUntil}j)`;
  }

  return `${dayMonth} (${daysUntil}j)`;
}

function getUrgency(daysUntil: number): 'critical' | 'soon' | 'normal' {
  if (daysUntil <= 1) return 'critical';
  if (daysUntil <= 5) return 'soon';
  return 'normal';
}

// ============================================================================
// COMPONENT
// ============================================================================

export function UpcomingTestsCard({
  tests,
  isConnected,
  isLoading = false,
  maxItems = 2,
  onViewAll,
}: UpcomingTestsCardProps) {
  const router = useRouter();
  const iconColors = useIconColors();

  const upcomingTests = tests
    .filter((t) => t.daysUntil >= 0)
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, maxItems);

  const hasMore = tests.filter((t) => t.daysUntil >= 0).length > maxItems;

  // Navigate to chat to prepare for test
  function handlePrepareWithTom(item: TestItem) {
    const topicsPrompt = item.topics?.length
      ? `Les chapitres sont : ${item.topics.join(', ')}.`
      : '';

    router.push({
      pathname: '/(student)/chat',
      params: {
        subject: item.subject,
        context: `test:${item.id}`,
        prompt: `J'ai un contrôle de ${item.subject} sur "${item.title}" dans ${item.daysUntil} jours. ${topicsPrompt} Peux-tu m'aider à réviser ?`,
      },
    });
  }

  // Create flashcards for the test
  function handleCreateFlashcards(item: TestItem) {
    router.push({
      pathname: '/(student)/deck/create',
      params: {
        subject: item.subject,
        title: item.title,
        topics: item.topics?.join(','),
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
            <Skeleton className="mb-1 h-5 w-32 rounded" />
            <Skeleton className="h-3 w-20 rounded" />
          </View>
        </View>
        <Skeleton className="h-20 w-full rounded-lg" />
      </View>
    );
  }

  // Not connected state
  if (!isConnected) {
    return null; // Don't show if not connected - homework card handles this message
  }

  // Empty state
  if (upcomingTests.length === 0) {
    return null; // Don't show empty state for tests - focus on homework
  }

  return (
    <View style={shadows.sm} className="rounded-xl bg-card">
      {/* Header */}
      <View className="flex-row items-center justify-between p-4 pb-2">
        <View className="flex-row items-center gap-3">
          <View
            className="h-10 w-10 items-center justify-center rounded-lg"
            style={{ backgroundColor: bgColors.destructive[10] }}
          >
            <Calendar color={iconColors.destructive} size={20} />
          </View>
          <View>
            <Text variant="large">Contrôles à venir</Text>
            <Text variant="muted">
              {upcomingTests.length} contrôle{upcomingTests.length > 1 ? 's' : ''} prévu{upcomingTests.length > 1 ? 's' : ''}
            </Text>
          </View>
        </View>
        {hasMore && onViewAll && (
          <TouchableOpacity
            onPress={onViewAll}
            className="flex-row items-center"
            accessibilityRole="button"
            accessibilityLabel="Voir tous les contrôles"
          >
            <Text variant="small" className="text-primary">
              Tout voir
            </Text>
            <ChevronRight color={iconColors.primary} size={16} />
          </TouchableOpacity>
        )}
      </View>

      {/* Tests list */}
      <View className="gap-2 p-4 pt-2">
        {upcomingTests.map((item) => {
          const urgency = getUrgency(item.daysUntil);

          return (
            <CardCompact
              key={item.id}
              style={
                urgency === 'critical'
                  ? { backgroundColor: bgColors.destructive[5] }
                  : urgency === 'soon'
                    ? { backgroundColor: bgColors.warning[5] }
                    : undefined
              }
            >
              <CardCompactContent>
                <View className="gap-2">
                  {/* Header row */}
                  <View className="flex-row items-center gap-3">
                    <Text className="text-2xl">{item.subjectEmoji}</Text>
                    <View className="flex-1">
                      <Text variant="small" className="text-muted-foreground">
                        {item.subject}
                      </Text>
                      <Text className="font-medium" numberOfLines={1}>
                        {item.title}
                      </Text>
                    </View>

                    {/* Date badge */}
                    <View
                      className="flex-row items-center gap-1 rounded-md px-2 py-1"
                      style={{
                        backgroundColor:
                          urgency === 'critical'
                            ? bgColors.destructive[15]
                            : urgency === 'soon'
                              ? bgColors.warning[15]
                              : bgColors.muted[30],
                      }}
                    >
                      {urgency === 'critical' && (
                        <AlertTriangle color={iconColors.destructive} size={12} />
                      )}
                      <Text
                        variant="tiny"
                        className={
                          urgency === 'critical'
                            ? 'text-destructive font-medium'
                            : urgency === 'soon'
                              ? 'text-warning font-medium'
                              : ''
                        }
                      >
                        {formatTestDate(item.date, item.daysUntil)}
                      </Text>
                    </View>
                  </View>

                  {/* Topics if available */}
                  {item.topics && item.topics.length > 0 && (
                    <Text variant="muted" numberOfLines={1}>
                      Chapitres : {item.topics.join(', ')}
                    </Text>
                  )}

                  {/* Action buttons */}
                  <View className="flex-row gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="default"
                      onPress={() => handlePrepareWithTom(item)}
                      className="flex-1"
                      accessibilityLabel={`Préparer ${item.subject} avec Tom`}
                    >
                      Réviser avec Tom
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onPress={() => handleCreateFlashcards(item)}
                      accessibilityLabel="Créer des flashcards"
                    >
                      <BookOpen color={iconColors.foreground} size={16} />
                    </Button>
                  </View>
                </View>
              </CardCompactContent>
            </CardCompact>
          );
        })}
      </View>
    </View>
  );
}
