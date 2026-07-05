import { useMemo } from 'react';
import { darkColors, lightColors, type ColorToken } from '@repo/tokens';
import { useTheme } from './useTheme';

/**
 * Tokens couleur en valeurs JS pour les API RN impératives (ActivityIndicator,
 * placeholderTextColor, icônes lucide…) — mêmes palettes @repo/tokens que les
 * classes NativeWind injectées par ThemeProvider.
 */
export interface ThemeColors {
  primary: string;
  primaryForeground: string;
  secondary: string;
  secondaryForeground: string;
  success: string;
  successForeground: string;
  warning: string;
  warningForeground: string;
  destructive: string;
  destructiveForeground: string;
  info: string;
  infoForeground: string;
  foreground: string;
  mutedForeground: string;
  background: string;
  border: string;
  card: string;
}

function toThemeColors(tokens: Record<ColorToken, string>): ThemeColors {
  return {
    primary: tokens['--color-primary'],
    primaryForeground: tokens['--color-primary-foreground'],
    secondary: tokens['--color-secondary'],
    secondaryForeground: tokens['--color-secondary-foreground'],
    success: tokens['--color-success'],
    successForeground: tokens['--color-success-foreground'],
    warning: tokens['--color-warning'],
    warningForeground: tokens['--color-warning-foreground'],
    destructive: tokens['--color-destructive'],
    destructiveForeground: tokens['--color-destructive-foreground'],
    info: tokens['--color-info'],
    infoForeground: tokens['--color-info-foreground'],
    foreground: tokens['--color-foreground'],
    mutedForeground: tokens['--color-muted-foreground'],
    background: tokens['--color-background'],
    border: tokens['--color-border'],
    card: tokens['--color-card'],
  };
}

const LIGHT = toThemeColors(lightColors);
const DARK = toThemeColors(darkColors);

export function useThemeColors(): ThemeColors {
  const { isDark } = useTheme();
  return useMemo(() => (isDark ? DARK : LIGHT), [isDark]);
}
