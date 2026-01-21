/**
 * TokenUsageCard Component
 *
 * Displays token usage for the student (rolling window).
 */

import { View } from 'react-native';
import { Text } from '@/components/ui/text';
import { Progress } from '@/components/ui/progress';
import type { TokenUsage } from '@/hooks/useStudentDashboard';

interface TokenUsageCardProps {
  usage: TokenUsage | null;
  isLoading?: boolean;
}

export function TokenUsageCard({ usage, isLoading = false }: TokenUsageCardProps) {
  if (isLoading) {
    return (
      <View className="rounded-xl border border-border bg-card p-4">
        <View className="mb-3 h-4 w-24 animate-pulse rounded bg-muted" />
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

  const { window } = usage;
  const percent = Math.min(100, Math.round(window.usagePercent));
  const isLow = window.tokensRemaining < window.limit * 0.2;
  const isEmpty = window.tokensRemaining <= 0;

  return (
    <View className="rounded-xl border border-border bg-card p-4">
      <View className="mb-3 flex-row items-center justify-between">
        <Text className="font-medium">Tokens restants</Text>
        <View
          className={`rounded-full px-2 py-0.5 ${
            usage.plan === 'premium' ? 'bg-yellow-100' : 'bg-muted'
          }`}
        >
          <Text className="text-xs font-medium">
            {usage.plan === 'premium' ? '⭐ Premium' : 'Gratuit'}
          </Text>
        </View>
      </View>

      <Progress
        value={percent}
        className="mb-2"
        variant={isEmpty ? 'destructive' : isLow ? 'warning' : 'default'}
      />

      <View className="flex-row items-center justify-between">
        <Text
          className={`text-sm ${isEmpty ? 'text-destructive' : isLow ? 'text-yellow-600' : 'text-muted-foreground'}`}
        >
          {window.tokensRemaining.toLocaleString('fr-FR')} /{' '}
          {window.limit.toLocaleString('fr-FR')}
        </Text>
        <Text variant="muted" className="text-xs">
          Refresh: {window.refreshIn}
        </Text>
      </View>

      {isEmpty && (
        <View className="mt-2 rounded-lg bg-destructive/10 p-2">
          <Text className="text-center text-xs text-destructive">
            Tu as atteint ta limite. Réessaie dans {window.refreshIn}.
          </Text>
        </View>
      )}
    </View>
  );
}
