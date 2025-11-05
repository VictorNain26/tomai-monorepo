/**
 * BadgeGrid - Grille Responsive de Badges
 *
 * Affiche une collection de badges en grille responsive adaptée au niveau scolaire.
 * Utilise BadgeCard pour le rendu individual de chaque badge.
 *
 * Features:
 * - Grille adaptative: 2-3 cols (primary), 3-4 cols (college), 4-6 cols (lycee)
 * - Tri intelligent: badges débloqués en premier
 * - Loading skeleton avec shadcn/ui Skeleton
 * - Empty state motivant adapté au mode
 *
 * 🎯 RÈGLES:
 * - SEULS composants shadcn/ui autorisés
 * - TypeScript strict mode
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BadgeCard } from './BadgeCard';
import { BADGE_DISPLAY_MODES } from '@/config/badgeConfig';
import { cn } from '@/lib/utils';
import type { BadgeWithDetails } from '@/hooks/useStudentGamification';
import type { ReactElement } from 'react';

export interface BadgeGridProps {
  badges: BadgeWithDetails[];
  mode?: 'primary' | 'college' | 'lycee';
  isLoading?: boolean;
  showUnlockedOnly?: boolean;
  showDescription?: boolean;
  className?: string;
  onBadgeClick?: (badge: BadgeWithDetails) => void;
}

export function BadgeGrid({
  badges,
  mode = 'lycee',
  isLoading = false,
  showUnlockedOnly = false,
  showDescription = true,
  className,
  onBadgeClick
}: BadgeGridProps): ReactElement {
  const displayMode = BADGE_DISPLAY_MODES[mode];

  // Filtrer et trier les badges
  const filteredBadges = showUnlockedOnly
    ? badges.filter(b => b.unlocked)
    : badges;

  // Tri: badges débloqués en premier, puis par displayOrder
  const sortedBadges = [...filteredBadges].sort((a, b) => {
    if (a.unlocked && !b.unlocked) return -1;
    if (!a.unlocked && b.unlocked) return 1;
    return a.displayOrder - b.displayOrder;
  });

  // Loading state
  if (isLoading) {
    return (
      <div className={cn(displayMode.grid, className)}>
        {Array.from({ length: 6 }, (_, i) => `badge-skeleton-${i}`).map((key) => (
          <Card key={key} className={displayMode.cardSize}>
            <CardContent className="flex flex-col items-center space-y-3 p-0 pt-6">
              <Skeleton className="w-16 h-16 rounded-full" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Empty state
  if (sortedBadges.length === 0) {
    return (
      <Card className={cn(
        'border-dashed',
        mode === 'primary' ? 'border-primary/20 bg-primary/5' :
        mode === 'college' ? 'border-secondary/20 bg-secondary/5' :
        'border-muted-foreground/20 bg-muted/5',
        className
      )}>
        <CardHeader className="text-center">
          <div className="mx-auto text-6xl mb-4">
            {mode === 'primary' ? '🎯' : mode === 'college' ? '🏆' : '🎖️'}
          </div>
          <CardTitle className="text-xl">
            {showUnlockedOnly
              ? (mode === 'primary'
                  ? 'Aucun badge débloqué pour le moment'
                  : 'Aucun badge débloqué')
              : 'Aucun badge disponible'
            }
          </CardTitle>
          <CardDescription className="text-base">
            {showUnlockedOnly
              ? (mode === 'primary'
                  ? 'Continue à étudier avec TomIA pour débloquer des badges ! 💪'
                  : 'Étudiez régulièrement pour débloquer vos premiers badges.')
              : 'Les badges seront bientôt disponibles.'
            }
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Grille de badges
  return (
    <div className={cn(displayMode.grid, className)}>
      {sortedBadges.map((badge) => (
        <BadgeCard
          key={badge.badgeKey}
          badge={badge}
          mode={mode}
          showDescription={showDescription}
          {...(onBadgeClick !== undefined && { onClick: onBadgeClick })}
        />
      ))}
    </div>
  );
}

/**
 * Variante: Affichage compact des badges débloqués uniquement
 * Utilisé dans les sections dashboard
 */
export function UnlockedBadgesGrid(props: Omit<BadgeGridProps, 'showUnlockedOnly'>): ReactElement {
  return <BadgeGrid {...props} showUnlockedOnly={true} />;
}

/**
 * Variante: Affichage de tous les badges (débloqués + verrouillés)
 * Utilisé pour une page dédiée badges
 */
export function AllBadgesGrid(props: Omit<BadgeGridProps, 'showUnlockedOnly'>): ReactElement {
  return <BadgeGrid {...props} showUnlockedOnly={false} />;
}
