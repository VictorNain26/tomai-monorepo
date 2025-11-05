/**
 * FilterChip - Chip Filtre Catégorie
 *
 * Chip moderne avec animation toggle, count badge, micro-interactions.
 * Utilisé pour les filtres de badges par catégorie.
 */

import { type ReactElement } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface FilterChipProps {
  label: string;
  count: number;
  icon?: string | undefined;
  isActive: boolean;
  onClick: () => void;
  className?: string | undefined;
}

export function FilterChip({
  label,
  count,
  icon,
  isActive,
  onClick,
  className
}: FilterChipProps): ReactElement {
  return (
    <Button
      variant={isActive ? 'default' : 'outline'}
      size="default"
      onClick={onClick}
      className={cn(
        'relative flex-shrink-0 snap-start min-h-[44px] px-4 gap-2',
        'transition-all duration-300 ease-out',
        'group',
        !isActive && [
          'bg-card/50 backdrop-blur-sm',
          'border-border/50',
          'hover:border-primary/50 hover:bg-primary/5',
          'hover:shadow-md hover:-translate-y-0.5'
        ],
        isActive && [
          'bg-gradient-to-br from-primary to-primary/90',
          'shadow-lg shadow-primary/25',
          'hover:shadow-xl hover:shadow-primary/30',
          'hover:scale-105'
        ],
        className
      )}
    >
      {/* Icon emoji si présent */}
      {icon && (
        <span
          className={cn(
            'text-base transition-transform duration-200',
            'group-hover:scale-110 group-hover:rotate-12'
          )}
        >
          {icon}
        </span>
      )}

      {/* Label */}
      <span className="font-medium text-sm">
        {label}
      </span>

      {/* Count badge avec animation */}
      <span
        className={cn(
          'inline-flex items-center justify-center',
          'min-w-[20px] h-5 px-1.5 rounded-full',
          'text-xs font-semibold',
          'transition-all duration-200',
          isActive ? [
            'bg-primary-foreground/20 text-primary-foreground'
          ] : [
            'bg-muted text-muted-foreground',
            'group-hover:bg-primary/10 group-hover:text-primary'
          ]
        )}
      >
        {count}
      </span>

      {/* Active indicator */}
      {isActive && (
        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-primary-foreground/30" />
      )}
    </Button>
  );
}
