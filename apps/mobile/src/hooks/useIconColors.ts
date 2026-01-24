/**
 * useIconColors Hook
 *
 * Provides semantic icon colors that respond to theme changes.
 * Centralizes all icon colors using CSS variables from global.css.
 */

import { useMemo } from 'react';
import { useTheme } from './useTheme';

// ============================================================================
// TYPES
// ============================================================================

export interface IconColors {
  /** Default foreground color for icons */
  foreground: string;
  /** Muted color for secondary icons */
  muted: string;
  /** Primary brand color */
  primary: string;
  /** Error/destructive color */
  destructive: string;
  /** Success color */
  success: string;
  /** Warning color */
  warning: string;
  /** White color (for icons on colored backgrounds) */
  white: string;
}

// ============================================================================
// COLOR DEFINITIONS
// ============================================================================

// Light mode colors (matching global.css :root)
const LIGHT_COLORS: IconColors = {
  foreground: 'hsl(222.2, 47.4%, 11.2%)',
  muted: 'hsl(215.4, 16.3%, 46.9%)',
  primary: 'hsl(222.2, 47.4%, 11.2%)',
  destructive: 'hsl(0, 84.2%, 60.2%)',
  success: 'hsl(142, 76%, 36%)',
  warning: 'hsl(43, 96%, 56%)',
  white: 'hsl(0, 0%, 100%)',
};

// Dark mode colors (matching global.css .dark)
const DARK_COLORS: IconColors = {
  foreground: 'hsl(210, 40%, 98%)',
  muted: 'hsl(215, 20.2%, 65.1%)',
  primary: 'hsl(210, 40%, 98%)',
  destructive: 'hsl(0, 62.8%, 30.6%)',
  success: 'hsl(142, 76%, 46%)',
  warning: 'hsl(43, 96%, 66%)',
  white: 'hsl(0, 0%, 100%)',
};

// ============================================================================
// HOOK
// ============================================================================

export function useIconColors(): IconColors {
  const { isDark } = useTheme();

  return useMemo(() => (isDark ? DARK_COLORS : LIGHT_COLORS), [isDark]);
}
