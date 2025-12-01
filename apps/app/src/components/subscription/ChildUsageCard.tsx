/**
 * ChildUsageCard - Token usage display for a specific child
 *
 * Used in ParentDashboard to show each child's AI usage.
 * Wraps UsageCard with child name/avatar.
 */

import { type ReactElement } from 'react';
import { User } from 'lucide-react';
import { useTokenUsage } from '@/hooks/useTokenUsage';
import { UsageCard } from './UsageCard';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { IChild } from '@/types';

interface ChildUsageCardProps {
  child: IChild;
}

export function ChildUsageCard({ child }: ChildUsageCardProps): ReactElement {
  const { usage, plan, isLoading } = useTokenUsage({
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

  if (!usage) {
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

        {/* Usage display - inline version */}
        <UsageCard usage={usage} plan={plan} compact />
      </CardContent>
    </Card>
  );
}
