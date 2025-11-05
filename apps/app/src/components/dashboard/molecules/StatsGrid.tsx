/**
 * StatsGrid - Grille de Statistiques Universelle
 *
 * Molecule composant 3 StatCards en responsive grid.
 * Réutilisable pour dashboard et badges avec loading/error states.
 */

import { type ReactElement } from 'react';
import { type LucideIcon } from 'lucide-react';
import { StatCard } from '@/components/dashboard/atoms/StatCard';
import { cn } from '@/lib/utils';

export interface StatItem {
  icon: LucideIcon;
  value: string | number;
  label: string;
  sublabel?: string | undefined;
  variant: 'orange' | 'yellow' | 'blue' | 'green' | 'pink';
}

export interface StatsGridProps {
  stats: StatItem[];
  size?: 'sm' | 'md' | 'lg';
  className?: string | undefined;
  animate?: boolean;
}

export function StatsGrid({
  stats,
  size = 'md',
  className,
  animate = true
}: StatsGridProps): ReactElement {
  return (
    <div
      className={cn(
        'grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6',
        className
      )}
    >
      {stats.map((stat) => (
        <StatCard
          key={stat.label}
          icon={stat.icon}
          value={stat.value}
          label={stat.label}
          sublabel={stat.sublabel}
          variant={stat.variant}
          size={size}
          animate={animate}
        />
      ))}
    </div>
  );
}
