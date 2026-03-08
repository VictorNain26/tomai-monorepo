/**
 * useTheme Hook
 *
 * Manages theme preference (light/dark/system) with AsyncStorage persistence.
 * Uses React Native's Appearance API (NativeWind v5 compatible).
 *
 * NativeWind v5: useColorScheme from nativewind is DEPRECATED.
 * Use useColorScheme from react-native + Appearance.setColorScheme().
 */

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { useColorScheme, Appearance } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ============================================================================
// TYPES
// ============================================================================

export type ThemeMode = 'light' | 'dark' | 'system';
export type ColorScheme = 'light' | 'dark';

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
  const context = useContext(ThemeContext);
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
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [isLoading, setIsLoading] = useState(true);

  // Normalize (can be null)
  const colorScheme: ColorScheme = rnColorScheme === 'dark' ? 'dark' : 'light';

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
        }
      } catch {
        // Ignore errors, use default
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
