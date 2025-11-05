/**
 * Navigation Adaptive Utilities for TomIA Educational Platform
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
 * Gets educational navigation shortcuts based on role and age
 */
export const getEducationalShortcuts = (mode: UIMode, role: UserRoleType) => {
  if (role === 'student') {
    const shortcuts = {
      primary: [
        { name: 'Parler avec TomIA', href: '/student/chat/new', key: 'c', icon: 'MessageCircle' },
        { name: 'Mes Discussions', href: '/student', key: 'h', icon: 'Home' }
      ],
      college: [
        { name: 'Nouvelle Session', href: '/student/chat/new', key: 'n', icon: 'Plus' },
        { name: 'Accueil', href: '/student', key: 'h', icon: 'Home' },
        { name: 'Mes Devoirs', href: '/student/homework', key: 'd', icon: 'BookOpen' }
      ],
      lycee: [
        { name: 'Nouvelle Session', href: '/student/chat/new', key: 'n', icon: 'Plus' },
        { name: 'Dashboard', href: '/student', key: 'h', icon: 'Home' },
        { name: 'Révisions', href: '/student/reviews', key: 'r', icon: 'BookOpen' },
        { name: 'Calendrier', href: '/student/calendar', key: 'c', icon: 'Calendar' }
      ]
    };
    return shortcuts[mode] || shortcuts.lycee;
  }

  // Parent shortcuts
  const parentShortcuts = [
    { name: 'Dashboard', href: '/parent', key: 'h', icon: 'BarChart3' },
    { name: 'Gérer Enfants', href: '/parent/children/manage', key: 'e', icon: 'UserPlus' },
    { name: 'Notifications', href: '/parent/notifications', key: 'n', icon: 'Bell' },
    { name: 'Rapports', href: '/parent/reports', key: 'r', icon: 'FileText' }
  ];

  return parentShortcuts;
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
 * Audio feedback configuration for accessibility
 */
export const getAudioFeedbackConfig = (mode: UIMode) => {
  return {
    enabled: true,
    sounds: {
      navigation: mode === 'primary' ? 'gentle-chime.mp3' : 'soft-click.mp3',
      success: mode === 'primary' ? 'success-bell.mp3' : 'success-tone.mp3',
      error: 'error-tone.mp3',
      focus: mode === 'primary' ? 'focus-chime.mp3' : null
    },
    volume: mode === 'primary' ? 0.6 : 0.4,
    allowUserControl: true
  };
};

/**
 * Breadcrumb configuration for complex navigation
 */
export const getBreadcrumbConfig = (mode: UIMode, role: UserRoleType) => {
  if (role === 'student' && mode === 'primary') {
    // Pas de breadcrumbs pour les primaires (trop complexe)
    return { enabled: false };
  }

  return {
    enabled: true,
    maxItems: mode === 'college' ? 3 : 4,
    showIcons: mode === 'primary',
    separator: mode === 'primary' ? '→' : '/',
    homeName: role === 'student' ? 'Accueil' : 'Dashboard'
  };
};

/**
 * Keyboard navigation shortcuts
 */
export const getKeyboardShortcuts = (mode: UIMode, role: UserRoleType) => {
  const base = [
    { key: 'Alt+H', action: 'home', description: 'Aller à l\'accueil' },
    { key: 'Alt+G', action: 'guide', description: 'Ouvrir le guide' },
    { key: 'Escape', action: 'close-menu', description: 'Fermer le menu' },
    { key: 'Tab', action: 'next-item', description: 'Élément suivant' },
    { key: 'Shift+Tab', action: 'prev-item', description: 'Élément précédent' }
  ];

  if (role === 'student') {
    base.push(
      { key: 'Alt+N', action: 'new-chat', description: 'Nouvelle discussion' },
      { key: 'Alt+C', action: 'continue-chat', description: 'Continuer discussion' }
    );
  } else {
    base.push(
      { key: 'Alt+E', action: 'manage-children', description: 'Gérer les enfants' },
      { key: 'Alt+R', action: 'reports', description: 'Voir les rapports' }
    );
  }

  // Simplifier pour les primaires
  if (mode === 'primary') {
    return base.filter(shortcut =>
      ['Alt+H', 'Alt+N', 'Escape'].includes(shortcut.key)
    );
  }

  return base;
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
  getEducationalShortcuts,
  getTouchGestureConfig,
  getAudioFeedbackConfig,
  getBreadcrumbConfig,
  getKeyboardShortcuts,
  getPerformanceConfig
};
