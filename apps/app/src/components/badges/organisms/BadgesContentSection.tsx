/**
 * BadgesContentSection - Section Contenu Badges
 *
 * Organism assemblant grille de badges et message encouragement.
 * Design moderne épuré avec titre informatif.
 *
 * 🎯 RÈGLES:
 * - SEULS composants shadcn/ui autorisés
 * - TypeScript strict mode
 */

import { type ReactElement } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { BadgeGridSection } from '@/components/badges/molecules/BadgeGridSection';
import type { BadgeWithDetails } from '@/hooks/useStudentGamification';

export interface BadgesContentSectionProps {
  badges: BadgeWithDetails[];
  badgesUnlocked: number;
  badgesTotal: number;
  mode?: 'primary' | 'college' | 'lycee';
  showEncouragement?: boolean;
  className?: string;
}

export function BadgesContentSection({
  badges,
  badgesUnlocked,
  badgesTotal,
  mode = 'lycee',
  showEncouragement = true,
  className
}: BadgesContentSectionProps): ReactElement {
  const remainingCount = badgesTotal - badgesUnlocked;

  return (
    <div className={className}>
      {/* Grille de tous les badges avec titre simple */}
      <BadgeGridSection
        title="Tous les badges"
        badges={badges}
        mode={mode}
        showDescription={true}
        className="mb-8"
      />

      {/* Message d'encouragement moderne */}
      {showEncouragement && remainingCount > 0 && (
        <Card className="border-primary/20 bg-gradient-to-r from-primary/5 via-primary/5 to-transparent">
          <CardContent className="pt-6 pb-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-lg md:text-xl font-semibold text-foreground">
                  {mode === 'primary' ? '💪 Continue comme ça !' : 'Continuez votre progression !'}
                </p>
                <p className="text-sm md:text-base text-muted-foreground">
                  {mode === 'primary'
                    ? `Il te reste ${remainingCount} badge${remainingCount > 1 ? 's' : ''} à débloquer !`
                    : `Plus que ${remainingCount} badge${remainingCount > 1 ? 's' : ''} à débloquer`}
                </p>
              </div>

              {/* Barre de progression visuelle */}
              <div className="w-full md:w-48 space-y-2">
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-yellow-500 to-amber-600 transition-all duration-500 ease-out"
                    style={{ width: `${(badgesUnlocked / badgesTotal) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground text-right">
                  {Math.round((badgesUnlocked / badgesTotal) * 100)}% complété
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
