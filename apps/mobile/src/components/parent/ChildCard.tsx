/**
 * ChildCard Component - TomAI 2026
 *
 * Enriched card for carousel: avatar, stats grid, Pronote badge, open button.
 */

import { View, TouchableOpacity } from 'react-native';
import {
  GraduationCap,
  BarChart3,
  BookOpen,
  Clock,
  Flame,
  CheckCircle2,
  Link2,
  ArrowRight,
} from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Card } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { getLevelLabel } from '@/constants/levels';
import { useIconColors, useThemeColors } from '@/hooks';
import type { IChild } from '@/hooks/useParentDashboard';
import { bgColors } from '@/lib/styles';

interface ChildCardProps {
  child: IChild;
  hasPronote: boolean;
  averageGrade: number | null;
  homeworkCount: number;
  studyTimeMinutes: number;
  streak: number;
  onPress?: (child: IChild) => void;
}

function formatStudyTime(minutes: number): string {
  if (minutes === 0) return '0min';
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h${String(mins).padStart(2, '0')}` : `${hours}h`;
}

export function ChildCard({
  child,
  hasPronote,
  averageGrade,
  homeworkCount,
  studyTimeMinutes,
  streak,
  onPress,
}: ChildCardProps) {
  const iconColors = useIconColors();
  const colors = useThemeColors();
  const fullName = `${child.firstName} ${child.lastName}`;
  const levelLabel = getLevelLabel(child.schoolLevel);

  return (
    <Card>
      <View className="p-4">
        {/* Top row: avatar + name + Pronote badge */}
        <View className="flex-row items-center">
          <Avatar fallback={fullName} size="lg" className="mr-3" />
          <View className="flex-1">
            <Text className="text-lg font-semibold">{child.firstName}</Text>
            <View className="flex-row items-center gap-1.5 mt-0.5">
              <GraduationCap color={iconColors.muted} size={13} />
              <Text variant="muted" className="text-xs">{levelLabel}</Text>
            </View>
          </View>
          {/* Pronote badge top-right */}
          <View
            className="flex-row items-center gap-1 rounded-full px-2 py-0.5"
            style={{
              backgroundColor: hasPronote ? bgColors.success[10] : bgColors.warning[10],
            }}
          >
            {hasPronote ? (
              <>
                <CheckCircle2 color={colors.success} size={12} />
                <Text className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">Pronote</Text>
              </>
            ) : (
              <>
                <Link2 color={colors.warning} size={12} />
                <Text className="text-[10px]" style={{ color: colors.warning }}>Non connecte</Text>
              </>
            )}
          </View>
        </View>

        {/* Stats grid 2x2 */}
        <View className="mt-3 flex-row gap-2 border-t border-slate-200 dark:border-slate-700 pt-3">
          <View className="flex-1 flex-row items-center gap-1.5 rounded-lg px-2 py-1.5" style={{ backgroundColor: bgColors.primary[5] }}>
            <BarChart3 color={colors.primary} size={14} />
            <Text className="text-xs font-medium">{averageGrade !== null ? averageGrade.toFixed(1) : '—'}</Text>
          </View>
          <View className="flex-1 flex-row items-center gap-1.5 rounded-lg px-2 py-1.5" style={{ backgroundColor: bgColors.warning[5] }}>
            <BookOpen color={colors.warning} size={14} />
            <Text className="text-xs font-medium">{homeworkCount} devoir{homeworkCount !== 1 ? 's' : ''}</Text>
          </View>
        </View>
        <View className="mt-2 flex-row gap-2">
          <View className="flex-1 flex-row items-center gap-1.5 rounded-lg px-2 py-1.5" style={{ backgroundColor: bgColors.success[5] }}>
            <Clock color={colors.success} size={14} />
            <Text className="text-xs font-medium">{formatStudyTime(studyTimeMinutes)}</Text>
          </View>
          <View className="flex-1 flex-row items-center gap-1.5 rounded-lg px-2 py-1.5" style={{ backgroundColor: bgColors.destructive[5] }}>
            <Flame color={colors.destructive} size={14} />
            <Text className="text-xs font-medium">{streak}j</Text>
          </View>
        </View>

        {/* Open button */}
        <TouchableOpacity
          onPress={() => onPress?.(child)}
          activeOpacity={0.7}
          className="mt-3 flex-row items-center justify-center gap-2 rounded-xl py-2.5"
          style={{ backgroundColor: bgColors.primary[10] }}
        >
          <Text className="font-semibold text-sm" style={{ color: colors.primary }}>Ouvrir</Text>
          <ArrowRight color={colors.primary} size={16} />
        </TouchableOpacity>
      </View>
    </Card>
  );
}
