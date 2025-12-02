/**
 * UsageCard - AI usage display component
 *
 * Shows daily AI usage as percentage with progress bar.
 * Displays different info based on user plan (free/premium).
 * Tokens are hidden from users - only percentages shown.
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
          <span className={cn(
            'text-sm font-medium',
            isExhausted && 'text-destructive',
            isLow && !isExhausted && 'text-amber-600'
          )}>
            {Math.round(usagePercent)}% utilisé
          </span>
        </div>
        <Progress
          value={usagePercent}
          className="h-2 w-20"
          indicatorClassName={progressColor}
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
          <div className="flex justify-center text-sm">
            <span className={cn(
              'font-medium',
              isExhausted && 'text-destructive',
              isLow && !isExhausted && 'text-amber-600'
            )}>
              {Math.round(usagePercent)}% utilisé
            </span>
          </div>

          <Progress
            value={usagePercent}
            className="h-2"
            indicatorClassName={progressColor}
          />

          <p className="text-xs text-muted-foreground text-center">
            Quota journalier{isPremium && ' par enfant'}
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
