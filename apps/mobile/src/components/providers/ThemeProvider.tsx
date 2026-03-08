/**
 * ThemeProvider Component
 *
 * Provides theme context to the app.
 * Dark mode uses NativeWind v5 dark: variant + Appearance.setColorScheme().
 */

import { View } from 'react-native';
import { useThemeProvider, ThemeContext } from '@/hooks/useTheme';

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const theme = useThemeProvider();

  return (
    <ThemeContext.Provider value={theme}>
      <View className="flex-1">
        {children}
      </View>
    </ThemeContext.Provider>
  );
}
