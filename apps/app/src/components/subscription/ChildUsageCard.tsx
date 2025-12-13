/**
 * ChildUsageCard - Token usage display for a specific child
 *
 * Used in ParentDashboard to show each child's AI usage.
 * Shows rolling window 5h usage with weekly stats.
 */

import { type ReactElement } from 'react';
import { User } from 'lucide-react';
import { useTokenUsage } from '@/hooks/useTokenUsage';
import { UsageCard } from './UsageCard';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { IChild, IWindowUsage } from '@/types';

interface ChildUsageCardProps {
  child: IChild;
}

/** Default window usage when no data available */
const DEFAULT_WINDOW: IWindowUsage = {
  tokensUsed: 0,
  tokensRemaining: 5_000,
  limit: 5_000,
  usagePercent: 0,
  refreshIn: '5h 0min',
};

export function ChildUsageCard({ child }: ChildUsageCardProps): ReactElement {
  const { window: windowUsage, weekly, plan, isLoading } = useTokenUsage({
    userId: child.id,
    enabled: true,
  });

  if (isLoading) {
    return (
      <Card className="overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-5 w-24" />
          </div>
          <Skeleton className="h-2 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!windowUsage) {
    return (
      <Card className="overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
              <User className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="font-medium">{child.firstName}</p>
          </div>
          <p className="text-sm text-muted-foreground text-center">
            Aucune donnée d'utilisation
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        {/* Child header */}
        <div className="flex items-center gap-3 mb-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium">{child.firstName}</p>
            <p className="text-xs text-muted-foreground capitalize">
              {child.schoolLevel?.replace('_', ' ') ?? 'Élève'}
            </p>
          </div>
        </div>

        {/* Usage display - inline version with rolling window */}
        <UsageCard
          windowUsage={windowUsage ?? DEFAULT_WINDOW}
          plan={plan}
          weeklyTokensUsed={weekly?.tokensUsed}
          compact
        />
      </CardContent>
    </Card>
  );
}
