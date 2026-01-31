/**
 * ThemeProvider Component
 *
 * Provides theme context to the app.
 * NOTE: Dark mode class is applied in the layouts, not here,
 * to avoid NativeWind/css-interop issues with navigation context.
 */

import { useThemeProvider, ThemeContext } from '@/hooks/useTheme';

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const theme = useThemeProvider();

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
}
