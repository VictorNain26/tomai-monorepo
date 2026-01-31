/**
 * TomAI Style Constants - 2026
 *
 * Use these instead of NativeWind opacity/shadow classes to avoid
 * the navigation context race condition bug.
 *
 * @see https://github.com/nativewind/nativewind/issues/1536
 *
 * PROBLEMATIC CLASSES (DO NOT USE):
 * - shadow-* (shadow-sm, shadow-md, shadow-lg)
 * - bg-color/opacity (bg-primary/10, bg-destructive/10)
 * - text-color/opacity (text-white/80)
 * - border-color/opacity (border-primary/30)
 * - opacity-* (opacity-50)
 *
 * USE THESE INLINE STYLES INSTEAD
 */

import { type ViewStyle, type TextStyle } from 'react-native';

// ============================================================================
// COLOR PALETTE - Raw values for inline styles
// Matches global.css CSS variables
// ============================================================================

export const colors = {
  // Primary - Deep Blue
  primary: {
    DEFAULT: '#2563EB',     // hsl(221, 83%, 53%)
    light: '#3B82F6',       // For dark mode
    foreground: '#F8FAFC',
  },

  // Success - Sober Green
  success: {
    DEFAULT: '#059669',     // hsl(160, 84%, 39%)
    foreground: '#FFFFFF',
  },

  // Warning - Soft Orange
  warning: {
    DEFAULT: '#D97706',     // hsl(32, 95%, 44%)
    foreground: '#FFFFFF',
  },

  // Destructive - Discreet Red
  destructive: {
    DEFAULT: '#DC2626',     // hsl(0, 72%, 51%)
    dark: '#991B1B',        // For dark mode
    foreground: '#FFFFFF',
  },

  // Info - Calm Blue
  info: {
    DEFAULT: '#0EA5E9',     // hsl(199, 89%, 48%)
    foreground: '#FFFFFF',
  },

  // Muted - Gray
  muted: {
    DEFAULT: '#F3F4F6',
    foreground: '#6B7280',
  },

  // Background
  background: {
    light: '#FAFAF9',       // Warm white
    dark: '#1F2937',        // Dark gray
  },

  // Foreground (text)
  foreground: {
    light: '#1F2937',       // Dark gray
    dark: '#F8FAFC',        // Light
  },

  // Border
  border: {
    light: '#E5E7EB',
    dark: '#4B5563',
  },
} as const;

// ============================================================================
// SHADOWS (replace shadow-sm, shadow-md, shadow-lg)
// ============================================================================

export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  } as ViewStyle,

  xs: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 1,
    elevation: 1,
  } as ViewStyle,

  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  } as ViewStyle,

  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  } as ViewStyle,

  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  } as ViewStyle,

  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  } as ViewStyle,
};

// ============================================================================
// BACKGROUND COLORS WITH OPACITY (replace bg-color/10, bg-color/50, etc.)
// ============================================================================

export const bgColors = {
  // Primary variants (Deep Blue)
  primary: {
    5: 'rgba(37, 99, 235, 0.05)',
    10: 'rgba(37, 99, 235, 0.1)',
    15: 'rgba(37, 99, 235, 0.15)',
    20: 'rgba(37, 99, 235, 0.2)',
    30: 'rgba(37, 99, 235, 0.3)',
  },

  // Success (Sober Green)
  success: {
    5: 'rgba(5, 150, 105, 0.05)',
    10: 'rgba(5, 150, 105, 0.1)',
    15: 'rgba(5, 150, 105, 0.15)',
    20: 'rgba(5, 150, 105, 0.2)',
  },

  // Warning (Soft Orange)
  warning: {
    5: 'rgba(217, 119, 6, 0.05)',
    10: 'rgba(217, 119, 6, 0.1)',
    15: 'rgba(217, 119, 6, 0.15)',
    20: 'rgba(217, 119, 6, 0.2)',
  },

  // Destructive (Discreet Red)
  destructive: {
    5: 'rgba(220, 38, 38, 0.05)',
    10: 'rgba(220, 38, 38, 0.1)',
    15: 'rgba(220, 38, 38, 0.15)',
    20: 'rgba(220, 38, 38, 0.2)',
  },

  // Info (Calm Blue)
  info: {
    5: 'rgba(14, 165, 233, 0.05)',
    10: 'rgba(14, 165, 233, 0.1)',
    15: 'rgba(14, 165, 233, 0.15)',
    20: 'rgba(14, 165, 233, 0.2)',
  },

  // Muted (Gray)
  muted: {
    30: 'rgba(107, 114, 128, 0.3)',
    50: 'rgba(107, 114, 128, 0.5)',
  },

  // Black overlay (for modals, etc.)
  black: {
    30: 'rgba(0, 0, 0, 0.3)',
    50: 'rgba(0, 0, 0, 0.5)',
    60: 'rgba(0, 0, 0, 0.6)',
  },

  // White overlay
  white: {
    80: 'rgba(255, 255, 255, 0.8)',
    90: 'rgba(255, 255, 255, 0.9)',
  },

  // Background
  background: {
    5: 'rgba(250, 250, 249, 0.05)',
    10: 'rgba(250, 250, 249, 0.1)',
    20: 'rgba(250, 250, 249, 0.2)',
    90: 'rgba(250, 250, 249, 0.9)',
  },
};

// ============================================================================
// BORDER COLORS WITH OPACITY
// ============================================================================

export const borderColors = {
  primary: {
    20: 'rgba(37, 99, 235, 0.2)',
    30: 'rgba(37, 99, 235, 0.3)',
    50: 'rgba(37, 99, 235, 0.5)',
  },
  success: {
    20: 'rgba(5, 150, 105, 0.2)',
    30: 'rgba(5, 150, 105, 0.3)',
  },
  warning: {
    20: 'rgba(217, 119, 6, 0.2)',
    30: 'rgba(217, 119, 6, 0.3)',
  },
  destructive: {
    20: 'rgba(220, 38, 38, 0.2)',
    30: 'rgba(220, 38, 38, 0.3)',
  },
  info: {
    20: 'rgba(14, 165, 233, 0.2)',
    30: 'rgba(14, 165, 233, 0.3)',
  },
  muted: {
    20: 'rgba(107, 114, 128, 0.2)',
    30: 'rgba(107, 114, 128, 0.3)',
  },
};

// ============================================================================
// TEXT COLORS WITH OPACITY
// ============================================================================

export const textColors = {
  primary: {
    80: 'rgba(37, 99, 235, 0.8)',
  },
  success: {
    80: 'rgba(5, 150, 105, 0.8)',
  },
  muted: {
    60: 'rgba(107, 114, 128, 0.6)',
    80: 'rgba(107, 114, 128, 0.8)',
  },
};

// ============================================================================
// OPACITY VALUES
// ============================================================================

export const opacity = {
  disabled: 0.5,
  hover: 0.85,
  active: 0.9,
  pressed: 0.7,
};

// ============================================================================
// SPACING CONSTANTS (for consistency)
// ============================================================================

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
} as const;

// ============================================================================
// COMMON STYLE COMBINATIONS
// ============================================================================

/**
 * Card style with shadow
 */
export const cardStyle: ViewStyle = {
  backgroundColor: '#FFFFFF',
  borderRadius: 12,
  ...shadows.sm,
};

/**
 * Card style for dark mode
 */
export const cardStyleDark: ViewStyle = {
  backgroundColor: '#374151',
  borderRadius: 12,
  ...shadows.md,
};

/**
 * Get card style based on dark mode
 */
export function getCardStyle(isDark: boolean): ViewStyle {
  return isDark ? cardStyleDark : cardStyle;
}

/**
 * Status badge styles
 */
export const statusBadgeStyles = {
  success: {
    container: {
      backgroundColor: bgColors.success[10],
      borderColor: borderColors.success[20],
      borderWidth: 1,
    } as ViewStyle,
    text: {
      color: colors.success.DEFAULT,
    } as TextStyle,
  },
  warning: {
    container: {
      backgroundColor: bgColors.warning[10],
      borderColor: borderColors.warning[20],
      borderWidth: 1,
    } as ViewStyle,
    text: {
      color: colors.warning.DEFAULT,
    } as TextStyle,
  },
  destructive: {
    container: {
      backgroundColor: bgColors.destructive[10],
      borderColor: borderColors.destructive[20],
      borderWidth: 1,
    } as ViewStyle,
    text: {
      color: colors.destructive.DEFAULT,
    } as TextStyle,
  },
  info: {
    container: {
      backgroundColor: bgColors.info[10],
      borderColor: borderColors.info[20],
      borderWidth: 1,
    } as ViewStyle,
    text: {
      color: colors.info.DEFAULT,
    } as TextStyle,
  },
};
