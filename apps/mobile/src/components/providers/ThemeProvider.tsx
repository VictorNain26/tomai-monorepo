/**
 * ThemeProvider Component
 *
 * Provides theme context to the app and applies dark mode class to NativeWind.
 */

import { View } from 'react-native';
import { useThemeProvider, ThemeContext } from '@/hooks/useTheme';

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const theme = useThemeProvider();

  // Apply dark class for NativeWind
  // NativeWind v4 uses the 'dark' class on a parent View
  return (
    <ThemeContext.Provider value={theme}>
      <View className={`flex-1 ${theme.isDark ? 'dark' : ''}`}>{children}</View>
    </ThemeContext.Provider>
  );
}
