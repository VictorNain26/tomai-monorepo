/**
 * LoadingState - États de Chargement Réutilisables
 *
 * Collection de patterns de chargement avec Skeleton.
 * Variantes pour stats, grids, lists, et pages complètes.
 */

import { type ReactElement } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface LoadingStateProps {
  variant?: 'stats' | 'grid' | 'list' | 'card' | 'page';
  count?: number;
  className?: string | undefined;
}

export function LoadingState({
  variant = 'card',
  count = 3,
  className
}: LoadingStateProps): ReactElement {
  switch (variant) {
    case 'stats':
      return <StatsLoadingState count={count} className={className} />;
    case 'grid':
      return <GridLoadingState count={count} className={className} />;
    case 'list':
      return <ListLoadingState count={count} className={className} />;
    case 'page':
      return <PageLoadingState className={className} />;
    case 'card':
    default:
      return <CardLoadingState className={className} />;
  }
}

// Skeleton pour statistiques (3 cards en grille)
function StatsLoadingState({ count, className }: { count: number; className?: string | undefined }): ReactElement {
  return (
    <div className={cn('grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6', className)}>
      {Array.from({ length: count }, (_, i) => (
        <Card key={i} className="border-muted">
          <CardContent className="pt-6 text-center space-y-3">
            <Skeleton className="w-14 h-14 mx-auto rounded-full" />
            <Skeleton className="h-8 w-16 mx-auto" />
            <Skeleton className="h-4 w-32 mx-auto" />
            <Skeleton className="h-3 w-24 mx-auto" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Skeleton pour grille (cards 2x2 ou plus)
function GridLoadingState({ count, className }: { count: number; className?: string | undefined }): ReactElement {
  return (
    <div className={cn('grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4', className)}>
      {Array.from({ length: count }, (_, i) => (
        <Card key={i} className="border-muted">
          <CardContent className="pt-6 space-y-3">
            <Skeleton className="w-16 h-16 mx-auto rounded-xl" />
            <Skeleton className="h-5 w-32 mx-auto" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-3 w-3/4 mx-auto" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Skeleton pour liste (sessions, items verticaux)
function ListLoadingState({ count, className }: { count: number; className?: string | undefined }): ReactElement {
  return (
    <div className={cn('space-y-3', className)}>
      {Array.from({ length: count }, (_, i) => (
        <Card key={i} className="border-muted">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <Skeleton className="w-20 h-8 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
              <div className="hidden md:flex gap-2 flex-shrink-0">
                <Skeleton className="w-24 h-10" />
                <Skeleton className="w-10 h-10" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Skeleton pour card simple
function CardLoadingState({ className }: { className?: string | undefined }): ReactElement {
  return (
    <Card className={cn('border-muted', className)}>
      <CardHeader>
        <Skeleton className="h-6 w-48 mb-2" />
        <Skeleton className="h-4 w-64" />
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </CardContent>
    </Card>
  );
}

// Skeleton pour page complète (header + stats + grid)
function PageLoadingState({ className }: { className?: string | undefined }): ReactElement {
  return (
    <div className={cn('space-y-6', className)}>
      {/* Header skeleton */}
      <div className="flex items-center gap-4">
        <Skeleton className="h-11 w-24" />
        <div className="flex-1">
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>

      {/* Stats skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <StatsLoadingState count={3} />
        </CardContent>
      </Card>

      {/* Grid skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48 mb-2" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <GridLoadingState count={6} />
        </CardContent>
      </Card>
    </div>
  );
}
