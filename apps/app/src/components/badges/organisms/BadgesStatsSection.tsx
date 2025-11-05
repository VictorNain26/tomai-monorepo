/**
 * BadgesStatsSection - Section Statistiques Badges
 *
 * Organism assemblant BadgeStatsGrid avec titre et états de chargement.
 * Affiche les stats globales de gamification (streak, badges, sessions).
 */

import { type ReactElement } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BadgeStatsGrid, type BadgeStats } from '@/components/badges/molecules/BadgeStatsGrid';
import { cn } from '@/lib/utils';
import { getModeCardClasses, type InterfaceMode } from '@/config/theme';

export interface BadgesStatsSectionProps {
  stats: BadgeStats | null;
  mode?: InterfaceMode;
  isLoading?: boolean;
  className?: string;
}

export function BadgesStatsSection({
  stats,
  mode = 'lycee',
  isLoading = false,
  className
}: BadgesStatsSectionProps): ReactElement {
  // Loading state
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="border-muted">
                <CardContent className="pt-6 text-center space-y-3">
                  <Skeleton className="w-14 h-14 mx-auto rounded-full" />
                  <Skeleton className="h-8 w-24 mx-auto" />
                  <Skeleton className="h-4 w-32 mx-auto" />
                  <Skeleton className="h-3 w-24 mx-auto" />
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Normal state
  if (!stats) {
    return <div className={className} />;
  }

  return (
    <Card
      className={cn(
        getModeCardClasses(mode),
        className
      )}
    >
      <CardHeader>
        <CardTitle>
          {mode === 'primary' ? '📊 Mes Statistiques' : 'Statistiques Globales'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <BadgeStatsGrid stats={stats} mode={mode} size="md" />
      </CardContent>
    </Card>
  );
}
