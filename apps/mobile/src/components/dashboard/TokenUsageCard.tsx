/**
 * TokenUsageCard Component
 *
 * Displays token usage with soft limit thresholds (rolling window 5h).
 * Architecture 2026 inspired by ChatGPT/Claude:
 * - 0-70%: Normal (green)
 * - 70-85%: Warning (amber)
 * - 85-95%: Throttle (orange)
 * - 95-100%: Near limit (red)
 * - 100%+: Exhausted (destructive)
 */

import { View } from 'react-native';
import { Zap, Crown, RefreshCw, AlertTriangle } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { Progress } from '@/components/ui/progress';
import { useIconColors } from '@/hooks';
import { cn } from '@/lib/utils';
import type { TokenUsage } from '@/hooks/useStudentDashboard';
import { bgColors } from '@/lib/styles';

interface TokenUsageCardProps {
  usage: TokenUsage | null;
  isLoading?: boolean;
}

export function TokenUsageCard({ usage, isLoading = false }: TokenUsageCardProps) {
  const iconColors = useIconColors();

  if (isLoading) {
    return (
      <View className="rounded-xl border border-border bg-card p-4">
        <View className="mb-3 flex-row items-center gap-2">
          <View className="h-8 w-8 animate-pulse rounded-lg bg-muted" />
          <View className="flex-1">
            <View className="mb-1 h-4 w-24 animate-pulse rounded bg-muted" />
            <View className="h-3 w-16 animate-pulse rounded bg-muted" />
          </View>
        </View>
        <View className="mb-2 h-2 w-full animate-pulse rounded-full bg-muted" />
        <View className="h-3 w-32 animate-pulse rounded bg-muted" />
      </View>
    );
  }

  if (!usage) {
    return (
      <View className="rounded-xl border border-border bg-card p-4">
        <Text variant="muted" className="text-center text-sm">
          Impossible de charger l'usage
        </Text>
      </View>
    );
  }

  const { window: windowUsage, plan } = usage;
  const isPremium = plan === 'premium';
  const usagePercent = windowUsage.usagePercent;

  // Soft limit thresholds
  const isWarning = usagePercent >= 70 && usagePercent < 85;
  const isThrottle = usagePercent >= 85 && usagePercent < 95;
  const isNearLimit = usagePercent >= 95 && usagePercent < 100;
  const isExhausted = usagePercent >= 100;

  // Remaining percentage
  const remainingPercent = Math.max(0, 100 - usagePercent);

  // Get variant for Progress component
  const getProgressVariant = () => {
    if (isExhausted) return 'destructive';
    if (isNearLimit) return 'destructive';
    if (isThrottle) return 'warning';
    if (isWarning) return 'warning';
    return 'default';
  };

  // Get status text color (using semantic tokens)
  const getStatusColor = () => {
    if (isExhausted) return 'text-destructive';
    if (isNearLimit) return 'text-destructive';
    if (isThrottle) return 'text-warning';
    if (isWarning) return 'text-warning';
    return 'text-foreground';
  };

  return (
    <View className="rounded-xl border border-border bg-card p-4">
      {/* Header */}
      <View className="mb-3 flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <View
            className="h-8 w-8 items-center justify-center rounded-lg"
            style={{ backgroundColor: isPremium ? bgColors.warning[10] : bgColors.primary[10] }}
          >
            {isPremium ? (
              <Crown color={iconColors.warning} size={18} />
            ) : (
              <Zap color={iconColors.foreground} size={18} />
            )}
          </View>
          <View>
            <Text className="text-sm font-medium">Utilisation IA</Text>
            <Text variant="muted" className="text-xs">
              Plan {isPremium ? 'Premium' : 'Gratuit'}
            </Text>
          </View>
        </View>

        {/* Refresh timer */}
        <View className="flex-row items-center gap-1">
          <RefreshCw color={iconColors.muted} size={12} />
          <Text variant="muted" className="text-xs">
            {windowUsage.refreshIn}
          </Text>
        </View>
      </View>

      {/* Usage display */}
      <View className="items-center">
        <Text className={cn('text-2xl font-bold', getStatusColor())}>
          {Math.round(remainingPercent)}%
        </Text>
        <Text variant="muted" className="text-xs">
          restant
        </Text>
      </View>

      {/* Progress bar */}
      <Progress
        value={usagePercent}
        className="my-3"
        variant={getProgressVariant()}
      />

      {/* Token counts */}
      <View className="flex-row items-center justify-center">
        <Text variant="muted" className="text-xs">
          {windowUsage.tokensRemaining.toLocaleString('fr-FR')} tokens sur{' '}
          {windowUsage.limit.toLocaleString('fr-FR')}
        </Text>
      </View>

      {/* Warning messages based on soft limits */}
      {isExhausted && (
        <View className="mt-3 flex-row items-center justify-center gap-2 rounded-lg p-2" style={{ backgroundColor: bgColors.destructive[10] }}>
          <AlertTriangle color={iconColors.destructive} size={14} />
          <Text className="text-xs text-destructive">
            Limite atteinte • Recharge dans {windowUsage.refreshIn}
          </Text>
        </View>
      )}
      {isNearLimit && !isExhausted && (
        <View className="mt-3 flex-row items-center justify-center gap-2 rounded-lg p-2" style={{ backgroundColor: bgColors.destructive[10] }}>
          <AlertTriangle color={iconColors.destructive} size={14} />
          <Text className="text-xs text-destructive">
            Presque épuisé • Économise tes tokens !
          </Text>
        </View>
      )}
      {isThrottle && !isNearLimit && (
        <View className="mt-3 rounded-lg p-2" style={{ backgroundColor: bgColors.warning[10] }}>
          <Text className="text-center text-xs text-warning">
            Quota faible • Réponses ralenties
          </Text>
        </View>
      )}
      {isWarning && !isThrottle && (
        <View className="mt-3 rounded-lg p-2" style={{ backgroundColor: bgColors.warning[10] }}>
          <Text className="text-center text-xs text-warning">
            Attention : quota limité
          </Text>
        </View>
      )}
    </View>
  );
}
