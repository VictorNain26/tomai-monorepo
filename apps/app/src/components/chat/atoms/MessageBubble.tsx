/**
 * MessageBubble - Bubble Atom pour contenu messages
 *
 * ✨ UX MODERNE 2025: glassmorphism + gradients + design épuré
 */

import { type ReactElement, type ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { getRoleGradient } from '@/config/theme';

export interface MessageBubbleProps {
  role: 'user' | 'assistant';
  children: ReactNode;
  className?: string;
}

export function MessageBubble({
  role,
  children,
  className
}: MessageBubbleProps): ReactElement {
  const isUser = role === 'user';

  return (
    <Card
      className={cn(
        // Base glassmorphism avec transitions fluides
        'backdrop-blur-sm transition-all duration-300 ease-out',
        // Shadows subtiles pour depth professionnelle
        'shadow-md',
        // User messages (Primary/Parent blue gradient)
        isUser && [
          `bg-gradient-to-br ${getRoleGradient('parent')}`,
          'border-primary/30',
          // Ring focus effect moderne
          'focus-within:ring-2 focus-within:ring-primary/50 focus-within:ring-offset-2'
        ],
        // Assistant messages (accent border gauche)
        !isUser && [
          'bg-gradient-to-br from-card/95 to-muted/50',
          'border-l-4 border-l-assistant/50',
          // Ring focus effect moderne
          'focus-within:ring-2 focus-within:ring-assistant/50 focus-within:ring-offset-2'
        ],
        className
      )}
    >
      <CardContent className="pt-4 px-4 pb-3">
        {children}
      </CardContent>
    </Card>
  );
}
