/**
 * ChildCard Component - TomAI 2026
 *
 * Displays a child's info with Pronote status and quick actions.
 */

import { View, TouchableOpacity } from 'react-native';
import {
  ChevronRight,
  GraduationCap,
  CheckCircle2,
  Link2,
} from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Card } from '@/components/ui/card';
import { Avatar } from '@/components/ui/avatar';
import { getLevelLabel } from '@/constants/levels';
import { useIconColors } from '@/hooks';
import type { IChild } from '@/hooks/useParentDashboard';
import { bgColors, colors, shadows } from '@/lib/styles';

// ============================================================================
// PROPS
// ============================================================================

interface ChildCardProps {
  child: IChild;
  hasPronote?: boolean;
  onPress?: (child: IChild) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ChildCard({ child, hasPronote = false, onPress }: ChildCardProps) {
  const iconColors = useIconColors();
  const fullName = `${child.firstName} ${child.lastName}`;
  const levelLabel = getLevelLabel(child.schoolLevel);

  return (
    <TouchableOpacity onPress={() => onPress?.(child)} activeOpacity={0.7}>
      <Card style={shadows.sm}>
        <View className="p-4">
          <View className="flex-row items-center">
            {/* Avatar */}
            <Avatar fallback={fullName} size="lg" className="mr-3" />

            {/* Info */}
            <View className="flex-1">
              <Text className="font-semibold">{fullName}</Text>
              <Text variant="muted">@{child.username}</Text>
            </View>

            {/* Chevron */}
            <ChevronRight color={iconColors.muted} size={20} />
          </View>

          {/* Details */}
          <View className="mt-3 flex-row items-center gap-3 border-t border-border pt-3">
            {/* Level */}
            <View
              className="flex-row items-center gap-1.5 rounded-full px-2.5 py-1"
              style={{ backgroundColor: bgColors.primary[10] }}
            >
              <GraduationCap color={colors.primary.DEFAULT} size={14} />
              <Text variant="tiny" className="text-primary font-medium">
                {levelLabel}
              </Text>
            </View>

            {/* Pronote status */}
            <View
              className="flex-row items-center gap-1.5 rounded-full px-2.5 py-1"
              style={{
                backgroundColor: hasPronote
                  ? bgColors.success[10]
                  : bgColors.warning[10],
              }}
            >
              {hasPronote ? (
                <>
                  <CheckCircle2 color={colors.success.DEFAULT} size={14} />
                  <Text variant="tiny" className="text-success font-medium">
                    Pronote
                  </Text>
                </>
              ) : (
                <>
                  <Link2 color={colors.warning.DEFAULT} size={14} />
                  <Text variant="tiny" style={{ color: colors.warning.DEFAULT }}>
                    Non connecté
                  </Text>
                </>
              )}
            </View>

            {/* LV2 if set */}
            {child.selectedLv2 && (
              <View
                className="ml-auto rounded-full px-2.5 py-1"
                style={{ backgroundColor: bgColors.muted[50] }}
              >
                <Text variant="tiny" className="text-muted-foreground capitalize">
                  LV2: {child.selectedLv2}
                </Text>
              </View>
            )}
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
}
