/**
 * ChildSummaryCard - Compact card for the parent dashboard list.
 *
 * Shows avatar, name, level, stats row, Pronote badge.
 * Tap card → detail.
 */

import { View, TouchableOpacity } from 'react-native';
import {
  GraduationCap,
  BarChart3,
  BookOpen,
  Clock,
  Flame,
} from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Card } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { PronoteBadge } from './PronoteBadge';
import { useThemeColors } from '@/hooks';
import type { IChild } from '@/hooks/useParentDashboard';
import { getLevelLabel } from '@/constants/levels';
import { formatStudyTime } from '@/lib/formatters';
import { bgColors } from '@/lib/styles';

interface ChildSummaryCardProps {
  child: IChild;
  hasPronote: boolean;
  averageGrade: number | null;
  homeworkCount: number;
  studyTimeMinutes: number;
  streak: number;
  onPress: (child: IChild) => void;
}

export function ChildSummaryCard({
  child,
  hasPronote,
  averageGrade,
  homeworkCount,
  studyTimeMinutes,
  streak,
  onPress,
}: ChildSummaryCardProps) {
  const colors = useThemeColors();
  const fullName = `${child.firstName} ${child.lastName}`;
  const levelLabel = getLevelLabel(child.schoolLevel);

  return (
    <TouchableOpacity
      onPress={() => onPress(child)}
      activeOpacity={0.7}
      accessibilityLabel={`Voir le profil de ${child.firstName}`}
      accessibilityRole="button"
    >
      <Card>
        <View className="p-4">
          {/* Top row: avatar + name + Pronote badge */}
          <View className="flex-row items-center">
            <Avatar fallback={fullName} size="lg" className="mr-3" />
            <View className="flex-1">
              <Text className="text-base font-semibold">{child.firstName}</Text>
              <View className="flex-row items-center gap-1.5 mt-0.5">
                <GraduationCap color={colors.foreground} size={12} style={{ opacity: 0.4 }} />
                <Text variant="muted" className="text-xs">{levelLabel}</Text>
              </View>
            </View>
            <PronoteBadge connected={hasPronote} />
          </View>

          {/* Stats row */}
          <View className="mt-3 flex-row gap-1.5 border-t border-border pt-3">
            <StatBadge icon={<BarChart3 color={colors.primary} size={12} />} value={averageGrade !== null ? averageGrade.toFixed(1) : '—'} bg={bgColors.primary[5]} />
            <StatBadge icon={<BookOpen color={colors.warning} size={12} />} value={`${homeworkCount}`} bg={bgColors.warning[5]} />
            <StatBadge icon={<Clock color={colors.success} size={12} />} value={formatStudyTime(studyTimeMinutes)} bg={bgColors.success[5]} />
            <StatBadge icon={<Flame color={colors.destructive} size={12} />} value={`${streak}j`} bg={bgColors.destructive[5]} />
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

// ============================================================================
// STAT BADGE
// ============================================================================

function StatBadge({ icon, value, bg }: { icon: React.ReactNode; value: string; bg: string }) {
  return (
    <View
      className="flex-1 flex-row items-center justify-center gap-1 rounded-lg px-1.5 py-1.5"
      style={{ backgroundColor: bg }}
    >
      {icon}
      <Text className="text-xs font-medium">{value}</Text>
    </View>
  );
}

