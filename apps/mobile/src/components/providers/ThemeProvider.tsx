/**
 * ThemeProvider Component
 *
 * Provides theme context to the app.
 * Dark mode uses NativeWind v5 dark: variant + Appearance.setColorScheme().
 */

import { useThemeProvider, ThemeContext } from '@/hooks/useTheme';

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const theme = useThemeProvider();

  return (
    <ThemeContext value={theme}>
      {children}
    </ThemeContext>
  );
}
