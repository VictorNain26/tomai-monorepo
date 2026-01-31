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

// Light mode colors (matching global.css :root exactly)
const LIGHT_COLORS: IconColors = {
  foreground: 'hsl(220, 14%, 17%)',       // --color-foreground
  muted: 'hsl(220, 9%, 46%)',             // --color-muted-foreground
  primary: 'hsl(221, 83%, 53%)',          // --color-primary
  destructive: 'hsl(0, 72%, 51%)',        // --color-destructive
  success: 'hsl(160, 84%, 39%)',          // --color-success
  warning: 'hsl(32, 95%, 44%)',           // --color-warning
  white: 'hsl(0, 0%, 100%)',
};

// Dark mode colors (matching global.css .dark exactly)
const DARK_COLORS: IconColors = {
  foreground: 'hsl(210, 40%, 98%)',       // --color-foreground
  muted: 'hsl(218, 11%, 65%)',            // --color-muted-foreground
  primary: 'hsl(217, 91%, 60%)',          // --color-primary
  destructive: 'hsl(0, 63%, 31%)',        // --color-destructive
  success: 'hsl(160, 84%, 39%)',          // --color-success
  warning: 'hsl(32, 95%, 44%)',           // --color-warning
  white: 'hsl(0, 0%, 100%)',
};

// ============================================================================
// HOOK
// ============================================================================

export function useIconColors(): IconColors {
  const { isDark } = useTheme();

  return useMemo(() => (isDark ? DARK_COLORS : LIGHT_COLORS), [isDark]);
}
