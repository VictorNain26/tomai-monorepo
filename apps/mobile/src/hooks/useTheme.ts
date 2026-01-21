/**
 * useTheme Hook
 *
 * Manages theme preference (light/dark/system) with AsyncStorage persistence.
 * Follows React Native / NativeWind best practices.
 */

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { useColorScheme as useSystemColorScheme } from 'react-native';
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
  const rawSystemScheme = useSystemColorScheme();
  // Handle null, undefined, and 'unspecified' from react-native
  const systemColorScheme: ColorScheme =
    rawSystemScheme === 'dark' ? 'dark' : 'light';
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [isLoading, setIsLoading] = useState(true);

  // Load saved preference on mount
  useEffect(() => {
    async function loadTheme() {
      try {
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (saved && ['light', 'dark', 'system'].includes(saved)) {
          setThemeModeState(saved as ThemeMode);
        }
      } catch {
        // Ignore errors, use default
      } finally {
        setIsLoading(false);
      }
    }
    void loadTheme();
  }, []);

  // Set and persist theme mode
  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    setThemeModeState(mode);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      // Ignore storage errors
    }
  }, []);

  // Compute actual color scheme
  const colorScheme: ColorScheme =
    themeMode === 'system' ? systemColorScheme : themeMode;

  return {
    themeMode,
    colorScheme,
    isDark: colorScheme === 'dark',
    setThemeMode,
    isLoading,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export { ThemeContext };
