/**
 * useTheme Hook
 *
 * Manages theme preference (light/dark/system) with AsyncStorage persistence.
 * Uses NativeWind's useColorScheme to properly toggle dark mode.
 *
 * @see https://www.nativewind.dev/v4/api/use-color-scheme
 */

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { useColorScheme } from 'nativewind';
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
  // NativeWind's useColorScheme provides both current scheme AND setColorScheme
  const { colorScheme: nwColorScheme, setColorScheme } = useColorScheme();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [isLoading, setIsLoading] = useState(true);

  // Normalize NativeWind's colorScheme (can be undefined)
  const colorScheme: ColorScheme = nwColorScheme === 'dark' ? 'dark' : 'light';

  // Load saved preference on mount and apply to NativeWind
  useEffect(() => {
    async function loadTheme() {
      try {
        const saved = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (saved && ['light', 'dark', 'system'].includes(saved)) {
          const mode = saved as ThemeMode;
          setThemeModeState(mode);
          // Apply to NativeWind immediately
          setColorScheme(mode);
        }
      } catch {
        // Ignore errors, use default
      } finally {
        setIsLoading(false);
      }
    }
    void loadTheme();
  }, [setColorScheme]);

  // Set and persist theme mode, notify NativeWind
  const setThemeMode = useCallback(async (mode: ThemeMode) => {
    setThemeModeState(mode);
    // KEY: Tell NativeWind to switch color scheme
    setColorScheme(mode);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch {
      // Ignore storage errors
    }
  }, [setColorScheme]);

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
