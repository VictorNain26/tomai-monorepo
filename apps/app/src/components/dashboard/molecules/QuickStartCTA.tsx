/**
 * QuickStartCTA - Session en Cours (Moderne)
 *
 * Design 2025 : aéré, glassmorphism, icônes lucide-react, responsive
 * Action primaire : continuer session OU nouvelle matière.
 */

import { type ReactElement } from 'react';
import { Play, ArrowRight, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { getSubjectIcon } from '@/constants/subjectIcons';
import type { EducationSubject, IStudySession } from '@/types';

export interface QuickStartCTAProps {
  suggestedSubject: EducationSubject | null;
  recentSession: IStudySession | null;
  onStartNew: (subjectKey: string) => void;
  onContinueSession: (sessionId: string) => void;
  mode?: 'primary' | 'college' | 'lycee';
  className?: string | undefined;
}

export function QuickStartCTA({
  suggestedSubject,
  recentSession,
  onStartNew,
  onContinueSession,
  mode = 'lycee',
  className
}: QuickStartCTAProps): ReactElement | null {
  if (!suggestedSubject) return null;

  const iconConfig = getSubjectIcon(suggestedSubject.key);
  const IconComponent = iconConfig.icon;

  // Session récente : CTA principal "Continuer"
  if (recentSession) {
    return (
      <Card
        className={cn(
          'relative overflow-hidden border-2',
          'bg-gradient-to-r from-primary/10 via-primary/5 to-background',
          'border-primary/30 backdrop-blur-sm',
          'hover:border-primary/50 hover:shadow-2xl',
          'transition-all duration-300',
          className
        )}
      >
        {/* Glow effect background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-50" />

        {/* Indicator animated */}
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary via-primary/80 to-primary/40 animate-pulse" />

        <CardContent className="relative p-5 md:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            {/* Icône matière avec animation */}
            <div
              className={cn(
                'flex-shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-2xl',
                iconConfig.bgColor,
                'border-2 border-primary/30',
                'flex items-center justify-center',
                'shadow-lg transition-transform duration-300 hover:scale-105'
              )}
            >
              <IconComponent
                className={cn(
                  'w-8 h-8 md:w-10 md:h-10',
                  iconConfig.color,
                  'stroke-[1.5]'
                )}
              />
            </div>

            {/* Info matière */}
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                <p className="text-xs md:text-sm font-medium text-primary uppercase tracking-wide">
                  {mode === 'primary' ? 'Dernière session' : 'Session en cours'}
                </p>
              </div>
              <h3 className="font-bold text-xl md:text-2xl text-foreground leading-tight">
                {suggestedSubject.name}
              </h3>
              {suggestedSubject.description && (
                <p className="text-sm text-muted-foreground line-clamp-1">
                  {suggestedSubject.description}
                </p>
              )}
            </div>

            {/* Action button */}
            <Button
              size="lg"
              onClick={() => onContinueSession(recentSession.id)}
              className={cn(
                'gap-2 min-h-[48px] font-semibold shadow-lg',
                'hover:scale-105 transition-transform',
                'px-6 md:px-8'
              )}
            >
              <Play className="h-5 w-5" />
              {mode === 'primary' ? 'Continuer' : 'Reprendre'}
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Pas de session : CTA "Commencer" avec matière suggérée
  return (
    <Card
      className={cn(
        'relative overflow-hidden border-2',
        'bg-gradient-to-r from-primary/5 via-background to-background',
        'border-primary/20 backdrop-blur-sm',
        'hover:border-primary/40 hover:shadow-lg',
        'transition-all duration-300',
        className
      )}
    >
      {/* Subtle glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-30" />

      <CardContent className="relative p-5 md:p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          {/* Icône matière */}
          <div
            className={cn(
              'flex-shrink-0 w-14 h-14 md:w-16 md:h-16 rounded-xl',
              iconConfig.bgColor,
              'border border-primary/20',
              'flex items-center justify-center',
              'transition-transform duration-300 hover:scale-105'
            )}
          >
            <IconComponent
              className={cn(
                'w-7 h-7 md:w-8 md:h-8',
                iconConfig.color,
                'stroke-[1.5]'
              )}
            />
          </div>

          {/* Info matière */}
          <div className="flex-1 min-w-0 space-y-1">
            <p className="text-xs md:text-sm text-muted-foreground">
              {mode === 'primary' ? '✨ Matière suggérée' : 'Suggestion du jour'}
            </p>
            <h3 className="font-semibold text-lg md:text-xl text-foreground leading-tight">
              {suggestedSubject.name}
            </h3>
            {suggestedSubject.description && (
              <p className="text-xs md:text-sm text-muted-foreground line-clamp-1">
                {suggestedSubject.description}
              </p>
            )}
          </div>

          {/* Action button */}
          <Button
            size="lg"
            onClick={() => onStartNew(suggestedSubject.key)}
            className={cn(
              'gap-2 min-h-[48px] font-semibold',
              'hover:scale-105 transition-transform',
              'px-6 md:px-8'
            )}
          >
            {mode === 'primary' ? 'Démarrer' : 'Commencer'}
            <ArrowRight className="h-5 w-5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
