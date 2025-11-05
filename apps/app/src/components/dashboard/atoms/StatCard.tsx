/**
 * StatCard - Carte Statistique Universelle
 *
 * Design moderne avec glassmorphism, gradients subtils, animations fluides.
 * Réutilisable pour toutes les statistiques (streak, badges, sessions, etc.)
 * Utilise le système de couleurs centralisé (config/theme.ts)
 */

import { type ReactElement } from 'react';
import { type LucideIcon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { STAT_CARD_VARIANTS, type UIColorVariant } from '@/config/theme';

export interface StatCardProps {
  icon: LucideIcon;
  value: string | number;
  label: string;
  sublabel?: string | undefined;
  variant?: UIColorVariant;
  size?: 'sm' | 'md' | 'lg';
  className?: string | undefined;
  animate?: boolean;
}

const SIZE_CONFIGS = {
  sm: {
    iconContainer: 'w-10 h-10',
    iconSize: 'h-5 w-5',
    valueSize: 'text-xl',
    labelSize: 'text-xs',
    spacing: 'space-y-2',
    padding: 'p-4'
  },
  md: {
    iconContainer: 'w-14 h-14',
    iconSize: 'h-7 w-7',
    valueSize: 'text-3xl',
    labelSize: 'text-sm',
    spacing: 'space-y-3',
    padding: 'p-5'
  },
  lg: {
    iconContainer: 'w-16 h-16',
    iconSize: 'h-9 w-9',
    valueSize: 'text-4xl',
    labelSize: 'text-base',
    spacing: 'space-y-4',
    padding: 'p-6'
  }
};

export function StatCard({
  icon: Icon,
  value,
  label,
  sublabel,
  variant = 'blue',
  size = 'md',
  className,
  animate = true
}: StatCardProps): ReactElement {
  const variantConfig = STAT_CARD_VARIANTS[variant];
  const sizeConfig = SIZE_CONFIGS[size];

  return (
    <Card
      className={cn(
        'relative overflow-hidden border backdrop-blur-sm',
        'bg-card/50 hover:bg-card/80',
        'transition-all duration-300 ease-out',
        variantConfig.border,
        animate && 'hover:shadow-lg hover:-translate-y-1',
        variantConfig.glow,
        className
      )}
    >
      {/* Gradient overlay subtil */}
      <div className={cn('absolute inset-0 opacity-50', variantConfig.valueBg)} />

      <CardContent className={cn('relative text-center', sizeConfig.spacing, sizeConfig.padding)}>
        {/* Icon container avec glassmorphism */}
        <div
          className={cn(
            'mx-auto rounded-2xl flex items-center justify-center',
            'backdrop-blur-sm border border-white/10',
            'shadow-lg transition-transform duration-300',
            animate && 'hover:scale-110 hover:rotate-3',
            sizeConfig.iconContainer,
            variantConfig.iconBg
          )}
        >
          <Icon className={cn(sizeConfig.iconSize, variantConfig.iconColor)} strokeWidth={2.5} />
        </div>

        {/* Value avec font weight dynamique */}
        <div className={cn('font-bold tracking-tight text-foreground', sizeConfig.valueSize)}>
          {value}
        </div>

        {/* Label principal */}
        <p className={cn('font-medium text-muted-foreground', sizeConfig.labelSize)}>
          {label}
        </p>

        {/* Sublabel optionnel */}
        {sublabel && (
          <p className="text-xs text-muted-foreground/80 font-normal">
            {sublabel}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
