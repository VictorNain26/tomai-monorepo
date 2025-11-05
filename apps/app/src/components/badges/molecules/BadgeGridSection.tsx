/**
 * BadgeGridSection - Section Grille de Badges Épurée
 *
 * Molecule composant AllBadgesGrid avec titre simple.
 * Design moderne sans Card wrapper pour plus de légèreté.
 *
 * 🎯 RÈGLES:
 * - SEULS composants shadcn/ui autorisés
 * - TypeScript strict mode
 */

import { type ReactElement } from 'react';
import { AllBadgesGrid } from '@/components/badges/BadgeGrid';
import { cn } from '@/lib/utils';
import type { BadgeWithDetails } from '@/hooks/useStudentGamification';

export interface BadgeGridSectionProps {
  title: string;
  badges: BadgeWithDetails[];
  mode?: 'primary' | 'college' | 'lycee';
  showDescription?: boolean;
  className?: string;
}

export function BadgeGridSection({
  title,
  badges,
  mode = 'lycee',
  showDescription = true,
  className
}: BadgeGridSectionProps): ReactElement {
  return (
    <section className={cn('space-y-6', className)}>
      {/* Titre section simple et moderne */}
      <h2 className="text-2xl md:text-3xl font-bold text-foreground">
        {title}
      </h2>

      {/* Grille de badges */}
      <AllBadgesGrid
        badges={badges}
        mode={mode}
        showDescription={showDescription}
      />
    </section>
  );
}
