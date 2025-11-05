/**
 * ChatError - Molecule error state
 *
 * Design 2025 : glassmorphism, animations, micro-interactions
 */

import { type ReactElement } from 'react';
import { AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface ChatErrorProps {
  error: string;
  className?: string;
}

export function ChatError({ error, className }: ChatErrorProps): ReactElement {
  return (
    <Card
      className={cn(
        // Glassmorphism base
        'backdrop-blur-md bg-gradient-to-br from-destructive/10 to-destructive/5',
        'border border-destructive/30',
        // Shadows and depth
        'shadow-lg shadow-destructive/10',
        // Animations
        'animate-in fade-in slide-in-from-top-2 duration-300',
        'mb-4',
        className
      )}
    >
      <CardContent className="flex items-start gap-3 pt-4">
        <div className="relative">
          <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
          {/* Pulse effect */}
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
