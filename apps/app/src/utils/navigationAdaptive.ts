/**
 * Navigation Adaptive Utilities for Tom Educational Platform
 * Age-appropriate navigation configurations and accessibility enhancements
 */

import type { UIMode } from './uiModeSystem';
import type { UserRoleType } from '@/types';

export interface NavigationConfig {
  touchTargetSize: string;
  spacing: string;
  fontSize: string;
  iconSize: string;
  animationDuration: string;
  focusRingSize: string;
  borderRadius: string;
  padding: string;
  fontWeight: string;
  letterSpacing: string;
  accessibility: {
    forcedColors: string;
    highContrast: string;
    reducedMotion: string;
    largeText: string;
  };
}

export interface AccessibilityMode {
  highContrast: boolean;
  largeText: boolean;
  reducedMotion: boolean;
  forcedColors: boolean;
  audioFeedback: boolean;
  keyboardOnly: boolean;
}

/**
 * Gets age-appropriate navigation configuration
 */
export const getNavigationConfig = (mode: UIMode): NavigationConfig => {
  const configs: Record<UIMode, NavigationConfig> = {
    primary: {
      touchTargetSize: 'min-h-[52px]', // Plus grand pour 6-10 ans
      spacing: 'space-y-4',
      fontSize: 'text-lg',
      iconSize: 'w-6 h-6',
      animationDuration: 'duration-300',
      focusRingSize: 'focus:ring-4',
      borderRadius: 'rounded-2xl',
      padding: 'px-6 py-4',
      fontWeight: 'font-bold',
      letterSpacing: 'tracking-wide',
      accessibility: {
        forcedColors: 'forced-colors:bg-ButtonFace forced-colors:text-ButtonText',
        highContrast: 'contrast-more:bg-black contrast-more:text-white contrast-more:border-white',
        reducedMotion: 'motion-reduce:transition-none motion-reduce:transform-none',
        largeText: 'text-xl leading-relaxed'
      }
    },
    college: {
      touchTargetSize: 'min-h-[48px]', // Intermédiaire 11-14 ans
      spacing: 'space-y-3',
      fontSize: 'text-base',
      iconSize: 'w-5 h-5',
      animationDuration: 'duration-250',
      focusRingSize: 'focus:ring-3',
      borderRadius: 'rounded-xl',
      padding: 'px-5 py-3',
      fontWeight: 'font-semibold',
      letterSpacing: 'tracking-normal',
      accessibility: {
        forcedColors: 'forced-colors:bg-ButtonFace forced-colors:text-ButtonText',
        highContrast: 'contrast-more:bg-background contrast-more:text-foreground contrast-more:border-foreground',
        reducedMotion: 'motion-reduce:transition-none',
        largeText: 'text-lg leading-relaxed'
      }
    },
    lycee: {
      touchTargetSize: 'min-h-[44px]', // Standard 15-18 ans
      spacing: 'space-y-2',
      fontSize: 'text-sm',
      iconSize: 'w-5 h-5',
      animationDuration: 'duration-200',
      focusRingSize: 'focus:ring-2',
      borderRadius: 'rounded-lg',
      padding: 'px-4 py-2.5',
      fontWeight: 'font-medium',
      letterSpacing: 'tracking-normal',
      accessibility: {
        forcedColors: 'forced-colors:bg-ButtonFace forced-colors:text-ButtonText',
        highContrast: 'contrast-more:bg-background contrast-more:text-foreground',
        reducedMotion: 'motion-reduce:transition-none',
        largeText: 'text-base leading-relaxed'
      }
    }
  };

  return configs[mode];
};

/**
 * Gets role and age combined navigation styles
 */
export const getCombinedNavigationStyles = (
  mode: UIMode,
  role: UserRoleType,
  accessibilityMode?: Partial<AccessibilityMode>
) => {
  const navConfig = getNavigationConfig(mode);
  const isAccessible = accessibilityMode?.highContrast ?? accessibilityMode?.largeText;

  return {
    container: `
      ${navConfig.spacing}
      ${accessibilityMode?.reducedMotion ? navConfig.accessibility.reducedMotion : ''}
      ${isAccessible ? navConfig.accessibility.highContrast : ''}
    `,
    menuItem: `
      ${navConfig.touchTargetSize}
      ${navConfig.padding}
      ${navConfig.borderRadius}
      ${navConfig.fontSize}
      ${navConfig.fontWeight}
      ${navConfig.letterSpacing}
      ${navConfig.focusRingSize}
      ${accessibilityMode?.largeText ? navConfig.accessibility.largeText : ''}
      ${accessibilityMode?.forcedColors ? navConfig.accessibility.forcedColors : ''}
      transition-all ${accessibilityMode?.reducedMotion ? 'duration-0' : navConfig.animationDuration}
      focus:outline-none focus:ring-offset-2
      group
    `,
    icon: `
      ${navConfig.iconSize}
      shrink-0
      transition-transform ${accessibilityMode?.reducedMotion ? 'duration-0' : navConfig.animationDuration}
      group-hover:scale-110
      ${accessibilityMode?.reducedMotion ? '' : 'group-hover:scale-110'}
    `,
    label: `
      ${navConfig.fontSize}
      ${navConfig.fontWeight}
      ${navConfig.letterSpacing}
      ${accessibilityMode?.largeText ? navConfig.accessibility.largeText : ''}
      transition-colors ${accessibilityMode?.reducedMotion ? 'duration-0' : navConfig.animationDuration}
    `
  };
};

/**
 * Touch gesture configuration for mobile navigation
 */
export const getTouchGestureConfig = (mode: UIMode) => {
  return {
    swipeThreshold: mode === 'primary' ? 100 : 80, // Distance minimum pour déclencher swipe
    swipeTimeout: mode === 'primary' ? 500 : 300,   // Temps maximum pour swipe
    tapDelay: mode === 'primary' ? 200 : 150,       // Délai pour double-tap
    longPressDelay: mode === 'primary' ? 800 : 600, // Délai pour press & hold
    gesturesEnabled: {
      swipeLeft: true,   // Navigation suivante
      swipeRight: true,  // Navigation précédente
      swipeUp: true,     // Fermer menu mobile
      swipeDown: false,  // Désactivé pour éviter conflits scroll
      longPress: true,   // Raccourcis contextuels
      doubleTap: mode !== 'primary' // Désactivé pour primaire (confusion)
    }
  };
};

/**
 * Performance optimization configuration
 */
export const getPerformanceConfig = (mode: UIMode) => {
  return {
    lazyLoading: {
      enabled: true,
      threshold: mode === 'primary' ? '50px' : '100px', // Plus tôt pour primaires
      rootMargin: '50px'
    },
    preloading: {
      adjacentRoutes: true,
      maxRoutes: mode === 'primary' ? 2 : 3,
      strategy: 'idle' // Preload during idle time
    },
    animations: {
      reduceMotion: false, // Contrôlé par préférence utilisateur
      duration: mode === 'primary' ? 300 : 200,
      easing: 'ease-out'
    },
    caching: {
      navigationPreferences: true,
      userSettings: true,
      ttl: 24 * 60 * 60 * 1000 // 24 hours
    }
  };
};

export default {
  getNavigationConfig,
  getCombinedNavigationStyles,
  getTouchGestureConfig,
  getPerformanceConfig
};
