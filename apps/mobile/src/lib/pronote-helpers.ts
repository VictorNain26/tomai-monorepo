/**
 * Pronote Helpers - Shared utilities for grades and homework
 *
 * Consolidates duplicate code from student and parent screens.
 */

import { bgColors, borderColors } from '@/lib/styles';
import type { ThemeColors } from '@/hooks/useThemeColors';

// ============================================================================
// TYPES
// ============================================================================

export interface GradeStyle {
  textColor: string;
  bgColor: string;
  borderColor: string;
}

// ============================================================================
// DATE HELPERS
// ============================================================================

/**
 * Format date for grades display (e.g., "12 janv.")
 */
export function formatDateShort(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  });
}

/**
 * Format date for homework display (e.g., "lun. 12 janv.")
 */
export function formatDateWithDay(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
}

/**
 * Check if homework is overdue
 */
export function isOverdue(dateStr: string, done: boolean): boolean {
  if (done) return false;
  const dueDate = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return dueDate < today;
}

/**
 * Get days until due date
 */
export function getDaysUntil(dateStr: string): number {
  const dueDate = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  dueDate.setHours(0, 0, 0, 0);
  return Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// ============================================================================
// GRADE HELPERS
// ============================================================================

/**
 * Get styling for a grade based on its value (inline styles)
 */
export function getGradeStyle(value: number | null, outOf: number, colors: ThemeColors): GradeStyle {
  if (value === null || outOf === 0) {
    return {
      textColor: colors.muted,
      bgColor: bgColors.muted[50],
      borderColor: borderColors.muted[20],
    };
  }
  const percent = (value / outOf) * 100;
  if (percent >= 80) {
    return {
      textColor: colors.success,
      bgColor: bgColors.success[10],
      borderColor: borderColors.success[30],
    };
  }
  if (percent >= 60) {
    return {
      textColor: colors.primary,
      bgColor: bgColors.primary[10],
      borderColor: borderColors.primary[30],
    };
  }
  if (percent >= 40) {
    return {
      textColor: colors.warning,
      bgColor: bgColors.warning[10],
      borderColor: borderColors.warning[30],
    };
  }
  return {
    textColor: colors.destructive,
    bgColor: bgColors.destructive[10],
    borderColor: borderColors.destructive[30],
  };
}

/**
 * Check if a grade is low (needs review)
 */
export function isLowGrade(value: number | null, outOf: number): boolean {
  if (value === null || outOf === 0) return false;
  return (value / outOf) * 100 < 50;
}

// ============================================================================
// WEEK LABEL HELPER
// ============================================================================

/**
 * Get label for week offset
 */
export function getWeekLabel(weekOffset: number): string {
  if (weekOffset === 0) return 'Cette semaine';
  if (weekOffset === 1) return 'Semaine +1';
  if (weekOffset === -1) return 'Semaine -1';
  return `Semaine ${weekOffset > 0 ? '+' : ''}${weekOffset}`;
}
