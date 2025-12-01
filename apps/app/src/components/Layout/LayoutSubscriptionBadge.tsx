/**
 * LayoutSubscriptionBadge - Subscription status in sidebar
 *
 * Compact display with upgrade CTA for free users
 */

import { type ReactElement } from 'react';
import { useNavigate } from 'react-router';
import { Crown, Sparkles, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useSubscription } from '@/hooks/useSubscription';
import { getPlanDisplayName, isPremiumActive } from '@/lib/subscription';

interface LayoutSubscriptionBadgeProps {
  collapsed?: boolean;
}

export function LayoutSubscriptionBadge({
  collapsed = false,
}: LayoutSubscriptionBadgeProps): ReactElement | null {
  const navigate = useNavigate();
  const { status, isLoading } = useSubscription();

  // Don't show while loading
  if (isLoading || !status) {
    return null;
  }

  const isPremium = isPremiumActive(status);

  const handleClick = () => {
    if (isPremium) {
      // Already premium - could open portal or do nothing
      return;
    }
    void navigate('/subscription/pricing');
  };

  // Collapsed state - just show icon
  if (collapsed) {
    return (
      <div className="px-2 py-1">
        <button
          onClick={handleClick}
          className={cn(
            'w-full flex items-center justify-center p-2 rounded-lg transition-colors',
            isPremium
              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
              : 'bg-primary/10 text-primary hover:bg-primary/20'
          )}
          title={isPremium ? getPlanDisplayName(status.plan) : 'Passer Premium'}
        >
          {isPremium ? (
            <Crown className="h-4 w-4" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
        </button>
      </div>
    );
  }

  // Expanded state
  return (
    <div className="px-3 py-2">
      {isPremium ? (
        // Premium user - subtle badge
        <div
          className={cn(
            'flex items-center gap-2 rounded-lg px-3 py-2',
            'bg-gradient-to-r from-amber-500/10 to-amber-600/5',
            'border border-amber-500/20'
          )}
        >
          <Crown className="h-4 w-4 text-amber-500" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
              {getPlanDisplayName(status.plan)}
            </p>
          </div>
        </div>
      ) : (
        // Free user - upgrade CTA
        <Button
          onClick={handleClick}
          variant="outline"
          size="sm"
          className={cn(
            'w-full justify-between group',
            'bg-gradient-to-r from-primary/5 to-primary/10',
            'border-primary/30 hover:border-primary/50',
            'hover:bg-primary/15'
          )}
        >
          <span className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Passer Premium</span>
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
        </Button>
      )}
    </div>
  );
}

export default LayoutSubscriptionBadge;
