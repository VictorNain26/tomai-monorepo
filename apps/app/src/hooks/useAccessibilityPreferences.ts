/**
 * Accessibility Preferences Hook for Tom Educational Platform
 * Manages user accessibility settings and system preferences
 */

import { useState, useEffect, useCallback } from 'react';
import type { AccessibilityMode } from '@/utils/navigationAdaptive';

interface AccessibilityPreferences extends AccessibilityMode {
  fontSize: 'small' | 'medium' | 'large' | 'extra-large';
  theme: 'light' | 'dark' | 'auto' | 'high-contrast';
  animations: 'full' | 'reduced' | 'none';
  soundEnabled: boolean;
  voiceNavigation: boolean;
  colorBlindMode: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
}

const DEFAULT_PREFERENCES: AccessibilityPreferences = {
  highContrast: false,
  largeText: false,
  reducedMotion: false,
  forcedColors: false,
  audioFeedback: false,
  keyboardOnly: false,
  fontSize: 'medium',
  theme: 'auto',
  animations: 'full',
  soundEnabled: true,
  voiceNavigation: false,
  colorBlindMode: 'none'
};

const STORAGE_KEY = 'tomia_accessibility_preferences';

export const useAccessibilityPreferences = () => {
  const [preferences, setPreferences] = useState<AccessibilityPreferences>(DEFAULT_PREFERENCES);
  const [isLoading, setIsLoading] = useState(true);

  // Detect system preferences
  const detectSystemPreferences = useCallback(() => {
    const systemPrefs: Partial<AccessibilityPreferences> = {};

    // Detect reduced motion preference
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      systemPrefs.reducedMotion = true;
      systemPrefs.animations = 'reduced';
    }

    // Detect high contrast preference
    if (window.matchMedia('(prefers-contrast: high)').matches) {
      systemPrefs.highContrast = true;
      systemPrefs.theme = 'high-contrast';
    }

    // Detect color scheme preference
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      systemPrefs.theme = 'dark';
    }

    // Detect forced colors (Windows High Contrast mode)
    if (window.matchMedia('(forced-colors: active)').matches) {
      systemPrefs.forcedColors = true;
      systemPrefs.highContrast = true;
    }

    return systemPrefs;
  }, []);

  // Load preferences from localStorage or detect system preferences
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsedPrefs = JSON.parse(stored) as AccessibilityPreferences;
        setPreferences(parsedPrefs);
      } else {
        // First time user - detect system preferences
        const systemPrefs = detectSystemPreferences();
        const initialPrefs = { ...DEFAULT_PREFERENCES, ...systemPrefs };
        setPreferences(initialPrefs);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(initialPrefs));
      }
    } catch {
      // Failed to load accessibility preferences
      setPreferences(DEFAULT_PREFERENCES);
    } finally {
      setIsLoading(false);
    }
  }, [detectSystemPreferences]);

  // Save preferences to localStorage
  const savePreferences = useCallback((newPrefs: AccessibilityPreferences) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newPrefs));
      setPreferences(newPrefs);
    } catch {
      // Failed to save accessibility preferences
    }
  }, []);

  // Update specific preference
  const updatePreference = useCallback(<K extends keyof AccessibilityPreferences>(
    key: K,
    value: AccessibilityPreferences[K]
  ) => {
    const newPrefs = { ...preferences, [key]: value };
    savePreferences(newPrefs);
  }, [preferences, savePreferences]);

  // Toggle boolean preferences
  const togglePreference = useCallback((key: keyof AccessibilityPreferences) => {
    if (typeof preferences[key] === 'boolean') {
      updatePreference(key, !preferences[key] as AccessibilityPreferences[typeof key]);
    }
  }, [preferences, updatePreference]);

  // Reset to defaults
  const resetToDefaults = useCallback(() => {
    const systemPrefs = detectSystemPreferences();
    const resetPrefs = { ...DEFAULT_PREFERENCES, ...systemPrefs };
    savePreferences(resetPrefs);
  }, [detectSystemPreferences, savePreferences]);

  // Apply CSS classes based on preferences
  const getAccessibilityClasses = useCallback(() => {
    const classes: string[] = [];

    if (preferences.highContrast) {
      classes.push('high-contrast');
    }

    if (preferences.largeText) {
      classes.push('large-text');
    }

    if (preferences.reducedMotion) {
      classes.push('reduced-motion');
    }

    if (preferences.forcedColors) {
      classes.push('forced-colors');
    }

    classes.push(`font-size-${preferences.fontSize}`);
    classes.push(`theme-${preferences.theme}`);
    classes.push(`animations-${preferences.animations}`);

    if (preferences.colorBlindMode !== 'none') {
      classes.push(`colorblind-${preferences.colorBlindMode}`);
    }

    return classes.join(' ');
  }, [preferences]);

  // Get ARIA attributes for accessibility
  const getAriaAttributes = useCallback(() => {
    return {
      'aria-live': preferences.audioFeedback ? 'polite' : 'off',
      'aria-describedby': preferences.keyboardOnly ? 'keyboard-navigation-help' : undefined,
      'data-high-contrast': preferences.highContrast,
      'data-large-text': preferences.largeText,
      'data-reduced-motion': preferences.reducedMotion
    };
  }, [preferences]);

  // Listen for system preference changes
  useEffect(() => {
    const mediaQueries = [
      { query: '(prefers-reduced-motion: reduce)', key: 'reducedMotion' as const },
      { query: '(prefers-contrast: high)', key: 'highContrast' as const },
      { query: '(forced-colors: active)', key: 'forcedColors' as const }
    ];

    const handlers = mediaQueries.map(({ query, key }) => {
      const mq = window.matchMedia(query);
      const handler = (e: MediaQueryListEvent) => {
        updatePreference(key, e.matches);
      };

      mq.addEventListener('change', handler);
      return { mq, handler };
    });

    return () => {
      handlers.forEach(({ mq, handler }) => {
        mq.removeEventListener('change', handler);
      });
    };
  }, [updatePreference]);

  return {
    preferences,
    isLoading,
    updatePreference,
    togglePreference,
    resetToDefaults,
    getAccessibilityClasses,
    getAriaAttributes,
    savePreferences
  };
};

export default useAccessibilityPreferences;
