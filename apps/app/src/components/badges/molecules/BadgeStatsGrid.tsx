/**
 * BadgeStatsGrid - Grille Statistiques Badges
 *
 * Molecule réutilisant StatsGrid pour afficher stats de gamification.
 * Helper qui transforme GamificationStats en StatItems pour StatsGrid.
 */

import { type ReactElement } from 'react';
import { Flame, Trophy } from 'lucide-react';
import { StatsGrid, type StatItem } from '@/components/dashboard/molecules/StatsGrid';
import { cn } from '@/lib/utils';

export interface BadgeStats {
  currentStreak: number;
  longestStreak: number;
  totalBadgesUnlocked: number;
  totalBadgesAvailable: number;
}

export interface BadgeStatsGridProps {
  stats: BadgeStats;
  mode?: 'primary' | 'college' | 'lycee';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function BadgeStatsGrid({
  stats,
  mode = 'lycee',
  size = 'md',
  className
}: BadgeStatsGridProps): ReactElement {
  // Transformation des stats en StatItems (streaks + badges uniquement)
  const statItems: StatItem[] = [
    {
      icon: Flame,
      value: stats.currentStreak,
      label: mode === 'primary' ? 'Jours de suite' : 'Jours consécutifs',
      sublabel: `Record: ${stats.longestStreak} jours`,
      variant: 'orange'
    },
    {
      icon: Trophy,
      value: `${stats.totalBadgesUnlocked}/${stats.totalBadgesAvailable}`,
      label: mode === 'primary' ? 'Badges gagnés' : 'Badges débloqués',
      sublabel:
        stats.totalBadgesAvailable > 0
          ? `${Math.round((stats.totalBadgesUnlocked / stats.totalBadgesAvailable) * 100)}% complété`
          : 'Aucun badge disponible',
      variant: 'yellow'
    }
  ];

  return <StatsGrid stats={statItems} size={size} className={cn(className)} />;
}
