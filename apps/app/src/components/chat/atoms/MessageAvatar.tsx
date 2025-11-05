/**
 * MessageAvatar - Avatar Atom pour messages chat
 *
 * Design 2025 : gradients vibrants, glow effects, micro-interactions
 * Utilise le système de couleurs centralisé (config/theme.ts)
 */

import { type ReactElement } from 'react';
import { User, Brain } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getRoleGradient } from '@/config/theme';

export interface MessageAvatarProps {
  role: 'user' | 'assistant';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function MessageAvatar({
  role,
  size = 'md',
  className
}: MessageAvatarProps): ReactElement {
  const isUser = role === 'user';

  const sizeClasses = {
    sm: 'w-6 h-6 p-1',
    md: 'w-8 h-8 p-1.5',
    lg: 'w-10 h-10 p-2'
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5'
  };

  return (
    <div
      className={cn(
        // Base styling
        'rounded-full transition-all duration-300',
        // User avatar (Primary/Parent blue)
        isUser && [
          'ring-2 ring-background shadow-xl',
          `bg-gradient-to-br ${getRoleGradient('parent')}`,
          'hover:scale-110 hover:shadow-2xl',
          'hover:ring-4 hover:ring-primary/20'
        ],
        // Assistant avatar (Purple IA - pas de border)
        !isUser && [
          'shadow-xl',
          `bg-gradient-to-br ${getRoleGradient('assistant')}`,
          'hover:scale-105 hover:shadow-lg'
        ],
        sizeClasses[size],
        className
      )}
    >
      {isUser ? (
        <User className={cn(iconSizes[size], 'text-primary-foreground')} />
      ) : (
        <Brain className={cn(iconSizes[size], 'text-white')} />
      )}
    </div>
  );
}
