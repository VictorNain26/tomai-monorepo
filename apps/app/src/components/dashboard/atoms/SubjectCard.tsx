/**
 * SubjectCard - Carte Matière Moderne avec Icônes
 *
 * Design 2025 : aéré, responsive, icônes lucide-react, micro-interactions fluides
 * Optimisé pour affichage grille moderne.
 */

import { type ReactElement } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { getSubjectIcon } from '@/constants/subjectIcons';
import type { EducationSubject } from '@/types';

export interface SubjectCardProps {
  subject: EducationSubject;
  onClick: () => void;
  mode?: 'primary' | 'college' | 'lycee';
  className?: string;
}

const MODE_STYLES = {
  primary: {
    padding: 'p-6',
    iconSize: 'w-12 h-12',
    iconStroke: 'stroke-[1.5]',
    titleSize: 'text-lg',
    descSize: 'text-sm'
  },
  college: {
    padding: 'p-5',
    iconSize: 'w-10 h-10',
    iconStroke: 'stroke-[1.5]',
    titleSize: 'text-base',
    descSize: 'text-xs'
  },
  lycee: {
    padding: 'p-4',
    iconSize: 'w-8 h-8',
    iconStroke: 'stroke-2',
    titleSize: 'text-sm',
    descSize: 'text-xs'
  }
};

export function SubjectCard({
  subject,
  onClick,
  mode = 'lycee',
  className
}: SubjectCardProps): ReactElement {
  const modeStyle = MODE_STYLES[mode];
  const iconConfig = getSubjectIcon(subject.key);
  const IconComponent = iconConfig.icon;

  return (
    <Card
      onClick={onClick}
      className={cn(
        'group relative overflow-hidden cursor-pointer',
        'border border-border/50 bg-card/50 backdrop-blur-sm',
        'transition-all duration-300 ease-out',
        'hover:border-primary/50 hover:shadow-2xl hover:-translate-y-2',
        'hover:bg-card/90 hover:backdrop-blur-md',
        'active:scale-[0.97]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
        className
      )}
      tabIndex={0}
      role="button"
      aria-label={`Commencer ${subject.name}`}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {/* Gradient hover overlay subtil */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-primary/3 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      {/* Accent border animé en bas */}
      <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-primary/0 via-primary to-primary/0 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500" />

      <CardContent className={cn('relative flex flex-col items-center text-center space-y-4', modeStyle.padding)}>
        {/* Icône container avec animation */}
        <div
          className={cn(
            'flex items-center justify-center rounded-2xl',
            iconConfig.bgColor,
            'border-2 border-transparent',
            'transition-all duration-300',
            'group-hover:scale-110 group-hover:rotate-6',
            'group-hover:shadow-xl',
            'p-4',
            mode === 'primary' && 'p-5'
          )}
        >
          <IconComponent
            className={cn(
              modeStyle.iconSize,
              modeStyle.iconStroke,
              iconConfig.color,
              'transition-transform duration-300 group-hover:scale-105'
            )}
          />
        </div>

        {/* Titre matière */}
        <h3
          className={cn(
            'font-semibold text-foreground leading-tight w-full',
            'group-hover:text-primary transition-colors duration-300',
            modeStyle.titleSize
          )}
        >
          {subject.name}
        </h3>

        {/* Description avec line-clamp */}
        {subject.description && (
          <p
            className={cn(
              'text-muted-foreground leading-relaxed line-clamp-2 w-full',
              modeStyle.descSize,
              'opacity-90 group-hover:opacity-100 transition-opacity duration-300'
            )}
          >
            {subject.description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
