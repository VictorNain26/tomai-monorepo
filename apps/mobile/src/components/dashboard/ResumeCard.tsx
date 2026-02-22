/**
 * ResumeCard Component
 *
 * Shows continuity actions: resume last conversation or review due cards.
 * Renders nothing if there's nothing to resume.
 */

import { View, TouchableOpacity } from 'react-native';
import { MessageSquare, BookOpen, ChevronRight } from 'lucide-react-native';
import { useRouter } from 'expo-router';

import { Text } from '@/components/ui/text';
import { Card, CardContent } from '@/components/ui/card';
import { useIconColors, type LatestSession } from '@/hooks';
import { bgColors } from '@/lib/styles';

// ============================================================================
// HELPERS
// ============================================================================

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "a l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days}j`;
}

// ============================================================================
// TYPES
// ============================================================================

interface ResumeCardProps {
  latestSession: LatestSession | null;
  totalDueCards: number;
  isLoading: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ResumeCard({ latestSession, totalDueCards, isLoading }: ResumeCardProps) {
  const router = useRouter();
  const iconColors = useIconColors();

  // Don't render if nothing to show
  if (isLoading || (!latestSession && totalDueCards === 0)) return null;

  return (
    <Card>
      <CardContent className="gap-3 p-4">
        {latestSession && (
          <TouchableOpacity
            onPress={() =>
              router.push({
                pathname: '/(student)/(home)/chat',
                params: { sessionId: latestSession.id },
              })
            }
            className="flex-row items-center gap-3"
            activeOpacity={0.7}
          >
            <View
              className="h-10 w-10 items-center justify-center rounded-lg"
              style={{ backgroundColor: bgColors.primary[10] }}
            >
              <MessageSquare color={iconColors.primary} size={20} />
            </View>
            <View className="flex-1">
              <Text className="font-semibold">Reprendre la conversation</Text>
              <Text variant="muted" className="text-xs">
                {timeAgo(latestSession.startedAt)} · {latestSession.messagesCount} message{latestSession.messagesCount > 1 ? 's' : ''}
              </Text>
            </View>
            <ChevronRight color={iconColors.muted} size={16} />
          </TouchableOpacity>
        )}

        {totalDueCards > 0 && (
          <TouchableOpacity
            onPress={() => router.push('/(student)/(learning)/')}
            className="flex-row items-center gap-3"
            activeOpacity={0.7}
          >
            <View
              className="h-10 w-10 items-center justify-center rounded-lg"
              style={{ backgroundColor: bgColors.warning[10] }}
            >
              <BookOpen color={iconColors.warning} size={20} />
            </View>
            <View className="flex-1">
              <Text className="font-semibold">
                {totalDueCards} carte{totalDueCards > 1 ? 's' : ''} a reviser
              </Text>
            </View>
            <ChevronRight color={iconColors.muted} size={16} />
          </TouchableOpacity>
        )}
      </CardContent>
    </Card>
  );
}
