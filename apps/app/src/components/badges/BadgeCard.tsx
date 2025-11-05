/**
 * BadgeCard - Composant Badge Modern
 *
 * Design moderne et épuré pour afficher les badges de gamification.
 * - Design minimaliste avec gradients subtils
 * - Animation hover fluide
 * - États locked/unlocked clairs
 * - Badge "Nouveau!" pour badges récents
 *
 * 🎯 RÈGLES:
 * - SEULS composants shadcn/ui autorisés
 * - TypeScript strict mode
 * - Design adaptatif selon niveau scolaire
 */

import { Card, CardContent } from '@/components/ui/card';
import { Badge as UIBadge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { getBadgeVisualConfig, getCategoryVisualConfig, BADGE_DISPLAY_MODES } from '@/config/badgeConfig';
import { cn } from '@/lib/utils';
import type { BadgeWithDetails } from '@/hooks/useStudentGamification';
import type { ReactElement } from 'react';

export interface BadgeCardProps {
  badge: BadgeWithDetails;
  mode?: 'primary' | 'college' | 'lycee';
  className?: string;
  showDescription?: boolean;
  onClick?: (badge: BadgeWithDetails) => void;
}

export function BadgeCard({
  badge,
  mode = 'lycee',
  className,
  showDescription = true,
  onClick
}: BadgeCardProps): ReactElement {
  const visualConfig = getBadgeVisualConfig(badge.badgeKey);
  const categoryConfig = getCategoryVisualConfig(badge.category);
  const displayMode = BADGE_DISPLAY_MODES[mode];

  const isUnlocked = badge.unlocked;

  // Design moderne épuré - carte avec gradient subtil et bordure
  const cardClasses = cn(
    displayMode.cardSize,
    'relative transition-all duration-300 cursor-pointer group overflow-hidden',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
    isUnlocked
      ? `bg-gradient-to-br ${visualConfig.bgColor} border-2 ${visualConfig.borderColor} hover:shadow-xl hover:scale-[1.03] active:scale-[0.98]`
      : 'bg-muted/30 border-2 border-dashed border-muted-foreground/20 hover:border-muted-foreground/40 opacity-70',
    onClick && 'cursor-pointer',
    className
  );

  // Icône avec animation hover plus prononcée
  const iconClasses = cn(
    displayMode.iconSize,
    'transition-all duration-300',
    isUnlocked
      ? 'group-hover:scale-125 group-hover:rotate-6'
      : 'grayscale opacity-30'
  );

  const content = (
    <Card
      className={cardClasses}
      onClick={() => onClick?.(badge)}
      tabIndex={0}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && onClick) {
          e.preventDefault();
          onClick(badge);
        }
      }}
    >
      {/* Badge "Nouveau!" - Position absolue top-left */}
      {isUnlocked && badge.unlockedAt && isRecentlyUnlocked(badge.unlockedAt) && (
        <UIBadge
          variant="default"
          className="absolute top-2 left-2 bg-gradient-to-r from-green-500 to-emerald-600 text-white shadow-lg animate-pulse z-10"
        >
          Nouveau!
        </UIBadge>
      )}

      {/* Badge catégorie - Coin supérieur droit */}
      <div className="absolute top-2 right-2 z-10">
        <UIBadge
          variant="secondary"
          className={cn(
            'text-xs font-medium backdrop-blur-sm',
            isUnlocked
              ? `${categoryConfig.color} bg-background/70`
              : 'text-muted-foreground bg-muted/50'
          )}
        >
          {categoryConfig.icon}
        </UIBadge>
      </div>

      <CardContent className="flex flex-col items-center justify-center text-center space-y-3 p-0 pt-10 pb-6">
        {/* Icône emoji badge - Plus grand et central */}
        <div className={iconClasses}>
          {isUnlocked ? visualConfig.icon : '🔒'}
        </div>

        {/* Nom du badge - Typographie moderne */}
        <h3
          className={cn(
            displayMode.titleSize,
            'font-semibold leading-tight px-2',
            isUnlocked
              ? visualConfig.textColor
              : 'text-muted-foreground'
          )}
        >
          {badge.name}
        </h3>

        {/* Description conditionnelle - Texte secondaire */}
        {showDescription && (
          <p
            className={cn(
              displayMode.descSize,
              'text-muted-foreground line-clamp-2 px-3',
              !isUnlocked && 'italic opacity-70'
            )}
          >
            {badge.description}
          </p>
        )}
      </CardContent>

      {/* Gradient overlay subtil pour badges unlocked */}
      {isUnlocked && (
        <div
          className={cn(
            'absolute inset-0 bg-gradient-to-t from-black/5 to-transparent pointer-events-none',
            'opacity-0 group-hover:opacity-100 transition-opacity duration-300'
          )}
        />
      )}
    </Card>
  );

  // Dialog avec détails complets pour mode compact (lycee/college)
  if (mode === 'lycee' || mode === 'college') {
    return (
      <Dialog>
        <DialogTrigger asChild>
          {content}
        </DialogTrigger>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <span className="text-3xl">{isUnlocked ? visualConfig.icon : '🔒'}</span>
              <span>{badge.name}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {badge.description}
            </p>

            <div className="flex items-center gap-2">
              <UIBadge
                variant="secondary"
                className={cn(
                  'text-xs font-medium',
                  isUnlocked ? categoryConfig.color : 'text-muted-foreground'
                )}
              >
                {categoryConfig.icon} {categoryConfig.name}
              </UIBadge>
            </div>

            {isUnlocked && badge.unlockedAt && (
              <div className="rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-3">
                <p className="text-sm text-green-700 dark:text-green-400 font-medium">
                  ✅ Débloqué le {formatDate(badge.unlockedAt)}
                </p>
              </div>
            )}

            {!isUnlocked && (
              <div className="rounded-lg bg-muted/50 border border-muted-foreground/20 p-3">
                <p className="text-sm text-muted-foreground italic">
                  🔒 Badge verrouillé - Continue à étudier pour le débloquer !
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Mode primary: tout affiché directement sans dialog
  return content;
}

/**
 * Vérifie si un badge a été débloqué récemment (< 7 jours)
 */
function isRecentlyUnlocked(unlockedAt: string): boolean {
  const unlockedDate = new Date(unlockedAt);
  const now = new Date();
  const diffMs = now.getTime() - unlockedDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays <= 7;
}

/**
 * Formate une date pour affichage français
 */
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(date);
}
