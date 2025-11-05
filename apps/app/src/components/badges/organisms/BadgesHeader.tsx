/**
 * BadgesHeader - Header Page Badges Moderne
 *
 * Header épuré avec compteur de badges intégré.
 * Design avec gradient subtil sur le titre et progression inline.
 *
 * 🎯 RÈGLES:
 * - SEULS composants shadcn/ui autorisés
 * - TypeScript strict mode
 */

import { type ReactElement } from 'react';
import { ArrowLeft, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export interface BadgesHeaderProps {
  mode?: 'primary' | 'college' | 'lycee';
  onBack: () => void;
  badgesUnlocked: number;
  badgesTotal: number;
  className?: string;
}

export function BadgesHeader({
  mode = 'lycee',
  onBack,
  badgesUnlocked,
  badgesTotal,
  className
}: BadgesHeaderProps): ReactElement {
  // Calculer pourcentage de complétion
  const completionPercentage = badgesTotal > 0
    ? Math.round((badgesUnlocked / badgesTotal) * 100)
    : 0;

  return (
    <div className={cn('mb-10', className)}>
      {/* Bouton retour moderne */}
      <Button
        variant="ghost"
        size="default"
        onClick={onBack}
        className="gap-2 min-h-[44px] mb-6 hover:bg-muted/50 transition-colors"
      >
        <ArrowLeft className="h-5 w-5" />
        <span className="font-medium">Retour au dashboard</span>
      </Button>

      {/* Titre avec badge de progression inline */}
      <div className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:gap-4">
          <h1
            className={cn(
              'text-4xl md:text-5xl font-bold tracking-tight',
              'bg-gradient-to-r from-foreground via-foreground to-muted-foreground bg-clip-text text-transparent'
            )}
          >
            {mode === 'primary' ? '🏆 Mes Badges' : 'Badges de Progression'}
          </h1>

          {/* Badge de progression moderne avec icône */}
          <Badge
            variant="secondary"
            className={cn(
              'text-base md:text-lg font-semibold px-4 py-2 gap-2',
              'bg-gradient-to-r from-yellow-500/10 to-amber-500/10',
              'border-2 border-yellow-500/20',
              'hover:border-yellow-500/40 transition-colors'
            )}
          >
            <Trophy className="h-5 w-5 text-yellow-600 dark:text-yellow-500" />
            <span className="text-foreground">
              {badgesUnlocked}/{badgesTotal}
            </span>
            <span className="text-muted-foreground">
              • {completionPercentage}%
            </span>
          </Badge>
        </div>

        {/* Description */}
        <p className="text-base md:text-lg text-muted-foreground max-w-2xl">
          {mode === 'primary'
            ? 'Découvre tous tes badges et objectifs à atteindre !'
            : 'Consultez vos badges débloqués et vos objectifs à atteindre'}
        </p>
      </div>

      {/* Ligne de séparation subtile */}
      <div className="mt-8 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
    </div>
  );
}
