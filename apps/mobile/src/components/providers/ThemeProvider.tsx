/**
 * ThemeProvider Component
 *
 * Provides theme context to the app.
 * Les palettes @repo/tokens sont injectées en variables NativeWind à runtime
 * (VariableContextProvider, pattern NativeWind v5) : les classes sémantiques
 * (bg-primary, bg-card…) suivent le mode sans variante dark: par classe.
 * L'injection est exhaustive — pas d'héritage de cascade à runtime.
 */

import { VariableContextProvider } from 'nativewind';
import { darkColors, lightColors } from '@repo/tokens';
import { useThemeProvider, ThemeContext } from '@/hooks/useTheme';

interface ThemeProviderProps {
  children: React.ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  const theme = useThemeProvider();

  return (
    <ThemeContext value={theme}>
      <VariableContextProvider value={theme.isDark ? darkColors : lightColors}>
        {children}
      </VariableContextProvider>
    </ThemeContext>
  );
}
