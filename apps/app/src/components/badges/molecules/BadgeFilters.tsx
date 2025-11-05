/**
 * BadgeFilters - Filtres de Badges par Catégorie
 *
 * Molecule composant plusieurs FilterChips en scroll horizontal.
 * Optimisé mobile avec snap scrolling et responsive desktop.
 */

import { type ReactElement } from 'react';
import { FilterChip } from '@/components/badges/atoms/FilterChip';
import { cn } from '@/lib/utils';

export type BadgeCategory = 'all' | 'progression' | 'engagement' | 'special';

export interface BadgeFilter {
  key: BadgeCategory;
  label: string;
  icon?: string;
  count: number;
}

export interface BadgeFiltersProps {
  filters: BadgeFilter[];
  activeFilter: BadgeCategory;
  onFilterChange: (filter: BadgeCategory) => void;
  className?: string;
}

export function BadgeFilters({
  filters,
  activeFilter,
  onFilterChange,
  className
}: BadgeFiltersProps): ReactElement {
  return (
    <div
      className={cn(
        'flex gap-2 overflow-x-auto pb-2 snap-x snap-mandatory',
        'md:flex-wrap md:overflow-visible',
        // Hide scrollbar on desktop
        'scrollbar-none md:scrollbar-default',
        className
      )}
    >
      {filters.map((filter) => (
        <FilterChip
          key={filter.key}
          label={filter.label}
          count={filter.count}
          icon={filter.icon}
          isActive={activeFilter === filter.key}
          onClick={() => onFilterChange(filter.key)}
        />
      ))}
    </div>
  );
}
