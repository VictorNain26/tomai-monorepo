/**
 * UsageCard - Token usage display component
 *
 * Shows daily token usage with progress bar.
 * Displays different info based on user role:
 * - Student: Shows usage only (no subscription link)
 * - Parent: Shows usage + optional subscription link
 */

import { type ReactElement } from 'react';
import { Zap, Crown, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { ITokenUsage } from '@/types';

interface UsageCardProps {
  usage: ITokenUsage;
  plan: 'free' | 'premium';
  className?: string;
  compact?: boolean;
}

/**
 * Format number with French locale (1 000 instead of 1,000)
 */
function formatNumber(num: number): string {
  return new Intl.NumberFormat('fr-FR').format(num);
}

export function UsageCard({
  usage,
  plan,
  className,
  compact = false,
}: UsageCardProps): ReactElement {
  const isPremium = plan === 'premium';
  const usagePercent = usage.usagePercentage;
  const isLow = usagePercent >= 80;
  const isExhausted = usagePercent >= 100;

  // Progress bar color based on usage
  const progressColor = isExhausted
    ? 'bg-destructive'
    : isLow
    ? 'bg-amber-500'
    : isPremium
    ? 'bg-amber-500'
    : 'bg-primary';

  if (compact) {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <div className="flex items-center gap-1.5">
          <Zap className={cn('h-4 w-4', isPremium ? 'text-amber-500' : 'text-primary')} />
          <span className="text-sm font-medium">
            {formatNumber(usage.tokensRemaining)}
          </span>
          <span className="text-xs text-muted-foreground">
            / {formatNumber(usage.dailyLimit)}
          </span>
        </div>
        <Progress
          value={100 - usagePercent}
          className="h-2 w-16"
        />
      </div>
    );
  }

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={cn(
              'p-1.5 rounded-lg',
              isPremium ? 'bg-amber-500/10' : 'bg-primary/10'
            )}>
              {isPremium ? (
                <Crown className="h-4 w-4 text-amber-500" />
              ) : (
                <Zap className="h-4 w-4 text-primary" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium">
                Utilisation IA aujourd'hui
              </p>
              <p className="text-xs text-muted-foreground">
                Plan {isPremium ? 'Premium' : 'Gratuit'}
              </p>
            </div>
          </div>

          {/* Reset timer */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            <span>Reset: {usage.resetsIn}</span>
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className={cn(
              'font-medium',
              isExhausted && 'text-destructive',
              isLow && !isExhausted && 'text-amber-600'
            )}>
              {formatNumber(usage.tokensUsed)} utilisés
            </span>
            <span className="text-muted-foreground">
              {formatNumber(usage.tokensRemaining)} restants
            </span>
          </div>

          <Progress
            value={usagePercent}
            className={cn('h-2', progressColor)}
          />

          <p className="text-xs text-muted-foreground text-center">
            {formatNumber(usage.dailyLimit)} tokens/jour
            {isPremium && ' par enfant'}
          </p>
        </div>

        {/* Warning message */}
        {isExhausted && (
          <p className="mt-3 text-xs text-destructive text-center">
            Limite atteinte pour aujourd'hui
          </p>
        )}
        {isLow && !isExhausted && (
          <p className="mt-3 text-xs text-amber-600 text-center">
            Limite presque atteinte
          </p>
        )}
      </CardContent>
    </Card>
  );
}
