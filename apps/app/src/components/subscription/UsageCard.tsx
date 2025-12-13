/**
 * UsageCard - AI usage display component (Rolling Window 2025)
 *
 * Architecture inspirée ChatGPT/Claude:
 * - Rolling window 5h comme affichage principal
 * - Quota se recharge progressivement (pas de reset brutal)
 * - Daily cap comme sécurité anti-abus (secondaire)
 *
 * Soft limits:
 * - 0-70%: Normal (pas d'affichage)
 * - 70-85%: Warning badge
 * - 85-95%: Throttle (délai 2s)
 * - 95-100%: Soft block avec timer
 */

import { type ReactElement } from 'react';
import { Zap, Crown, RefreshCw, AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import type { IWindowUsage } from '@/types';

interface UsageCardProps {
  /** Rolling window usage data */
  windowUsage: IWindowUsage;
  /** User plan */
  plan: 'free' | 'premium';
  /** Additional CSS classes */
  className?: string;
  /** Compact mode for inline display */
  compact?: boolean;
  /** Show weekly stats (for parent dashboard) */
  weeklyTokensUsed?: number | undefined;
}

export function UsageCard({
  windowUsage,
  plan,
  className,
  compact = false,
  weeklyTokensUsed,
}: UsageCardProps): ReactElement {
  const isPremium = plan === 'premium';
  const { usagePercent } = windowUsage;

  // Soft limit thresholds
  const isWarning = usagePercent >= 70 && usagePercent < 85;
  const isThrottle = usagePercent >= 85 && usagePercent < 95;
  const isNearLimit = usagePercent >= 95 && usagePercent < 100;
  const isExhausted = usagePercent >= 100;

  // Progress bar color based on usage level
  const progressColor = isExhausted
    ? 'bg-destructive'
    : isNearLimit
      ? 'bg-red-500'
      : isThrottle
        ? 'bg-orange-500'
        : isWarning
          ? 'bg-amber-500'
          : isPremium
            ? 'bg-amber-500'
            : 'bg-primary';

  // Remaining percentage for display
  const remainingPercent = Math.max(0, 100 - usagePercent);

  if (compact) {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        <div className="flex items-center gap-1.5">
          <Zap className={cn('h-4 w-4', isPremium ? 'text-amber-500' : 'text-primary')} />
          <span
            className={cn(
              'text-sm font-medium',
              isExhausted && 'text-destructive',
              isNearLimit && 'text-red-600',
              isThrottle && 'text-orange-600',
              isWarning && 'text-amber-600'
            )}
          >
            {Math.round(remainingPercent)}% restant
          </span>
        </div>
        <Progress value={usagePercent} className="h-2 w-20" indicatorClassName={progressColor} />
      </div>
    );
  }

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className={cn('p-1.5 rounded-lg', isPremium ? 'bg-amber-500/10' : 'bg-primary/10')}>
              {isPremium ? (
                <Crown className="h-4 w-4 text-amber-500" />
              ) : (
                <Zap className="h-4 w-4 text-primary" />
              )}
            </div>
            <div>
              <p className="text-sm font-medium">Utilisation IA</p>
              <p className="text-xs text-muted-foreground">Plan {isPremium ? 'Premium' : 'Gratuit'}</p>
            </div>
          </div>

          {/* Refresh timer */}
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <RefreshCw className="h-3 w-3" />
            <span>Recharge: {windowUsage.refreshIn}</span>
          </div>
        </div>

        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-center text-sm">
            <span
              className={cn(
                'font-medium',
                isExhausted && 'text-destructive',
                isNearLimit && 'text-red-600',
                isThrottle && 'text-orange-600',
                isWarning && 'text-amber-600'
              )}
            >
              {Math.round(remainingPercent)}% restant
            </span>
          </div>

          <Progress value={usagePercent} className="h-2" indicatorClassName={progressColor} />

          <p className="text-xs text-muted-foreground text-center">Fenêtre glissante 5h</p>
        </div>

        {/* Weekly stats for parent dashboard */}
        {weeklyTokensUsed !== undefined && weeklyTokensUsed > 0 && (
          <div className="mt-3 pt-3 border-t">
            <p className="text-xs text-muted-foreground text-center">
              Cette semaine: {(weeklyTokensUsed / 1000).toFixed(1)}K tokens utilisés
            </p>
          </div>
        )}

        {/* Warning messages based on soft limits */}
        {isExhausted && (
          <div className="mt-3 flex items-center gap-2 text-xs text-destructive justify-center">
            <AlertTriangle className="h-3 w-3" />
            <span>Limite atteinte - Recharge dans {windowUsage.refreshIn}</span>
          </div>
        )}
        {isNearLimit && !isExhausted && (
          <div className="mt-3 flex items-center gap-2 text-xs text-red-600 justify-center">
            <AlertTriangle className="h-3 w-3" />
            <span>Presque épuisé - Économise tes tokens !</span>
          </div>
        )}
        {isThrottle && !isNearLimit && (
          <p className="mt-3 text-xs text-orange-600 text-center">Quota faible - Réponses ralenties</p>
        )}
        {isWarning && !isThrottle && (
          <p className="mt-3 text-xs text-amber-600 text-center">Attention: quota limité</p>
        )}
      </CardContent>
    </Card>
  );
}
