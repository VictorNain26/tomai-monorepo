/**
 * ChildUsageCard Component
 *
 * Displays token usage for a child (parent view).
 * Shows rolling window usage with weekly stats.
 */

import { View } from 'react-native';
import { Zap, Crown, RefreshCw, AlertTriangle } from 'lucide-react-native';
import { Text } from '@/components/ui/text';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { useIconColors } from '@/hooks';
import { cn } from '@/lib/utils';
import type { ChildWindowUsage, ChildWeeklyUsage } from '@/hooks';
import { bgColors } from '@/lib/styles';

// ============================================================================
// PROPS
// ============================================================================

interface ChildUsageCardProps {
  window: ChildWindowUsage | null;
  weekly: ChildWeeklyUsage | null;
  plan: 'free' | 'premium';
  isLoading?: boolean;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function ChildUsageCard({
  window: windowUsage,
  weekly,
  plan,
  isLoading = false,
}: ChildUsageCardProps) {
  const iconColors = useIconColors();

  if (isLoading) {
    return (
      <View className="rounded-xl border border-border bg-card p-4">
        <View className="mb-3 flex-row items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <View className="flex-1">
            <Skeleton className="mb-1 h-4 w-24 rounded" />
            <Skeleton className="h-3 w-16 rounded" />
          </View>
        </View>
        <Skeleton className="mb-2 h-2 w-full rounded-full" />
        <Skeleton className="h-3 w-32 rounded" />
      </View>
    );
  }

  if (!windowUsage) {
    return (
      <View className="rounded-xl border border-border bg-card p-4">
        <Text variant="muted" className="text-center text-sm">
          Aucune donnée d'utilisation disponible
        </Text>
      </View>
    );
  }

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
      <View className="flex-row items-center gap-3">
        <View className="flex-row items-center gap-1.5">
          <Zap
            color={isPremium ? iconColors.warning : iconColors.foreground}
            size={16}
          />
          <Text className={cn('text-sm font-medium', getStatusColor())}>
            {Math.round(remainingPercent)}% restant
          </Text>
        </View>
        <Progress
          value={usagePercent}
          className="h-2 flex-1"
          variant={getProgressVariant()}
        />
      </View>

      {/* Token count */}
      <View className="mt-2 flex-row items-center justify-between">
        <Text variant="muted" className="text-xs">
          {windowUsage.tokensRemaining.toLocaleString('fr-FR')} /{' '}
          {windowUsage.limit.toLocaleString('fr-FR')} tokens
        </Text>
      </View>

      {/* Weekly stats */}
      {weekly && weekly.tokensUsed > 0 && (
        <View className="mt-3 border-t border-border pt-3">
          <Text variant="muted" className="text-center text-xs">
            Cette semaine: {(weekly.tokensUsed / 1000).toFixed(1)}K tokens utilisés
          </Text>
        </View>
      )}

      {/* Warning messages */}
      {isExhausted && (
        <View className="mt-3 flex-row items-center justify-center gap-2 rounded-lg p-2" style={{ backgroundColor: bgColors.destructive[10] }}>
          <AlertTriangle color={iconColors.destructive} size={14} />
          <Text className="text-xs text-destructive">
            Limite atteinte
          </Text>
        </View>
      )}
      {isNearLimit && !isExhausted && (
        <View className="mt-3 flex-row items-center justify-center gap-2 rounded-lg p-2" style={{ backgroundColor: bgColors.destructive[10] }}>
          <AlertTriangle color={iconColors.destructive} size={14} />
          <Text className="text-xs text-destructive">
            Presque épuisé
          </Text>
        </View>
      )}
      {isThrottle && !isNearLimit && (
        <View className="mt-3 rounded-lg p-2" style={{ backgroundColor: bgColors.warning[10] }}>
          <Text className="text-center text-xs text-warning">
            Quota faible
          </Text>
        </View>
      )}
    </View>
  );
}
