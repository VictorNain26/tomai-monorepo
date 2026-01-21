/**
 * ChildCard Component
 *
 * Displays a child's info with actions (view, edit, delete).
 * Mobile-optimized version of web's ChildrenTable row.
 */

import { View, TouchableOpacity } from 'react-native';
import { ChevronRight, GraduationCap, Calendar } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { Avatar } from '@/components/ui/avatar';
import { getLevelLabel } from '@/constants/levels';
import type { IChild } from '@/hooks/useParentDashboard';

// ============================================================================
// PROPS
// ============================================================================

interface ChildCardProps {
  child: IChild;
  onPress?: (child: IChild) => void;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ChildCard({ child, onPress }: ChildCardProps) {
  const fullName = `${child.firstName} ${child.lastName}`;
  const levelLabel = getLevelLabel(child.schoolLevel);

  // Format date if available
  const formattedDate = child.createdAt
    ? new Date(child.createdAt).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;

  return (
    <TouchableOpacity
      onPress={() => onPress?.(child)}
      activeOpacity={0.7}
      className="rounded-xl border border-border bg-card p-4"
    >
      <View className="flex-row items-center">
        {/* Avatar */}
        <Avatar fallback={fullName} size="lg" className="mr-3" />

        {/* Info */}
        <View className="flex-1">
          <Text className="font-semibold">{fullName}</Text>
          <Text variant="muted" className="text-sm">
            @{child.username}
          </Text>
        </View>

        {/* Chevron */}
        <ChevronRight color="hsl(215.4, 16.3%, 46.9%)" size={20} />
      </View>

      {/* Details */}
      <View className="mt-3 flex-row gap-4 border-t border-border pt-3">
        {/* Level */}
        <View className="flex-row items-center gap-1.5">
          <GraduationCap color="hsl(215.4, 16.3%, 46.9%)" size={14} />
          <Text variant="muted" className="text-xs">
            {levelLabel}
          </Text>
        </View>

        {/* Created date */}
        {formattedDate && (
          <View className="flex-row items-center gap-1.5">
            <Calendar color="hsl(215.4, 16.3%, 46.9%)" size={14} />
            <Text variant="muted" className="text-xs">
              Inscrit le {formattedDate}
            </Text>
          </View>
        )}

        {/* LV2 if set */}
        {child.selectedLv2 && (
          <View className="ml-auto">
            <Text variant="muted" className="text-xs capitalize">
              LV2: {child.selectedLv2}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}
