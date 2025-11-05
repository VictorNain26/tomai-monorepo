/**
 * PageContainer - Conteneur Page Standard
 *
 * Wrapper standardisé pour toutes les pages avec padding et max-width.
 * Gère le scroll, l'espacement et la responsive.
 */

import { type ReactElement, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface PageContainerProps {
  children: ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | '7xl' | 'full';
  className?: string;
}

const MAX_WIDTH_CLASSES = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '4xl': 'max-w-4xl',
  '7xl': 'max-w-7xl',
  full: 'max-w-full'
} as const;

export function PageContainer({
  children,
  maxWidth = '7xl',
  className
}: PageContainerProps): ReactElement {
  return (
    <div className="h-full bg-background p-4 md:p-6 overflow-y-auto">
      <div className={cn('mx-auto space-y-6', MAX_WIDTH_CLASSES[maxWidth], className)}>
        {children}
      </div>
    </div>
  );
}
