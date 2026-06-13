/**
 * useTheme Hook
 *
 * Manages theme preference (light/dark/system) with AsyncStorage persistence.
 * Uses React Native's Appearance API (NativeWind v5 compatible).
 *
 * NativeWind v5: useColorScheme from nativewind is DEPRECATED.
 * Use useColorScheme from react-native + Appearance.setColorScheme().
 */

import { useState, useEffect, useCallback, createContext, use } from 'react';
import { useColorScheme, Appearance, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as NavigationBar from 'expo-navigation-bar';

// ============================================================================
// TYPES
// ============================================================================

export type ThemeMode = 'light' | 'dark' | 'system';
type ColorScheme = 'light' | 'dark';

interface ThemeContextValue {
  /** User's preference (light/dark/system) */
  themeMode: ThemeMode;
  /** Actual color scheme being applied */
  colorScheme: ColorScheme;
  /** Is dark mode currently active */
  isDark: boolean;
  /** Set theme preference */
  setThemeMode: (mode: ThemeMode) => void;
  /** Toggle between light and dark */
  toggleTheme: () => void;
  /** Loading state */
  isLoading: boolean;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const THEME_STORAGE_KEY = '@tomai/theme-mode';

// ============================================================================
// CONTEXT
// ============================================================================

const ThemeContext = createContext<ThemeContextValue | null>(null);

// ============================================================================
// HOOK
// ============================================================================

export function useTheme(): ThemeContextValue {
  const context = use(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

// ============================================================================
// PROVIDER HOOK (internal)
// ============================================================================

export function useThemeProvider(): ThemeContextValue {
  // React Native's useColorScheme reacts to Appearance changes
  const rnColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('dark');
  const [isLoading, setIsLoading] = useState(true);

  // Normalize (can be null)
  const colorScheme: ColorScheme = rnColorScheme === 'dark' ? 'dark' : 'light';

  // Sync Android navigation bar style with current theme
  // @see https://docs.expo.dev/develop/user-interface/system-bars
  useEffect(() => {
    if (Platform.OS === 'android') {
      NavigationBar.setStyle(colorScheme === 'dark' ? 'light' : 'dark');
    }
  }, [colorScheme]);

  // Load saved preference on mount and apply via Appearance API
  useEffect(() => {
    async function loadTheme() {
      try {
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (saved && ['light', 'dark', 'system'].includes(saved)) {
          const mode = saved as ThemeMode;
          setThemeModeState(mode);
          // 'unspecified' = follow system preference
          Appearance.setColorScheme(mode === 'system' ? 'unspecified' : mode);
        } else {
          // No saved preference — apply dark default
          Appearance.setColorScheme('dark');
        }
      } catch {
        // Ignore errors, apply dark default
        Appearance.setColorScheme('dark');
      } finally {
        setIsLoading(false);
      }
    }
    void loadTheme();
  }, []);

  // Set and persist theme mode via Appearance API
  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    setThemeModeState(mode);
    // null = follow system preference
    Appearance.setColorScheme(mode === 'system' ? 'unspecified' : mode);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Toggle between light and dark
  const toggleTheme = useCallback(() => {
    const next: ThemeMode = colorScheme === 'dark' ? 'light' : 'dark';
    void setThemeMode(next);
  }, [colorScheme, setThemeMode]);

  return {
    themeMode,
    colorScheme,
    isDark: colorScheme === 'dark',
    setThemeMode,
    toggleTheme,
    isLoading,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export { ThemeContext };
