/**
 * SubscriptionBadge - Compact subscription status display
 *
 * Shows current plan and status in sidebar/header
 * Per-child pricing model: free or premium
 */

import { type ReactElement } from 'react';
import { Crown, Sparkles, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { SubscriptionPlanType, BillingStatusType } from '@/types';

interface SubscriptionBadgeProps {
  plan: SubscriptionPlanType;
  status?: BillingStatusType;
  showStatus?: boolean;
  size?: 'sm' | 'default';
  className?: string;
}

const planConfig: Record<SubscriptionPlanType, {
  label: string;
  icon: ReactElement;
  variant: 'default' | 'secondary' | 'outline';
  className?: string;
}> = {
  free: {
    label: 'Gratuit',
    icon: <Sparkles className="h-3 w-3" />,
    variant: 'outline',
  },
  premium: {
    label: 'Premium',
    icon: <Crown className="h-3 w-3" />,
    variant: 'default',
    className: 'bg-amber-500 hover:bg-amber-600',
  },
};

const statusLabels: Record<BillingStatusType, string> = {
  active: '',
  inactive: '',
  past_due: 'Paiement en attente',
  canceled: 'Annulé',
  expired: 'Expiré',
};

export function SubscriptionBadge({
  plan,
  status = 'active',
  showStatus = false,
  size = 'default',
  className,
}: SubscriptionBadgeProps): ReactElement {
  const config = planConfig[plan];
  const statusLabel = statusLabels[status];
  const hasWarning = status === 'past_due' || status === 'canceled' || status === 'expired';

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Badge
        variant={config.variant}
        className={cn(
          'flex items-center gap-1.5 font-medium',
          size === 'sm' && 'text-xs px-2 py-0.5',
          config.className
        )}
      >
        {config.icon}
        <span>{config.label}</span>
      </Badge>

      {showStatus && statusLabel && (
        <Badge
          variant={hasWarning ? 'destructive' : 'secondary'}
          className={cn('text-xs', size === 'sm' && 'px-1.5 py-0.5')}
        >
          {hasWarning && <AlertCircle className="h-3 w-3 mr-1" />}
          {statusLabel}
        </Badge>
      )}
    </div>
  );
}
