/**
 * PronoteBadge - Standardized Pronote connection status badge.
 *
 * Used across parent dashboard and child detail screens.
 */

import { View } from 'react-native';
import { CheckCircle2, Link2 } from 'lucide-react-native';

import { Text } from '@/components/ui/text';
import { useThemeColors } from '@/hooks';
import { bgColors } from '@/lib/styles';

export function PronoteBadge({ connected }: { connected: boolean }) {
  const colors = useThemeColors();

  return (
    <View
      className="flex-row items-center gap-1.5 rounded-full px-3 py-1"
      style={{
        backgroundColor: connected ? bgColors.success[10] : bgColors.warning[10],
      }}
    >
      {connected ? (
        <>
          <CheckCircle2 color={colors.success} size={13} />
          <Text className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
            Pronote
          </Text>
        </>
      ) : (
        <>
          <Link2 color={colors.warning} size={13} />
          <Text className="text-xs" style={{ color: colors.warning }}>
            Non connecte
          </Text>
        </>
      )}
    </View>
  );
}
