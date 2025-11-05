/**
 * BadgeSection - Section Dashboard Badges
 *
 * Section complète pour afficher les badges sur le dashboard étudiant.
 * Combine stats gamification + grille badges débloqués.
 *
 * Features:
 * - Stats summary: streaks, total badges, sessions
 * - Grille badges débloqués (mode compact)
 * - Bouton "Voir tous mes badges" vers page dédiée (futur)
 * - Loading et error states
 *
 * 🎯 RÈGLES:
 * - SEULS composants shadcn/ui autorisés
 * - Hook useStudentGamification() pour data
 * - TypeScript strict mode
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { UnlockedBadgesGrid } from './BadgeGrid';
import { useStudentGamification } from '@/hooks/useStudentGamification';
import { Trophy, Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';
import type { ReactElement } from 'react';
import { getModeCardClasses, type InterfaceMode } from '@/config/theme';

export interface BadgeSectionProps {
  mode?: InterfaceMode;
  className?: string;
  showViewAllButton?: boolean;
  onViewAllClick?: () => void;
}

export function BadgeSection({
  mode = 'lycee',
  className,
  showViewAllButton = false,
  onViewAllClick
}: BadgeSectionProps): ReactElement {
  const { data, isLoading, isError, error } = useStudentGamification();

  // Obtenir les classes de carte selon le mode (système centralisé)
  const cardBorderClass = getModeCardClasses(mode);

  // Error state
  if (isError) {
    return (
      <Card className={cn('border-destructive/20 bg-destructive/5', className)}>
        <CardHeader>
          <CardTitle className="text-destructive">
            {mode === 'primary' ? '❌ Oups ! Erreur de chargement' : 'Erreur de chargement des badges'}
          </CardTitle>
          <CardDescription>
            {mode === 'primary'
              ? 'Impossible de charger tes badges. Réessaie dans quelques instants !'
              : `Une erreur est survenue lors du chargement des badges. ${error instanceof Error ? error.message : ''}`
            }
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Loading state
  if (isLoading || !data) {
    return (
      <Card className={cn(cardBorderClass, className)}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Skeleton className="h-6 w-6 rounded-full" />
            <Skeleton className="h-6 w-48" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Stats skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }, (_, i) => `stat-skeleton-${i}`).map((key) => (
              <div key={key} className="text-center space-y-2">
                <Skeleton className="w-12 h-12 mx-auto rounded-full" />
                <Skeleton className="h-6 w-16 mx-auto" />
                <Skeleton className="h-4 w-24 mx-auto" />
              </div>
            ))}
          </div>
          {/* Badges skeleton */}
          <div className="space-y-2">
            <Skeleton className="h-5 w-32" />
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {Array.from({ length: 4 }, (_, i) => `badge-skeleton-${i}`).map((key) => (
                <Skeleton key={key} className="h-32 rounded-lg" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { stats, unlockedBadges, allBadges } = data;

  return (
    <Card className={cn(cardBorderClass, className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {mode === 'primary' ? '🏆 Mes badges et récompenses' : 'Badges de progression'}
        </CardTitle>
        <CardDescription>
          {mode === 'primary'
            ? 'Continue à étudier pour débloquer de nouveaux badges !'
            : 'Vos récompenses pour votre engagement et progression'
          }
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Stats Summary - Streaks + Badges uniquement */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Streak actuel */}
          <div className="text-center space-y-2">
            <div className="w-12 h-12 mx-auto bg-orange-100 dark:bg-orange-950/30 rounded-full flex items-center justify-center">
              <Flame className="h-6 w-6 text-orange-600 dark:text-orange-400" />
            </div>
            <div className="text-2xl font-bold text-foreground">
              {stats.currentStreak}
            </div>
            <p className="text-sm text-muted-foreground">
              {mode === 'primary' ? 'Jours de suite' : 'Jours consécutifs'}
            </p>
          </div>

          {/* Badges débloqués */}
          <div className="text-center space-y-2">
            <div className="w-12 h-12 mx-auto bg-yellow-100 dark:bg-yellow-950/30 rounded-full flex items-center justify-center">
              <Trophy className="h-6 w-6 text-yellow-600 dark:text-yellow-600" />
            </div>
            <div className="text-2xl font-bold text-foreground">
              {stats.totalBadgesUnlocked}/{stats.totalBadgesAvailable}
            </div>
            <p className="text-sm text-muted-foreground">
              {mode === 'primary' ? 'Badges gagnés' : 'Badges débloqués'}
            </p>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-border/50" />

        {/* Badges débloqués */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">
              {mode === 'primary'
                ? unlockedBadges.length > 0 ? '✨ Mes badges gagnés' : '🎯 Badges à débloquer'
                : unlockedBadges.length > 0 ? 'Badges débloqués' : 'Objectifs disponibles'
              }
            </h3>
            {showViewAllButton && stats.totalBadgesAvailable > 4 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onViewAllClick}
                className="text-xs h-7"
              >
                {mode === 'primary' ? 'Voir tout' : 'Voir tous les badges'}
              </Button>
            )}
          </div>

          {/* Grille badges - Limité à 4-6 badges sur dashboard */}
          <UnlockedBadgesGrid
            badges={unlockedBadges.length > 0 ? unlockedBadges.slice(0, 6) : allBadges.slice(0, 6)}
            mode={mode}
            showDescription={false}
            onBadgeClick={(badge) => {
              // Future: ouvrir modal avec détails badge
              logger.debug('Badge clicked', {
                operation: 'badges:click',
                badgeKey: badge.badgeKey,
                name: badge.name,
                unlocked: badge.unlocked
              });
            }}
          />

          {/* Message encouragement si aucun badge débloqué */}
          {unlockedBadges.length === 0 && (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground italic">
                {mode === 'primary'
                  ? '💪 Continue à étudier pour gagner ton premier badge !'
                  : 'Étudiez régulièrement pour débloquer vos premiers badges.'
                }
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
