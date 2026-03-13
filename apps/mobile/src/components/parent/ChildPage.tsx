/**
 * ChildPage - Full-page content for one child in the swipeable dashboard.
 *
 * Shows profile, stats grid, Pronote badge, actions.
 */

import { useState } from 'react';
import { View, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import {
  BarChart3,
  BookOpen,
  Clock,
  Flame,
  CheckCircle2,
  Link2,
  ArrowRight,
  Play,
} from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { useToast } from '@/components/ui/toast';
import { useThemeColors } from '@/hooks';
import type { IChild } from '@/hooks/useParentDashboard';
import { getLevelLabel } from '@/constants/levels';
import { launchChildSession, useSession } from '@/lib/auth';
import { bgColors } from '@/lib/styles';

// ============================================================================
// HELPERS
// ============================================================================

function formatStudyTime(minutes: number): string {
  if (minutes === 0) return '0min';
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h${String(mins).padStart(2, '0')}` : `${hours}h`;
}

// ============================================================================
// TYPES
// ============================================================================

export interface ChildPageProps {
  child: IChild;
  hasPronote: boolean;
  averageGrade: number | null;
  homeworkCount: number;
  studyTimeMinutes: number;
  streak: number;
  width: number;
  onViewDetail: (child: IChild) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ChildPage({
  child,
  hasPronote,
  averageGrade,
  homeworkCount,
  studyTimeMinutes,
  streak,
  width,
  onViewDetail,
}: ChildPageProps) {
  const colors = useThemeColors();
  const fullName = `${child.firstName} ${child.lastName}`;
  const levelLabel = getLevelLabel(child.schoolLevel);

  return (
    <ScrollView
      style={{ width }}
      contentContainerClassName="px-5 py-4 gap-4"
      showsVerticalScrollIndicator={false}
    >
      {/* Profile header */}
      <View className="items-center">
        <Avatar fallback={fullName} size="xl" className="mb-2" />
        <Text className="text-xl font-bold">{fullName}</Text>
        <Text variant="muted" className="text-sm">{levelLabel}</Text>

        {/* Pronote badge */}
        <View
          className="mt-2 flex-row items-center gap-1.5 rounded-full px-3 py-1"
          style={{
            backgroundColor: hasPronote ? bgColors.success[10] : bgColors.warning[10],
          }}
        >
          {hasPronote ? (
            <>
              <CheckCircle2 color={colors.success} size={13} />
              <Text className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                Pronote connecte
              </Text>
            </>
          ) : (
            <>
              <Link2 color={colors.warning} size={13} />
              <Text className="text-xs" style={{ color: colors.warning }}>
                Pronote non connecte
              </Text>
            </>
          )}
        </View>
      </View>

      {/* Stats grid 2x2 */}
      <View className="flex-row gap-2">
        <Card style={{ flex: 1 }}>
          <View className="items-center p-3">
            <BarChart3 color={colors.primary} size={18} />
            <Text className="mt-1 text-lg font-bold">
              {averageGrade !== null ? averageGrade.toFixed(1) : '—'}
            </Text>
            <Text variant="muted" className="text-[10px]">Moyenne</Text>
          </View>
        </Card>
        <Card style={{ flex: 1 }}>
          <View className="items-center p-3">
            <BookOpen color={colors.warning} size={18} />
            <Text className="mt-1 text-lg font-bold">{homeworkCount}</Text>
            <Text variant="muted" className="text-[10px]">Devoirs</Text>
          </View>
        </Card>
      </View>
      <View className="flex-row gap-2">
        <Card style={{ flex: 1 }}>
          <View className="items-center p-3">
            <Clock color={colors.success} size={18} />
            <Text className="mt-1 text-lg font-bold">{formatStudyTime(studyTimeMinutes)}</Text>
            <Text variant="muted" className="text-[10px]">Cette sem.</Text>
          </View>
        </Card>
        <Card style={{ flex: 1 }}>
          <View className="items-center p-3">
            <Flame color={colors.destructive} size={18} />
            <Text className="mt-1 text-lg font-bold">{streak}j</Text>
            <Text variant="muted" className="text-[10px]">Serie</Text>
          </View>
        </Card>
      </View>

      {/* View detail button */}
      <Button
        onPress={() => onViewDetail(child)}
        variant="outline"
        className="flex-row items-center justify-center gap-2"
      >
        <Text className="font-semibold text-sm" style={{ color: colors.primary }}>
          Voir le detail
        </Text>
        <ArrowRight color={colors.primary} size={16} />
      </Button>

      {/* Launch Tom button */}
      <LaunchTomButton childId={child.id} childName={child.firstName} />
    </ScrollView>
  );
}

// ============================================================================
// LAUNCH TOM BUTTON
// ============================================================================

function LaunchTomButton({ childId, childName }: { childId: string; childName: string }) {
  const router = useRouter();
  const toast = useToast();
  const colors = useThemeColors();
  const { refetch: refetchSession } = useSession();
  const [isLaunching, setIsLaunching] = useState(false);

  const handleLaunch = async () => {
    setIsLaunching(true);
    const result = await launchChildSession(childId);
    if (result.success) {
      await refetchSession();
      router.replace('/(student)');
    } else {
      toast.error('Erreur', result.error ?? 'Impossible de lancer la session');
    }
    setIsLaunching(false);
  };

  return (
    <Button
      onPress={handleLaunch}
      disabled={isLaunching}
      className="flex-row items-center justify-center gap-2"
      style={{ backgroundColor: colors.success, opacity: isLaunching ? 0.6 : 1 }}
    >
      <Play color="#fff" size={18} />
      <Text className="font-semibold text-white">
        {isLaunching ? 'Lancement...' : `Lancer Tom pour ${childName}`}
      </Text>
    </Button>
  );
}
