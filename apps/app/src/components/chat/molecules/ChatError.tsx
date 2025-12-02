/**
 * ChatError - Molecule error state
 *
 * Design 2025 : glassmorphism, animations, micro-interactions
 * Supporte les erreurs de quota avec UX dédiée
 */

import { type ReactElement } from 'react';
import { AlertCircle, Clock, Sparkles } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface ChatErrorProps {
  error: string;
  className?: string;
}

export function ChatError({ error, className }: ChatErrorProps): ReactElement {
  // Détecter si c'est une erreur de quota
  const isQuotaError = error.toLowerCase().includes('quota') ||
                       error.toLowerCase().includes('réinitialisation');

  if (isQuotaError) {
    return (
      <Card
        className={cn(
          // Couleur plus douce pour quota (amber au lieu de destructive)
          'backdrop-blur-md bg-gradient-to-br from-amber-500/10 to-orange-500/5',
          'border border-amber-500/30',
          'shadow-lg shadow-amber-500/10',
          'animate-in fade-in slide-in-from-top-2 duration-300',
          'mb-4',
          className
        )}
      >
        <CardContent className="flex items-start gap-3 pt-4">
          <div className="relative">
            <Clock className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-amber-700">
              Tu as bien travaillé aujourd'hui ! 🌟
            </p>
            <p className="text-sm text-amber-600/90 mt-1">
              {error}
            </p>
            <div className="mt-3 flex items-center gap-2 text-xs text-amber-600/80">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Reviens demain pour continuer à apprendre !</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Erreur standard
  return (
    <Card
      className={cn(
        'backdrop-blur-md bg-gradient-to-br from-destructive/10 to-destructive/5',
        'border border-destructive/30',
        'shadow-lg shadow-destructive/10',
        'animate-in fade-in slide-in-from-top-2 duration-300',
        'mb-4',
        className
      )}
    >
      <CardContent className="flex items-start gap-3 pt-4">
        <div className="relative">
          <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
          <div className="absolute inset-0 rounded-full bg-destructive/20 animate-ping" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-destructive">
            Erreur
          </p>
          <p className="text-sm text-destructive/90 mt-1">
            {error}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
